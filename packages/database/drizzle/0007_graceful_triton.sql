ALTER TABLE "runs" ADD COLUMN "flaky_tests" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "artifacts_pending_cleanup_idx" ON "artifacts" USING btree ("created_at") WHERE storage_path LIKE 'pending://%';--> statement-breakpoint
CREATE INDEX "tests_run_created_idx" ON "tests" USING btree ("run_id","created_at");