CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Application role subject to Row-Level Security policies.
-- The app connects as this role and must SET LOCAL app.current_organization_id per transaction.
-- NOTE: Password below is a dev-only default. Override with ASSERTLY_APP_PASSWORD in production.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'assertly_app') THEN
    CREATE ROLE assertly_app LOGIN PASSWORD 'assertly_app';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE assertly TO assertly_app;
GRANT USAGE ON SCHEMA public TO assertly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assertly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO assertly_app;

-- Ensure future tables and sequences are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assertly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO assertly_app;
