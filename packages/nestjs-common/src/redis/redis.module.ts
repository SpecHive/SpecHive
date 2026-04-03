import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Module,
  type OptionalFactoryDependency,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../constants';

import { RedisPubSubService } from './redis-pubsub.service';
import { RedisShutdownService } from './redis-shutdown.service';

@Global()
@Module({})
export class RedisModule {
  static forRootAsync<T extends unknown[]>(options: {
    inject: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (...args: T) => unknown | Promise<unknown>;
  }): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS_CLIENT,
          inject: options.inject,
          useFactory: options.useFactory,
        },
        RedisShutdownService,
        RedisPubSubService,
      ],
      exports: [REDIS_CLIENT, RedisPubSubService],
    };
  }

  static forRootFromEnv(): DynamicModule {
    return RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 3,
        });
        redis.on('error', () => {
          // Swallowed — per-command errors are caught in consumers
        });
        return redis;
      },
    });
  }
}
