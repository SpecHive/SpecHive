-- 0006_schema_alignment: align Drizzle schema with DB (NOT NULL on metadata, retry_count; FK for parent_suite_id)

-- runs.metadata: backfill NULLs then set NOT NULL
UPDATE runs SET metadata = '{}'::jsonb WHERE metadata IS NULL;
ALTER TABLE runs ALTER COLUMN metadata SET NOT NULL;

-- tests.retry_count: backfill NULLs then set NOT NULL
UPDATE tests SET retry_count = 0 WHERE retry_count IS NULL;
ALTER TABLE tests ALTER COLUMN retry_count SET NOT NULL;

-- suites.parent_suite_id: add FK if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'suites'
      AND constraint_name = 'suites_parent_suite_id_suites_id_fk'
  ) THEN
    ALTER TABLE suites
      ADD CONSTRAINT suites_parent_suite_id_suites_id_fk
      FOREIGN KEY (parent_suite_id) REFERENCES suites(id) ON DELETE SET NULL;
  END IF;
END
$$;
