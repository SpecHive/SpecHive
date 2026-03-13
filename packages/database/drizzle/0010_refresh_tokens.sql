-- Refresh tokens table for JWT revocation (FIX-007)

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER functions bypass RLS (consistent with validate_project_token_by_prefix pattern).
-- refresh_tokens has no organization_id, so standard tenant policy cannot apply.

CREATE OR REPLACE FUNCTION store_refresh_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash varchar(64),
  p_expires_at timestamptz
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, updated_at)
  VALUES (p_id, p_user_id, p_token_hash, p_expires_at, NOW(), NOW());
$$;

CREATE OR REPLACE FUNCTION find_refresh_token_by_hash(p_token_hash varchar(64))
RETURNS TABLE(id uuid, user_id uuid, expires_at timestamptz, revoked_at timestamptz)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at
  FROM refresh_tokens rt
  WHERE rt.token_hash = p_token_hash;
$$;

CREATE OR REPLACE FUNCTION revoke_refresh_token(p_token_hash varchar(64))
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE refresh_tokens
  SET revoked_at = NOW(), updated_at = NOW()
  WHERE token_hash = p_token_hash AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION revoke_all_user_refresh_tokens(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE refresh_tokens
  SET revoked_at = NOW(), updated_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION store_refresh_token(uuid, uuid, varchar, timestamptz) TO spechive_app;
GRANT EXECUTE ON FUNCTION find_refresh_token_by_hash(varchar) TO spechive_app;
GRANT EXECUTE ON FUNCTION revoke_refresh_token(varchar) TO spechive_app;
GRANT EXECUTE ON FUNCTION revoke_all_user_refresh_tokens(uuid) TO spechive_app;
