CREATE INDEX "suites_parent_suite_id_idx" ON "suites" USING btree ("parent_suite_id");--> statement-breakpoint

-- A1: Add WITH CHECK to users_tenant_isolation policy
DROP POLICY IF EXISTS "users_tenant_isolation" ON "users";
CREATE POLICY "users_tenant_isolation" ON "users"
  FOR ALL
  USING (id IN (SELECT user_id FROM memberships WHERE organization_id = current_setting('app.current_organization_id')::uuid))
  WITH CHECK (id IN (SELECT user_id FROM memberships WHERE organization_id = current_setting('app.current_organization_id')::uuid));--> statement-breakpoint

-- A2: Add non-negative CHECK constraints on runs counters
ALTER TABLE "runs" ADD CONSTRAINT "runs_passed_tests_non_negative" CHECK (passed_tests >= 0);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_failed_tests_non_negative" CHECK (failed_tests >= 0);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_skipped_tests_non_negative" CHECK (skipped_tests >= 0);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_total_tests_non_negative" CHECK (total_tests >= 0);--> statement-breakpoint

-- A4: Trigger to verify test.run_id matches suite.run_id
CREATE OR REPLACE FUNCTION verify_test_run_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.suite_id IS NOT NULL AND NEW.run_id != (SELECT run_id FROM suites WHERE id = NEW.suite_id) THEN
    RAISE EXCEPTION 'test.run_id (%) does not match suite.run_id for suite %', NEW.run_id, NEW.suite_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS "verify_test_run_consistency_trigger" ON "tests";--> statement-breakpoint
CREATE TRIGGER "verify_test_run_consistency_trigger"
  BEFORE INSERT OR UPDATE ON "tests"
  FOR EACH ROW
  EXECUTE FUNCTION verify_test_run_consistency();
