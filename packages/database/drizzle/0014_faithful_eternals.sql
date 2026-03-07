CREATE TABLE "test_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"test_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"retry_index" integer NOT NULL,
	"status" "test_status" NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"stack_trace" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "retry_index" integer;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "test_attempts_test_retry_idx" ON "test_attempts" USING btree ("test_id","retry_index");--> statement-breakpoint
CREATE INDEX "test_attempts_organization_id_idx" ON "test_attempts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "test_attempts_run_id_idx" ON "test_attempts" USING btree ("run_id");--> statement-breakpoint
-- RLS for test_attempts (MUST be added manually — Drizzle doesn't generate RLS)
ALTER TABLE "test_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "test_attempts";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "test_attempts"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);
