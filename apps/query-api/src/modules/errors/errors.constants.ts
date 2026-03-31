export const MS_PER_DAY = 86_400_000;

export const ERRORS_MAX_DAYS = 90;
export const ERRORS_SEARCH_MAX_LENGTH = 200;
export const ERRORS_TOP_N_MIN = 1;
export const ERRORS_TOP_N_MAX = 10;
export const ERRORS_TOP_N_DEFAULT = 5;

export const DETAIL_AFFECTED_TESTS_LIMIT = 20;
export const DETAIL_BRANCHES_LIMIT = 10;

export const UI_CATEGORY_OTHER = 'other';

export const ERROR_SORT_FIELDS = [
  'occurrences',
  'uniqueTests',
  'uniqueBranches',
  'lastSeenAt',
  'title',
] as const;
export type ErrorSortField = (typeof ERROR_SORT_FIELDS)[number];
