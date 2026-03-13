-- Harden refresh_tokens: FORCE RLS + lock down SECURITY DEFINER search_path
-- Migration 0010 used SET search_path = public — the hardened form is SET search_path = ''
-- with fully-qualified table references (public.refresh_tokens).
--
-- Design note: RLS is ENABLED + FORCED but NO row-level policy exists.
-- This is intentional — refresh_tokens has no organization_id column, so a
-- standard tenant-scoping policy cannot apply. All access goes through the
-- four SECURITY DEFINER functions below, which bypass RLS by definition.
-- FORCE RLS ensures that even the table owner cannot read rows directly,
-- making the SECURITY DEFINER functions the only access path.

ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;

-- Recreate all 4 SECURITY DEFINER functions with search_path = '' and public-qualified table refs

CREATE OR REPLACE FUNCTION store_refresh_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash varchar(64),
  p_expires_at timestamptz
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.refresh_tokens (id, user_id, token_hash, expires_at, created_at, updated_at)
  VALUES (p_id, p_user_id, p_token_hash, p_expires_at, NOW(), NOW());
$$;

CREATE OR REPLACE FUNCTION find_refresh_token_by_hash(p_token_hash varchar(64))
RETURNS TABLE(id uuid, user_id uuid, expires_at timestamptz, revoked_at timestamptz)
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at
  FROM public.refresh_tokens rt
  WHERE rt.token_hash = p_token_hash;
$$;

CREATE OR REPLACE FUNCTION revoke_refresh_token(p_token_hash varchar(64))
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.refresh_tokens
  SET revoked_at = NOW(), updated_at = NOW()
  WHERE token_hash = p_token_hash AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION revoke_all_user_refresh_tokens(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.refresh_tokens
  SET revoked_at = NOW(), updated_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;
$$;

-- Re-grant execute to app role (CREATE OR REPLACE preserves GRANTs but be explicit)
GRANT EXECUTE ON FUNCTION store_refresh_token(uuid, uuid, varchar, timestamptz) TO assertly_app;
GRANT EXECUTE ON FUNCTION find_refresh_token_by_hash(varchar) TO assertly_app;
GRANT EXECUTE ON FUNCTION revoke_refresh_token(varchar) TO assertly_app;
GRANT EXECUTE ON FUNCTION revoke_all_user_refresh_tokens(uuid) TO assertly_app;
