import {
  type DynamicModule,
  Global,
  type InjectionToken,
  Module,
  type OptionalFactoryDependency,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DbMetricsService } from './db-metrics.service';
import { METRICS_SERVICE, type MetricsModuleOptions } from './metrics.constants';
import { MetricsService } from './metrics.service';

@Global()
@Module({})
export class MetricsModule {
  static forRootAsync<T extends unknown[]>(options: {
    inject: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (...args: T) => MetricsModuleOptions | Promise<MetricsModuleOptions>;
  }): DynamicModule {
    return {
      module: MetricsModule,
      providers: [
        {
          provide: METRICS_SERVICE,
          inject: options.inject,
          useFactory: async (...args: T) => new MetricsService(await options.useFactory(...args)),
        },
        DbMetricsService,
      ],
      exports: [METRICS_SERVICE],
    };
  }

  static forRootFromEnv(): DynamicModule {
    return MetricsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Opt-out: metrics enabled unless explicitly disabled. Gates both the
        // app's custom metrics and prom-client's default Node.js runtime metrics
        // (GC, heap, event loop, FDs). Grafana alerts EventLoopBlocked and
        // HighMemoryUsage depend on the default set, so they move together.
        const enabled = config.get<string>('METRICS_ENABLED') !== 'false';
        return {
          enabled,
          serviceName: config.getOrThrow<string>('SERVICE_NAME'),
          collectDefaultMetrics: enabled,
        };
      },
    });
  }
}
