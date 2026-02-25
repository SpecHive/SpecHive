-- Add ON DELETE CASCADE to FK hierarchy
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_organization_id_organizations_id_fk";
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_users_id_fk";
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "projects" DROP CONSTRAINT "projects_organization_id_organizations_id_fk";
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "project_tokens" DROP CONSTRAINT "project_tokens_project_id_projects_id_fk";
ALTER TABLE "project_tokens" ADD CONSTRAINT "project_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "runs" DROP CONSTRAINT "runs_project_id_projects_id_fk";
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "suites" DROP CONSTRAINT "suites_run_id_runs_id_fk";
ALTER TABLE "suites" ADD CONSTRAINT "suites_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "tests" DROP CONSTRAINT "tests_suite_id_suites_id_fk";
ALTER TABLE "tests" ADD CONSTRAINT "tests_suite_id_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."suites"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "tests" DROP CONSTRAINT "tests_run_id_runs_id_fk";
ALTER TABLE "tests" ADD CONSTRAINT "tests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE CASCADE ON UPDATE no action;

ALTER TABLE "artifacts" DROP CONSTRAINT "artifacts_test_id_tests_id_fk";
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE ON UPDATE no action;

-- Keep suites.parent_suite_id as SET NULL (already correct from migration 0001)

-- Add UNIQUE constraint on project_tokens.token_hash
DROP INDEX IF EXISTS "project_tokens_hash_idx";
CREATE UNIQUE INDEX "project_tokens_hash_idx" ON "project_tokens" USING btree ("token_hash");

-- Set DEFAULT '{}'::jsonb on runs.metadata
ALTER TABLE "runs" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;

-- Add updated_at to artifacts table
ALTER TABLE "artifacts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- Create update_updated_at_column() trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply BEFORE UPDATE trigger to all tables with updated_at
CREATE TRIGGER set_updated_at_organizations BEFORE UPDATE ON "organizations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_memberships BEFORE UPDATE ON "memberships" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON "projects" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_project_tokens BEFORE UPDATE ON "project_tokens" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_runs BEFORE UPDATE ON "runs" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_suites BEFORE UPDATE ON "suites" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_tests BEFORE UPDATE ON "tests" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_artifacts BEFORE UPDATE ON "artifacts" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
