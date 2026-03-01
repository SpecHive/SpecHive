// Centralised injection token — import this symbol in both ingestion-api and worker
// instead of defining local Symbols, so the same reference is always used.
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

// Metadata key used by auth guards to skip authentication on specific routes
export const IS_PUBLIC_KEY = 'isPublic';
