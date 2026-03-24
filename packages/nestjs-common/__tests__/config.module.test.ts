import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { createConfigModule } from '../src/config/config.module';

// Capture the options passed to NestConfigModule.forRoot so we can extract
// and invoke the validate callback directly without bootstrapping NestJS.
function captureValidateFn(
  schema: z.ZodType<Record<string, unknown>>,
): (config: Record<string, unknown>) => Record<string, unknown> {
  let capturedValidate: ((config: Record<string, unknown>) => Record<string, unknown>) | undefined;

  const spy = vi.spyOn(NestConfigModule, 'forRoot').mockImplementation((options) => {
    capturedValidate = options?.validate as (
      config: Record<string, unknown>,
    ) => Record<string, unknown>;
    return Promise.resolve({ module: class {} });
  });

  createConfigModule(schema);
  spy.mockRestore();

  if (!capturedValidate) {
    throw new Error('validate function was not captured — NestConfigModule.forRoot was not called');
  }

  return capturedValidate;
}

describe('createConfigModule', () => {
  const simpleSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('returned DynamicModule shape', () => {
    it('returns an object with module, imports, and exports properties', () => {
      const mod = createConfigModule(simpleSchema);

      expect(mod).toHaveProperty('module');
      expect(mod).toHaveProperty('imports');
      expect(mod).toHaveProperty('exports');
    });

    it('includes exactly one entry in imports (the NestConfigModule.forRoot promise)', () => {
      const mod = createConfigModule(simpleSchema);

      expect(Array.isArray(mod.imports)).toBe(true);
      expect(mod.imports).toHaveLength(1);
    });

    it('exports NestConfigModule', () => {
      const mod = createConfigModule(simpleSchema);

      expect(mod.exports).toContain(NestConfigModule);
    });
  });

  describe('Zod validation via the validate callback', () => {
    it('returns parsed data when env is valid', () => {
      const validate = captureValidateFn(simpleSchema);
      const result = validate({ NODE_ENV: 'production', PORT: '8080' });

      expect(result).toEqual({ NODE_ENV: 'production', PORT: 8080 });
    });

    it('applies schema defaults when optional fields are omitted', () => {
      const validate = captureValidateFn(simpleSchema);
      const result = validate({});

      expect(result).toEqual({ NODE_ENV: 'development', PORT: 3000 });
    });

    it('throws a formatted error message when env is invalid', () => {
      const validate = captureValidateFn(simpleSchema);

      expect(() => validate({ NODE_ENV: 'staging' })).toThrow('Invalid environment configuration:');
    });

    it('includes field-level details in the thrown error message', () => {
      const validate = captureValidateFn(simpleSchema);

      let thrownError: Error | undefined;
      try {
        validate({ NODE_ENV: 'bad_value' });
      } catch (err) {
        thrownError = err as Error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain('Invalid environment configuration:');
      // The formatted JSON should reference the failing field
      expect(thrownError?.message).toContain('NODE_ENV');
    });
  });

  describe('ZodEffects compatibility (.refine())', () => {
    it('accepts a schema produced by .refine() without throwing at module-creation time', () => {
      // ZodEffects (produced by .refine()) was a source of a bug where the type
      // constraint rejected ZodEffects even though its runtime behaviour is identical.
      const refinedSchema = simpleSchema.refine((env) => env.PORT > 0, {
        message: 'PORT must be positive',
      });

      expect(() => createConfigModule(refinedSchema)).not.toThrow();
    });

    it('runs the refine predicate — rejects env that fails the refinement', () => {
      const refinedSchema = simpleSchema
        .extend({ PORT: z.coerce.number() })
        .refine((env) => env.PORT > 1024, { message: 'PORT must be above 1024' });

      const validate = captureValidateFn(refinedSchema);

      expect(() => validate({ NODE_ENV: 'test', PORT: '80' })).toThrow(
        'Invalid environment configuration:',
      );
    });

    it('passes env that satisfies the refine predicate', () => {
      const refinedSchema = simpleSchema
        .extend({ PORT: z.coerce.number() })
        .refine((env) => env.PORT > 1024, { message: 'PORT must be above 1024' });

      const validate = captureValidateFn(refinedSchema);
      const result = validate({ NODE_ENV: 'test', PORT: '3000' });

      expect(result).toMatchObject({ NODE_ENV: 'test', PORT: 3000 });
    });
  });
});
