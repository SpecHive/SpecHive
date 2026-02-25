#!/bin/bash
set -e

# Application role subject to Row-Level Security policies.
# The app connects as this role and must SET LOCAL app.current_organization_id per transaction.
# Password is sourced from ASSERTLY_APP_PASSWORD (default: assertly_app for local dev).
ASSERTLY_APP_PASSWORD="${ASSERTLY_APP_PASSWORD:-assertly_app}"
DB="${POSTGRES_DB:-assertly}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'assertly_app') THEN
      CREATE ROLE assertly_app LOGIN PASSWORD '$ASSERTLY_APP_PASSWORD';
    ELSE
      ALTER ROLE assertly_app PASSWORD '$ASSERTLY_APP_PASSWORD';
    END IF;
  END
  \$\$;

  GRANT CONNECT ON DATABASE $DB TO assertly_app;
  GRANT USAGE ON SCHEMA public TO assertly_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assertly_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO assertly_app;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assertly_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO assertly_app;
EOSQL
