#!/bin/bash
set -euo pipefail

DB="${POSTGRES_DB:-assertly}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<-EOSQL
  -- Revoke access to ALL tables from outboxy, then grant back only its own
  REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM outboxy;

  -- Re-grant access to outboxy's own tables
  GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_events, inbox_events TO outboxy;

  -- Allow assertly_app to use Inboxy deduplication
  GRANT SELECT, INSERT ON TABLE inbox_events TO assertly_app;

  DO $$
  DECLARE
    table_count int;
  BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.role_table_grants
    WHERE grantee = 'outboxy'
      AND table_schema = 'public'
      AND table_name NOT IN ('outbox_events', 'inbox_events');
    IF table_count > 0 THEN
      RAISE EXCEPTION 'outboxy role has access to % unexpected tables', table_count;
    END IF;
  END $$;
EOSQL
