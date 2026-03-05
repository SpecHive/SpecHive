ALTER TABLE projects DROP COLUMN slug;--> statement-breakpoint
CREATE UNIQUE INDEX projects_org_name_idx ON projects(organization_id, name);--> statement-breakpoint

-- Update validate_project_token_by_prefix to also return revoked_at (Ticket 1.4)
DROP FUNCTION IF EXISTS validate_project_token_by_prefix(text);--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_project_token_by_prefix(p_token_prefix text)
RETURNS TABLE(token_hash varchar, project_id uuid, organization_id uuid, revoked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pt.token_hash, pt.project_id, pt.organization_id, pt.revoked_at
  FROM public.project_tokens pt
  WHERE pt.token_prefix = p_token_prefix AND pt.revoked_at IS NULL;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION validate_project_token_by_prefix(text) TO assertly_app;
