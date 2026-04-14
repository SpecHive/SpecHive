DROP INDEX "suites_run_name_idx";--> statement-breakpoint
ALTER TABLE "suites" ADD CONSTRAINT "suites_run_name_parent_unique" UNIQUE NULLS NOT DISTINCT("run_id","name","parent_suite_id");