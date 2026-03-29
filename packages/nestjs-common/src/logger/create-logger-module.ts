import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';

export function createLoggerModule(): DynamicModule {
  const isProduction = process.env.NODE_ENV === 'production';

  const params: Params = {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      ...(isProduction ? {} : { transport: { target: 'pino-pretty' } }),
    },
  };

  return LoggerModule.forRoot(params);
}
