/*
 * Row-Level Security (RLS) for tenant isolation
 *
 * Defense-in-depth: supplements application-layer authorization checks with
 * database-enforced tenant boundaries.
 *
 * How it works:
 *   - The application MUST call SET LOCAL app.current_organization_id = '<uuid>'
 *     at the start of each transaction (or statement) when connected as assertly_app.
 *   - If app.current_organization_id is not set, all queries against RLS-protected
 *     tables will return zero rows (fail-closed behavior).
 *   - The superuser role (assertly) bypasses RLS by default -- no policy needed.
 *   - The assertly_app role IS subject to RLS policies.
 *
 * Covered tables:
 *   projects, project_tokens, runs, suites, tests, artifacts, memberships
 *
 * Tenant hierarchy:
 *   organizations -> projects -> project_tokens
 *                             -> runs -> suites -> tests -> artifacts
 *   organizations -> memberships
 */

-- Enable RLS on all tenant-scoped tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Direct organization_id tables -----------------------------------------------

CREATE POLICY tenant_isolation_policy ON projects
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY tenant_isolation_policy ON memberships
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- Via project_id -> projects ---------------------------------------------------

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

-- Via run_id -> runs -> projects -----------------------------------------------

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

-- Via test_id -> tests -> runs -> projects -------------------------------------

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
