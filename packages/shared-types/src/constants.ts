export const TOKEN_PREFIX_LENGTH = 16;
export const TOKEN_PLAIN_PREFIX = 'at_';

/**
 * Maximum length for raw error messages stored in the database.
 * Applied by the worker before inserting into error_occurrences.
 */
export const MAX_ERROR_MESSAGE_LENGTH = 10_000;

/**
 * Maximum length for structured error fields extracted by reporters
 * (errorExpected, errorActual, errorTarget). These are parsed substrings,
 * not raw messages, so the limit is tighter than MAX_ERROR_MESSAGE_LENGTH.
 */
export const MAX_ERROR_FIELD_LENGTH = 2_000;
