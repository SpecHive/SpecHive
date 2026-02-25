/*
 * Migration 0004: RLS hardening
 *
 * a) FORCE ROW LEVEL SECURITY on all tables (prevents table-owner bypass)
 * b) RLS on organizations and users (previously unprotected)
 * c) SECURITY DEFINER functions for token authentication (must bypass RLS)
 * d) Idempotency guards for triggers and policies from migrations 0002/0003
 */

-- =============================================================================
-- (d) Idempotency: drop and recreate triggers from migration 0002
-- =============================================================================

DROP TRIGGER IF EXISTS set_updated_at_organizations ON "organizations";
DROP TRIGGER IF EXISTS set_updated_at_users ON "users";
DROP TRIGGER IF EXISTS set_updated_at_memberships ON "memberships";
DROP TRIGGER IF EXISTS set_updated_at_projects ON "projects";
DROP TRIGGER IF EXISTS set_updated_at_project_tokens ON "project_tokens";
DROP TRIGGER IF EXISTS set_updated_at_runs ON "runs";
DROP TRIGGER IF EXISTS set_updated_at_suites ON "suites";
DROP TRIGGER IF EXISTS set_updated_at_tests ON "tests";
DROP TRIGGER IF EXISTS set_updated_at_artifacts ON "artifacts";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations BEFORE UPDATE ON "organizations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_memberships BEFORE UPDATE ON "memberships" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON "projects" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_project_tokens BEFORE UPDATE ON "project_tokens" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_runs BEFORE UPDATE ON "runs" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_suites BEFORE UPDATE ON "suites" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_tests BEFORE UPDATE ON "tests" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_artifacts BEFORE UPDATE ON "artifacts" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- (d) Idempotency: drop and recreate policies from migration 0003
-- =============================================================================

DROP POLICY IF EXISTS tenant_isolation_policy ON projects;
DROP POLICY IF EXISTS tenant_isolation_policy ON memberships;
DROP POLICY IF EXISTS tenant_isolation_policy ON project_tokens;
DROP POLICY IF EXISTS tenant_isolation_policy ON runs;
DROP POLICY IF EXISTS tenant_isolation_policy ON suites;
DROP POLICY IF EXISTS tenant_isolation_policy ON tests;
DROP POLICY IF EXISTS tenant_isolation_policy ON artifacts;

CREATE POLICY tenant_isolation_policy ON projects
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY tenant_isolation_policy ON memberships
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY tenant_isolation_policy ON project_tokens
  FOR ALL
  USING (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));

CREATE POLICY tenant_isolation_policy ON runs
  FOR ALL
  USING (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));

CREATE POLICY tenant_isolation_policy ON suites
  FOR ALL
  USING (run_id IN (
    SELECT r.id FROM runs r
    JOIN projects p ON r.project_id = p.id
    WHERE p.organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (run_id IN (
    SELECT r.id FROM runs r
    JOIN projects p ON r.project_id = p.id
    WHERE p.organization_id = current_setting('app.current_organization_id')::uuid
  ));

CREATE POLICY tenant_isolation_policy ON tests
  FOR ALL
  USING (run_id IN (
    SELECT r.id FROM runs r
    JOIN projects p ON r.project_id = p.id
    WHERE p.organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (run_id IN (
    SELECT r.id FROM runs r
    JOIN projects p ON r.project_id = p.id
    WHERE p.organization_id = current_setting('app.current_organization_id')::uuid
  ));

CREATE POLICY tenant_isolation_policy ON artifacts
  FOR ALL
  USING (test_id IN (
    SELECT t.id FROM tests t
    JOIN runs r ON t.run_id = r.id
    JOIN projects p ON r.project_id = p.id
    WHERE p.organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (test_id IN (
    SELECT t.id FROM tests t
    JOIN runs r ON t.run_id = r.id
    JOIN projects p ON r.project_id = p.id
    WHERE p.organization_id = current_setting('app.current_organization_id')::uuid
  ));

-- =============================================================================
-- (a) FORCE ROW LEVEL SECURITY on existing RLS tables
-- Without FORCE, the table owner role can bypass policies even when not superuser
-- =============================================================================

ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE project_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE runs FORCE ROW LEVEL SECURITY;
ALTER TABLE suites FORCE ROW LEVEL SECURITY;
ALTER TABLE tests FORCE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- (b) RLS on organizations — currently unprotected
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_tenant_isolation ON organizations;
CREATE POLICY org_tenant_isolation ON organizations
  USING (id = current_setting('app.current_organization_id')::uuid);

-- =============================================================================
-- (b) RLS on users — scope through memberships
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (id IN (
    SELECT user_id FROM memberships
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));

-- =============================================================================
-- (c) SECURITY DEFINER functions for token authentication
-- These run as the defining role (superuser), bypassing RLS so the guard can
-- validate tokens before the organization context is known.
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_project_token(p_token_hash text)
RETURNS TABLE(project_id uuid, organization_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT pt.project_id, p.organization_id
  FROM project_tokens pt
  JOIN projects p ON pt.project_id = p.id
  WHERE pt.token_hash = p_token_hash AND pt.revoked_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION touch_project_token_usage(p_token_hash text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE project_tokens SET last_used_at = now() WHERE token_hash = p_token_hash;
$$;

GRANT EXECUTE ON FUNCTION validate_project_token(text) TO assertly_app;
GRANT EXECUTE ON FUNCTION touch_project_token_usage(text) TO assertly_app;
