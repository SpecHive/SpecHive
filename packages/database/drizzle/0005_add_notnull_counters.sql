-- Add NOT NULL constraints to run counter columns (were nullable despite DEFAULT 0)
ALTER TABLE runs ALTER COLUMN total_tests SET NOT NULL;
ALTER TABLE runs ALTER COLUMN passed_tests SET NOT NULL;
ALTER TABLE runs ALTER COLUMN failed_tests SET NOT NULL;
ALTER TABLE runs ALTER COLUMN skipped_tests SET NOT NULL;
