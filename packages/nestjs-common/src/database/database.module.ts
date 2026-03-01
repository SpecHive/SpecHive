import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Module,
  type OptionalFactoryDependency,
} from '@nestjs/common';

import { DATABASE_CONNECTION } from '../constants';

@Global()
@Module({})
export class DatabaseModule {
  static forRootAsync(options: {
    inject: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (...args: never[]) => unknown | Promise<unknown>;
  }): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE_CONNECTION,
          inject: options.inject,
          useFactory: options.useFactory,
        },
      ],
      exports: [DATABASE_CONNECTION],
    };
  }
}
