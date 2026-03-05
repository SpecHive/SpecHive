CREATE INDEX "tests_flaky_run_idx" ON "tests" USING btree ("run_id") WHERE status = 'flaky';
