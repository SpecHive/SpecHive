#!/bin/bash
set -euo pipefail

# Application role subject to Row-Level Security policies.
# The app connects as this role and must SET LOCAL app.current_organization_id per transaction.
# Password is sourced from SPECHIVE_APP_PASSWORD (default: spechive_app for local dev).
SPECHIVE_APP_PASSWORD="${SPECHIVE_APP_PASSWORD:-spechive_app}"
OUTBOXY_PASSWORD="${OUTBOXY_PASSWORD:-outboxy}"
DB="${POSTGRES_DB:-spechive}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$DB" \
  --set spechive_app_pw="$SPECHIVE_APP_PASSWORD" \
  --set outboxy_pw="$OUTBOXY_PASSWORD" \
  --set db="$DB" \
  --set su="$POSTGRES_USER" <<-'EOSQL'
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Application role (subject to RLS)
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'spechive_app') THEN
      CREATE ROLE spechive_app LOGIN PASSWORD :'spechive_app_pw';
    ELSE
      ALTER ROLE spechive_app PASSWORD :'spechive_app_pw';
    END IF;
  END
  $$;

  GRANT CONNECT ON DATABASE :"db" TO spechive_app;
  GRANT USAGE ON SCHEMA public TO spechive_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO spechive_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO spechive_app;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO spechive_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO spechive_app;

  -- Outboxy role — restricted to outbox tables only.
  -- ALTER DEFAULT PRIVILEGES grants access to ALL future tables created by the superuser,
  -- including application tables created by spechive-migrate. The restrict-outboxy
  -- docker-compose service revokes access to application tables after migrations complete.
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outboxy') THEN
      CREATE ROLE outboxy LOGIN PASSWORD :'outboxy_pw';
    ELSE
      ALTER ROLE outboxy PASSWORD :'outboxy_pw';
    END IF;
  END
  $$;

  GRANT CONNECT ON DATABASE :"db" TO outboxy;
  GRANT USAGE ON SCHEMA public TO outboxy;

  ALTER DEFAULT PRIVILEGES FOR ROLE :"su" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO outboxy;
  ALTER DEFAULT PRIVILEGES FOR ROLE :"su" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO outboxy;
EOSQL
