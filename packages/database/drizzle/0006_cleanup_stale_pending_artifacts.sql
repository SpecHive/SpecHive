CREATE OR REPLACE FUNCTION cleanup_stale_pending_artifacts()
RETURNS TABLE(artifact_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.artifacts
  SET storage_path = 'failed://unretrievable'
  WHERE storage_path LIKE 'pending://%'
    AND created_at < NOW() - INTERVAL '1 hour'
  RETURNING id;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION cleanup_stale_pending_artifacts() TO spechive_app;
