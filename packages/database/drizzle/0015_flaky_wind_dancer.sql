ALTER TABLE "runs" ADD COLUMN "branch" varchar(500);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "commit_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "ci_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "ci_url" text;--> statement-breakpoint
CREATE INDEX "runs_project_branch_idx" ON "runs" USING btree ("project_id","branch");