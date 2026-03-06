import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { Provider } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';

/**
 * Convenience wrapper around NestJS Test.createTestingModule with optional mock DB injection.
 */
export function createTestModule(
  providers: Provider[],
  overrides?: { mockDb?: unknown },
): TestingModuleBuilder {
  const allProviders = [...providers];

  if (overrides?.mockDb !== undefined) {
    allProviders.push({
      provide: DATABASE_CONNECTION,
      useValue: overrides.mockDb,
    });
  }

  return Test.createTestingModule({ providers: allProviders });
}
