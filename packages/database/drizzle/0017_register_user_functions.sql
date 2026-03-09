-- SECURITY DEFINER functions for user registration --------------------------
-- These functions bypass RLS so the query-api can register new users and
-- check email availability before the tenant context is known.

CREATE OR REPLACE FUNCTION register_user(
  p_org_id uuid,
  p_user_id uuid,
  p_membership_id uuid,
  p_email text,
  p_password_hash varchar(255),
  p_name text,
  p_org_name text,
  p_org_slug text
)
RETURNS TABLE(org_id uuid, user_id uuid, membership_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.organizations (id, name, slug)
  VALUES (p_org_id, p_org_name, p_org_slug);

  INSERT INTO public.users (id, email, password_hash, name)
  VALUES (p_user_id, p_email, p_password_hash, p_name);

  INSERT INTO public.memberships (id, organization_id, user_id, role)
  VALUES (p_membership_id, p_org_id, p_user_id, 'owner');

  RETURN QUERY SELECT p_org_id, p_user_id, p_membership_id;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION register_user(uuid, uuid, uuid, text, varchar(255), text, text, text) TO assertly_app;
