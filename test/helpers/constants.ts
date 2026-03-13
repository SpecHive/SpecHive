/** Deterministic UUIDv7-like IDs matching integration-global-setup.ts */
export const SEED_ORG_ID = '01970000-0000-7000-8000-000000000001';
export const SEED_PROJECT_ID = '01970000-0000-7000-8000-000000000002';
export const SEED_TOKEN_ID = '01970000-0000-7000-8000-000000000003';
export const SEED_USER_ID = '01970000-0000-7000-8000-000000000004';
export const SEED_MEMBERSHIP_ID = '01970000-0000-7000-8000-000000000005';
export const SEED_ORG2_ID = '01970000-0000-7000-8000-000000000006';

export const SEED_EMAIL = 'test-user@spechive.dev';
export const SEED_PASSWORD = 'test-password';
export const PROJECT_TOKEN = 'test-token';

export const INGESTION_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
export const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';
export const WORKER_URL = process.env['WORKER_URL'] ?? 'http://localhost:3001';
