DROP INDEX IF EXISTS "artifacts_pending_cleanup_idx";
DROP FUNCTION IF EXISTS cleanup_stale_pending_artifacts();
