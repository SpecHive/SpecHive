#!/bin/bash
set -e

# Revoke application table access from the outboxy role.
# Runs after assertly-migrate so that application tables exist.
# Outboxy only needs its own tables (outboxy_*); this script revokes
# access to all known application tables.

DB="${POSTGRES_DB:-assertly}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
  REVOKE SELECT, INSERT, UPDATE, DELETE ON
    organizations, users, memberships, projects, project_tokens,
    runs, suites, tests, artifacts
  FROM outboxy;
EOSQL
