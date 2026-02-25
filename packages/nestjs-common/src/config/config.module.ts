import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import type { ZodObject, ZodRawShape } from 'zod';
import type { z } from 'zod';

function buildValidate<T extends ZodRawShape>(schema: ZodObject<T>) {
  return (config: Record<string, unknown>): z.infer<ZodObject<T>> => {
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
 */
export function createConfigModule<T extends ZodRawShape>(schema: ZodObject<T>): DynamicModule {
  @Module({})
  class DynamicConfigModule {}

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
