import {
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor,
  type CallHandler,
} from '@nestjs/common';
import type { Counter, Histogram } from 'prom-client';
import { throwError, type Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { INTERNAL_ROUTE_PATHS } from '../constants';

import { METRICS_SERVICE } from './metrics.constants';
import { MetricsService } from './metrics.service';

const EXCLUDED_ROUTES = new Set<string>(INTERNAL_ROUTE_PATHS);

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly httpRequestTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;

  // Not @Optional — MetricsModule must be imported in every app (loud failure preferred over silent no-op)
  constructor(@Inject(METRICS_SERVICE) private readonly metricsService: MetricsService) {
    this.httpRequestTotal = metricsService.createCounter(
      'spechive_http_requests_total',
      'Total number of HTTP requests',
      ['method', 'route', 'status_code'],
    );
    this.httpRequestDuration = metricsService.createHistogram(
      'spechive_http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'route', 'status_code'],
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.metricsService.enabled) {
      return next.handle();
    }

    const http = context.switchToHttp();
    // Fastify route pattern (routeOptions.url) — prevents URL cardinality explosion
    const request = http.getRequest<{ method: string; routeOptions?: { url?: string } }>();
    const reply = http.getResponse<{ statusCode: number }>();

    const route = request.routeOptions?.url ?? 'unknown';

    if (EXCLUDED_ROUTES.has(route)) {
      return next.handle();
    }

    const method = request.method;
    const start = performance.now();

    const record = (statusCode: number) => {
      const durationSeconds = (performance.now() - start) / 1000;
      const labels = { method, route, status_code: String(statusCode) };
      this.httpRequestTotal.inc(labels);
      this.httpRequestDuration.observe(labels, durationSeconds);
    };

    return next.handle().pipe(
      tap(() => record(reply.statusCode)),
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        record(status);
        return throwError(() => error);
      }),
    );
  }
}
