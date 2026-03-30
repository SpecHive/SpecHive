CREATE TABLE "daily_error_stats" (
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"error_group_id" uuid NOT NULL,
	"date" date NOT NULL,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"unique_tests" integer DEFAULT 0 NOT NULL,
	"unique_branches" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_error_stats_project_id_error_group_id_date_pk" PRIMARY KEY("project_id","error_group_id","date")
);
--> statement-breakpoint
CREATE TABLE "error_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"normalized_message" text NOT NULL,
	"error_name" text,
	"error_category" text,
	"total_occurrences" integer DEFAULT 0 NOT NULL,
	"unique_test_count" integer DEFAULT 0 NOT NULL,
	"unique_branch_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_occurrences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"error_group_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"branch" text,
	"commit_sha" text,
	"test_name" text NOT NULL,
	"error_message" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "error_group_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_error_stats" ADD CONSTRAINT "daily_error_stats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_error_stats" ADD CONSTRAINT "daily_error_stats_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_error_stats" ADD CONSTRAINT "daily_error_stats_error_group_id_error_groups_id_fk" FOREIGN KEY ("error_group_id") REFERENCES "public"."error_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_groups" ADD CONSTRAINT "error_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_groups" ADD CONSTRAINT "error_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD CONSTRAINT "error_occurrences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD CONSTRAINT "error_occurrences_error_group_id_error_groups_id_fk" FOREIGN KEY ("error_group_id") REFERENCES "public"."error_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD CONSTRAINT "error_occurrences_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD CONSTRAINT "error_occurrences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_error_stats_project_date" ON "daily_error_stats" USING btree ("project_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_error_groups_fingerprint" ON "error_groups" USING btree ("project_id","fingerprint");--> statement-breakpoint
CREATE INDEX "idx_error_groups_project_last_seen" ON "error_groups" USING btree ("project_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_error_groups_project_occurrences" ON "error_groups" USING btree ("project_id","total_occurrences");--> statement-breakpoint
CREATE INDEX "idx_error_groups_org" ON "error_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_error_occurrences_group" ON "error_occurrences" USING btree ("error_group_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_error_occurrences_run" ON "error_occurrences" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_error_occurrences_project_date" ON "error_occurrences" USING btree ("project_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_error_occurrences_test" ON "error_occurrences" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_error_occurrences_branch" ON "error_occurrences" USING btree ("error_group_id","branch");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_error_occurrences_run_test" ON "error_occurrences" USING btree ("run_id","test_id");--> statement-breakpoint
CREATE INDEX "tests_error_group_idx" ON "tests" USING btree ("error_group_id");--> statement-breakpoint

-- RLS: error_groups
ALTER TABLE "error_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "error_groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "error_groups";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "error_groups"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

-- RLS: error_occurrences
ALTER TABLE "error_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "error_occurrences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "error_occurrences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "error_occurrences"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

-- RLS: daily_error_stats
ALTER TABLE "daily_error_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_error_stats" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "daily_error_stats";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "daily_error_stats"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);