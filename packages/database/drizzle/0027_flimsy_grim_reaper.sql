ALTER TABLE "test_attempts" ADD COLUMN "error_name" text;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "error_category" text;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "error_expected" text;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "error_actual" text;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD COLUMN "error_location" jsonb;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "error_name" text;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "error_category" text;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "error_expected" text;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "error_actual" text;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "error_location" jsonb;
