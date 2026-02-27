import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function throwZodBadRequest(error: z.ZodError, label: string, isProduction: boolean): never {
  const message = isProduction ? label : `${label}: ${JSON.stringify(z.flattenError(error))}`;
  throw new BadRequestException({ message });
}
