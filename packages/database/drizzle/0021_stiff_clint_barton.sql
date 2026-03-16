CREATE TABLE "daily_flaky_test_stats" (
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"test_name" text NOT NULL,
	"day" date NOT NULL,
	"flaky_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"total_retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_flaky_test_stats_project_id_test_name_day_pk" PRIMARY KEY("project_id","test_name","day")
);
--> statement-breakpoint
CREATE TABLE "daily_run_stats" (
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"day" date NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"passed_tests" integer DEFAULT 0 NOT NULL,
	"failed_tests" integer DEFAULT 0 NOT NULL,
	"skipped_tests" integer DEFAULT 0 NOT NULL,
	"flaky_tests" integer DEFAULT 0 NOT NULL,
	"sum_duration_ms" bigint DEFAULT 0 NOT NULL,
	"min_duration_ms" integer,
	"max_duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_run_stats_project_id_day_pk" PRIMARY KEY("project_id","day")
);
--> statement-breakpoint
DROP INDEX "suites_run_name_unique_idx";--> statement-breakpoint
ALTER TABLE "daily_flaky_test_stats" ADD CONSTRAINT "daily_flaky_test_stats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_flaky_test_stats" ADD CONSTRAINT "daily_flaky_test_stats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_run_stats" ADD CONSTRAINT "daily_run_stats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_run_stats" ADD CONSTRAINT "daily_run_stats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_flaky_test_stats_org_project_day_idx" ON "daily_flaky_test_stats" USING btree ("organization_id","project_id","day");--> statement-breakpoint
CREATE INDEX "daily_run_stats_org_project_day_idx" ON "daily_run_stats" USING btree ("organization_id","project_id","day");--> statement-breakpoint
CREATE INDEX "suites_run_name_idx" ON "suites" USING btree ("run_id","name");--> statement-breakpoint

-- ============================================================================
-- RLS + triggers for pre-aggregation tables
-- ============================================================================

-- updated_at triggers
CREATE OR REPLACE TRIGGER set_updated_at_daily_run_stats
  BEFORE UPDATE ON "daily_run_stats"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE OR REPLACE TRIGGER set_updated_at_daily_flaky_test_stats
  BEFORE UPDATE ON "daily_flaky_test_stats"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

-- RLS: daily_run_stats
ALTER TABLE "daily_run_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_run_stats" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "daily_run_stats";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "daily_run_stats"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

-- RLS: daily_flaky_test_stats
ALTER TABLE "daily_flaky_test_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_flaky_test_stats" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "daily_flaky_test_stats";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "daily_flaky_test_stats"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);