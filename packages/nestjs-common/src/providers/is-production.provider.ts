import { ConfigService } from '@nestjs/config';

export const IS_PRODUCTION = Symbol('IS_PRODUCTION');

export const isProductionProvider = {
  provide: IS_PRODUCTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService): boolean => config.get<string>('NODE_ENV') === 'production',
};
