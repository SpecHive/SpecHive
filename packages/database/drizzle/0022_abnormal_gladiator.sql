-- ==========================================================================
-- Partition tests and test_attempts by RANGE on created_at (monthly)
-- Pre-release migration: drops and recreates tables (no data preservation)
-- ==========================================================================

-- 1. Drop FK from artifacts → tests (partitioned tests can't have single-column FK)
ALTER TABLE "artifacts" DROP CONSTRAINT IF EXISTS "artifacts_test_id_tests_id_fk";--> statement-breakpoint

-- 2. Drop dependent tables first (cascade handles any remaining FKs)
DROP TABLE IF EXISTS "test_attempts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tests" CASCADE;--> statement-breakpoint

-- 3. Create partitioned tests table
CREATE TABLE "tests" (
    "id" uuid NOT NULL,
    "suite_id" uuid NOT NULL,
    "run_id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "name" varchar(500) NOT NULL,
    "status" "test_status" NOT NULL DEFAULT 'pending',
    "duration_ms" integer,
    "error_message" text,
    "stack_trace" text,
    "retry_count" integer NOT NULL DEFAULT 0,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "tests_id_created_at_pk" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");--> statement-breakpoint

-- 4. Create partitioned test_attempts table
CREATE TABLE "test_attempts" (
    "id" uuid NOT NULL,
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
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "test_attempts_id_created_at_pk" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");--> statement-breakpoint

-- 5. FK constraints (partitioned → non-partitioned only)
ALTER TABLE "tests" ADD CONSTRAINT "tests_suite_id_suites_id_fk"
    FOREIGN KEY ("suite_id") REFERENCES "public"."suites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_run_id_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_run_id_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- NOTE: test_attempts.test_id → tests.id FK intentionally omitted.
-- Partitioned tests PK is (id, created_at), so single-column FK on id is impossible.
-- test_attempts are cascade-deleted via test_attempts.run_id → runs.id.

-- NOTE: artifacts.test_id → tests.id FK intentionally omitted (same reason).
-- Cascade handled by cascade_delete_test_artifacts trigger below.

-- 6. Indexes on partitioned tables (auto-propagate to partitions)
CREATE INDEX "tests_id_idx" ON "tests" USING btree ("id");--> statement-breakpoint
CREATE INDEX "tests_suite_idx" ON "tests" USING btree ("suite_id");--> statement-breakpoint
CREATE INDEX "tests_run_status_idx" ON "tests" USING btree ("run_id", "status");--> statement-breakpoint
CREATE INDEX "tests_organization_id_idx" ON "tests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tests_run_created_idx" ON "tests" USING btree ("run_id", "created_at");--> statement-breakpoint
CREATE INDEX "tests_run_name_idx" ON "tests" USING btree ("run_id", "name");--> statement-breakpoint
CREATE INDEX "tests_flaky_run_idx" ON "tests" USING btree ("run_id") WHERE status = 'flaky';--> statement-breakpoint

CREATE UNIQUE INDEX "test_attempts_test_retry_idx" ON "test_attempts" USING btree ("test_id", "retry_index", "created_at");--> statement-breakpoint
CREATE INDEX "test_attempts_organization_id_idx" ON "test_attempts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "test_attempts_run_id_idx" ON "test_attempts" USING btree ("run_id");--> statement-breakpoint

-- 7. Partitions: DEFAULT + current month + 3 months ahead
CREATE TABLE tests_default PARTITION OF "tests" DEFAULT;--> statement-breakpoint
CREATE TABLE tests_y2026m03 PARTITION OF "tests" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE tests_y2026m04 PARTITION OF "tests" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE tests_y2026m05 PARTITION OF "tests" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE tests_y2026m06 PARTITION OF "tests" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint

CREATE TABLE test_attempts_default PARTITION OF "test_attempts" DEFAULT;--> statement-breakpoint
CREATE TABLE test_attempts_y2026m03 PARTITION OF "test_attempts" FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');--> statement-breakpoint
CREATE TABLE test_attempts_y2026m04 PARTITION OF "test_attempts" FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');--> statement-breakpoint
CREATE TABLE test_attempts_y2026m05 PARTITION OF "test_attempts" FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');--> statement-breakpoint
CREATE TABLE test_attempts_y2026m06 PARTITION OF "test_attempts" FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');--> statement-breakpoint

-- 8. Triggers on partitioned tables (propagate to all partitions)
CREATE OR REPLACE TRIGGER set_updated_at_tests
    BEFORE UPDATE ON "tests"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE OR REPLACE TRIGGER set_updated_at_test_attempts
    BEFORE UPDATE ON "test_attempts"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

CREATE OR REPLACE TRIGGER verify_test_run_consistency_trigger
    BEFORE INSERT OR UPDATE ON "tests"
    FOR EACH ROW EXECUTE FUNCTION verify_test_run_consistency();--> statement-breakpoint

-- 9. Cascade trigger: delete artifacts when a test is deleted
-- Needed because artifacts.test_id FK was removed (partitioned PK constraint).
-- test_attempts cascade via their run_id → runs.id FK, so no trigger needed for them.
CREATE OR REPLACE FUNCTION cascade_delete_test_artifacts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM artifacts WHERE test_id = OLD.id;
    RETURN OLD;
END;
$$;--> statement-breakpoint

CREATE TRIGGER cascade_test_artifacts
    BEFORE DELETE ON "tests"
    FOR EACH ROW EXECUTE FUNCTION cascade_delete_test_artifacts();--> statement-breakpoint

-- 10. RLS on partitioned tables
ALTER TABLE "tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tests";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "tests"
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid)
    WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

ALTER TABLE "test_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "test_attempts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "test_attempts";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "test_attempts"
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid)
    WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- NOTE: For production, automate partition creation with pg_partman:
-- CREATE EXTENSION IF NOT EXISTS pg_partman;
-- SELECT partman.create_parent('public.tests', 'created_at', 'native', 'monthly');
-- SELECT partman.create_parent('public.test_attempts', 'created_at', 'native', 'monthly');
