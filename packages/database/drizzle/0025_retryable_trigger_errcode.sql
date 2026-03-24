-- Update verify_test_run_consistency trigger to use ERRCODE '23503' for
-- the suite existence check. This allows the worker's isRetryablePgError()
-- to auto-classify the error as retryable (cross-batch Outboxy ordering).
-- The run_id mismatch case keeps default P0001 — a permanent data integrity error.

CREATE OR REPLACE FUNCTION verify_test_run_consistency()
RETURNS TRIGGER AS $$
DECLARE
  suite_run_id uuid;
BEGIN
  IF NEW.suite_id IS NOT NULL THEN
    SELECT run_id INTO suite_run_id FROM suites WHERE id = NEW.suite_id;
    IF NOT FOUND THEN
      -- Use 23503 (foreign_key_violation) — this IS a FK check, and the code
      -- matches DEFAULT_RETRYABLE_PG_CODES for automatic retry classification.
      RAISE EXCEPTION 'suite % does not exist', NEW.suite_id
        USING ERRCODE = '23503';
    END IF;
    IF NEW.run_id != suite_run_id THEN
      RAISE EXCEPTION 'test.run_id (%) does not match suite.run_id for suite %', NEW.run_id, NEW.suite_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
