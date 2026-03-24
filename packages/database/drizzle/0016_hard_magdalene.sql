CREATE INDEX "artifacts_created_at_idx" ON "artifacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tests_run_name_idx" ON "tests" USING btree ("run_id","name");--> statement-breakpoint

-- Bypass RLS for cross-tenant artifact cleanup
CREATE OR REPLACE FUNCTION get_expired_artifacts(p_retention_days integer, p_batch_size integer)
RETURNS TABLE(artifact_id uuid, storage_path varchar)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.storage_path
  FROM public.artifacts a
  WHERE a.created_at < NOW() - make_interval(days => p_retention_days)
  ORDER BY a.created_at
  LIMIT p_batch_size;
END;
$$;

GRANT EXECUTE ON FUNCTION get_expired_artifacts(integer, integer) TO spechive_app;

CREATE OR REPLACE FUNCTION delete_artifacts_by_ids(p_artifact_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.artifacts WHERE id = ANY(p_artifact_ids) AND created_at < NOW() - INTERVAL '1 day';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_artifacts_by_ids(uuid[]) TO spechive_app;