import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { throwZodBadRequest } from '../utils/zod-error';

export class ZodValidationPipe<T> implements PipeTransform {
  private readonly isProduction: boolean;

  constructor(
    private readonly schema: z.ZodType<T>,
    isProduction?: boolean,
  ) {
    this.isProduction = isProduction ?? process.env.NODE_ENV === 'production';
  }

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throwZodBadRequest(result.error, 'Invalid request', this.isProduction);
    }
    return result.data;
  }
}
