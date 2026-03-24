ALTER TABLE "runs" ADD CONSTRAINT "runs_flaky_tests_non_negative" CHECK (flaky_tests >= 0);
