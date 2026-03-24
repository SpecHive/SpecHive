-- SECURITY DEFINER functions for user authentication -------------------------
-- These functions bypass RLS so the query-api can authenticate users and
-- list their organizations before the tenant context is known.

CREATE OR REPLACE FUNCTION authenticate_user_by_email(p_email text)
RETURNS TABLE(id uuid, email varchar, password_hash varchar, name varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, u.email, u.password_hash, u.name
  FROM public.users u
  WHERE u.email = p_email;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id uuid)
RETURNS TABLE(organization_id uuid, organization_name varchar, organization_slug varchar, role membership_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.organization_id, o.name, o.slug, m.role
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = p_user_id;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION authenticate_user_by_email(text) TO spechive_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION get_user_organizations(uuid) TO spechive_app;