import type { Mock } from 'vitest';
import { vi } from 'vitest';

export interface MockPinoLogger {
  info: Mock;
  warn: Mock;
  error: Mock;
  debug: Mock;
  fatal: Mock;
  trace: Mock;
  setContext: Mock;
}

export function createMockPinoLogger(contextName: string): {
  provide: string;
  useValue: MockPinoLogger;
} {
  return {
    provide: `PinoLogger:${contextName}`,
    useValue: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      setContext: vi.fn(),
    },
  };
}
