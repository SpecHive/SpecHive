import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  createLoggerModule,
  DatabaseModule,
  GLOBAL_RATE_LIMIT_TTL_MS,
  HealthModule,
  IsProductionModule,
  JwtAuthGuard,
  MetricsInterceptor,
  MetricsModule,
  RolesGuard,
  ThrottlerBehindProxyGuard,
} from '@spechive/nestjs-common';

import { StripInternalHeadersMiddleware } from './middleware/strip-internal-headers.middleware';
import { ConfigModule } from './modules/config/config.module';
import { ProxyModule } from './modules/proxy/proxy.module';

const GATEWAY_RATE_LIMIT_MAX = 200;

@Module({
  imports: [
    ConfigModule,
    createLoggerModule(),
    IsProductionModule,
    ThrottlerModule.forRoot([
      {
        ttl: GLOBAL_RATE_LIMIT_TTL_MS,
        limit: GATEWAY_RATE_LIMIT_MAX,
      },
    ]),
    // Required by ProjectTokenGuard — validates project tokens against the database.
    DatabaseModule.forRootFromEnv(),
    HealthModule,
    MetricsModule.forRootFromEnv(),
    ProxyModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StripInternalHeadersMiddleware).forRoutes('*');
  }
}
