DROP INDEX "suites_run_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "suites_run_name_idx" ON "suites" USING btree ("run_id","name");