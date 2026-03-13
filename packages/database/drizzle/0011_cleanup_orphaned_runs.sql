CREATE OR REPLACE FUNCTION cleanup_orphaned_runs()
RETURNS TABLE(run_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.runs
  SET status = 'cancelled', finished_at = NOW(), updated_at = NOW()
  WHERE status IN ('pending', 'running')
    AND created_at < NOW() - INTERVAL '24 hours'
  RETURNING id;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_orphaned_runs() TO spechive_app;
