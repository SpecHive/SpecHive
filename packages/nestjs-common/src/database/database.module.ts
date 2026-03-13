import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Module,
  type OptionalFactoryDependency,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDbConnection } from '@spechive/database';

import { DATABASE_CONNECTION } from '../constants';

import { DatabaseShutdownService } from './database-shutdown.service';

@Global()
@Module({})
export class DatabaseModule {
  static forRootAsync<T extends unknown[]>(options: {
    inject: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (...args: T) => unknown | Promise<unknown>;
  }): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE_CONNECTION,
          inject: options.inject,
          useFactory: options.useFactory,
        },
        DatabaseShutdownService,
      ],
      exports: [DATABASE_CONNECTION],
    };
  }

  static forRootFromEnv(): DynamicModule {
    return DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        return createDbConnection(databaseUrl);
      },
    });
  }
}
