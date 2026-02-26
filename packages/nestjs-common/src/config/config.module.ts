import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import type { z } from 'zod';

// Defined outside createConfigModule so NestJS module dedup works correctly.
@Module({})
class DynamicConfigModule {}

function buildValidate(schema: z.ZodType<Record<string, unknown>>) {
  return (config: Record<string, unknown>): Record<string, unknown> => {
    const result = schema.safeParse(config);

    if (!result.success) {
      const formatted = result.error.format();
      throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted, null, 2)}`);
    }

    return result.data;
  };
}

/**
 * Creates an app-level NestJS ConfigModule pre-wired with zod validation.
 * Pass your app's full envSchema (typically baseEnvSchema.extend({...})) as the argument.
 * Accepts any ZodType whose output is a string-keyed record, including ZodEffects from .refine().
 */
export function createConfigModule(schema: z.ZodType<Record<string, unknown>>): DynamicModule {
  return {
    module: DynamicConfigModule,
    imports: [
      NestConfigModule.forRoot({
        isGlobal: true,
        validate: buildValidate(schema),
      }),
    ],
    exports: [NestConfigModule],
  };
}
