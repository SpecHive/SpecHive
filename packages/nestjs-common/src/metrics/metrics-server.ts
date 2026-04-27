import { createServer, type Server } from 'node:http';

import type { MetricsService } from './metrics.service';

// Isolated HTTP server for Prometheus scrape, bound to a separate port so
// /metrics never shares the primary app port — defense-in-depth against
// auth regressions on the public API.
//
// Reachability: on Railway (private networking) this port is reachable by
// every service in the same project over *.railway.internal, but has no
// public ingress unless a domain is explicitly generated for it. On Docker
// Compose, restrict via the `internal` network (see docker-compose.yml).
// Prometheus is the only intended consumer.

const SCRAPE_TIMEOUT_MS = 5_000;

interface MetricsLogger {
  error: (obj: object, msg: string) => void;
}

export async function startMetricsServer(
  metrics: MetricsService,
  port: number,
  logger?: MetricsLogger,
  bindAddress = '0.0.0.0',
): Promise<Server> {
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' || req.url !== '/metrics') {
      res.statusCode = 404;
      res.end('Not found. Metrics available at GET /metrics.\n');
      return;
    }

    try {
      const body = await Promise.race([
        metrics.getMetrics(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('metrics collection timed out')), SCRAPE_TIMEOUT_MS),
        ),
      ]);
      res.statusCode = 200;
      res.setHeader('Content-Type', metrics.getContentType());
      res.end(body);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'metrics collection timed out';
      logger?.error({ err, isTimeout }, 'metrics scrape failed');
      res.statusCode = 500;
      res.end(isTimeout ? 'timeout\n' : 'error\n');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, bindAddress, () => {
      server.off('error', reject);
      resolve();
    });
  });

  // Long-lived error listener — without this, a socket-level error after
  // listen resolves would become an unhandled emitter error and crash the
  // process.
  server.on('error', (err) => logger?.error({ err }, 'metrics server error'));

  return server;
}
