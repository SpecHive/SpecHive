DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role') THEN
    CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member', 'viewer');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artifact_type') THEN
    CREATE TYPE "public"."artifact_type" AS ENUM('screenshot', 'video', 'trace', 'log', 'other');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
    CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'passed', 'failed', 'cancelled');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_status') THEN
    CREATE TYPE "public"."test_status" AS ENUM('pending', 'running', 'passed', 'failed', 'skipped', 'flaky');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "project_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"test_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "artifact_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"size_bytes" integer,
	"mime_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"passed_tests" integer DEFAULT 0 NOT NULL,
	"failed_tests" integer DEFAULT 0 NOT NULL,
	"skipped_tests" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"parent_suite_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"suite_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"status" "test_status" DEFAULT 'pending' NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"stack_trace" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tokens" ADD CONSTRAINT "project_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suites" ADD CONSTRAINT "suites_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suites" ADD CONSTRAINT "suites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suites" ADD CONSTRAINT "suites_parent_suite_id_suites_id_fk" FOREIGN KEY ("parent_suite_id") REFERENCES "public"."suites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_suite_id_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_idx" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tokens_hash_idx" ON "project_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_idx" ON "projects" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "artifacts_test_idx" ON "artifacts" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "artifacts_organization_id_idx" ON "artifacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "runs_project_created_idx" ON "runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_project_status_idx" ON "runs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "suites_run_id_idx" ON "suites" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "suites_organization_id_idx" ON "suites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tests_suite_idx" ON "tests" USING btree ("suite_id");--> statement-breakpoint
CREATE INDEX "tests_run_status_idx" ON "tests" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "tests_organization_id_idx" ON "tests" USING btree ("organization_id");--> statement-breakpoint

-- ============================================================================
-- Custom SQL: triggers, RLS, and SECURITY DEFINER functions
-- (Not managed by drizzle-kit — maintain manually)
-- ============================================================================

-- 1. updated_at trigger function -----------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- 2. Apply trigger to all tables ----------------------------------------
CREATE OR REPLACE TRIGGER set_updated_at_organizations BEFORE UPDATE ON "organizations" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_users BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_memberships BEFORE UPDATE ON "memberships" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_projects BEFORE UPDATE ON "projects" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_project_tokens BEFORE UPDATE ON "project_tokens" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_runs BEFORE UPDATE ON "runs" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_suites BEFORE UPDATE ON "suites" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_tests BEFORE UPDATE ON "tests" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint
CREATE OR REPLACE TRIGGER set_updated_at_artifacts BEFORE UPDATE ON "artifacts" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

-- 3. Enable RLS on all tables -------------------------------------------
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 4. FORCE RLS (prevent table-owner bypass) -----------------------------
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "suites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 5. RLS policies: direct organization_id tables -----------------------
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "projects";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "projects"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "memberships";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "memberships"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "org_tenant_isolation" ON "organizations";--> statement-breakpoint
CREATE POLICY org_tenant_isolation ON "organizations"
  USING (id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "users_tenant_isolation" ON "users";--> statement-breakpoint
CREATE POLICY users_tenant_isolation ON "users"
  USING (id IN (
    SELECT user_id FROM memberships
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));--> statement-breakpoint

-- 6. RLS policies: via project_id -> projects ---------------------------
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "project_tokens";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "project_tokens"
  FOR ALL
  USING (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "runs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "runs"
  FOR ALL
  USING (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ))
  WITH CHECK (project_id IN (
    SELECT id FROM projects
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  ));--> statement-breakpoint

-- 7. RLS policies: direct organization_id on denormalized tables --------
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "suites";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "suites"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tests";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "tests"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "artifacts";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "artifacts"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

-- 9. SECURITY DEFINER functions for token auth -------------------------
CREATE OR REPLACE FUNCTION validate_project_token(p_token_hash text)
RETURNS TABLE(project_id uuid, organization_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT pt.project_id, p.organization_id
  FROM project_tokens pt
  JOIN projects p ON pt.project_id = p.id
  WHERE pt.token_hash = p_token_hash AND pt.revoked_at IS NULL
  LIMIT 1;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION touch_project_token_usage(p_token_hash text)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE project_tokens SET last_used_at = now() WHERE token_hash = p_token_hash;
$$;--> statement-breakpoint

-- Requires assertly_app role from init.sh to be created before running this migration
GRANT EXECUTE ON FUNCTION validate_project_token(text) TO assertly_app;--> statement-breakpoint
-- Requires assertly_app role from init.sh to be created before running this migration
GRANT EXECUTE ON FUNCTION touch_project_token_usage(text) TO assertly_app;
