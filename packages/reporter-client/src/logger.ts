/* eslint-disable no-console -- This module is the centralized console wrapper */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info';

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
};

export function createLogger(level: LogLevel) {
  return {
    info: (...args: unknown[]) => LEVEL_ORDER[level] >= LEVEL_ORDER.info && console.info(...args),
    warn: (...args: unknown[]) => LEVEL_ORDER[level] >= LEVEL_ORDER.warn && console.warn(...args),
    error: (...args: unknown[]) =>
      LEVEL_ORDER[level] >= LEVEL_ORDER.error && console.error(...args),
  };
}

export interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}
