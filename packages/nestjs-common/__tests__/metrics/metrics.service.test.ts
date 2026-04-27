import { describe, it, expect, beforeEach } from 'vitest';

import { MetricsService } from '../../src/metrics/metrics.service';

describe('MetricsService', () => {
  describe('disabled (no-op mode)', () => {
    let service: MetricsService;

    beforeEach(() => {
      service = new MetricsService({
        enabled: false,
        serviceName: 'test',
        defaultBuckets: [0.1, 0.5, 1],
        collectDefaultMetrics: false,
      });
    });

    it('reports enabled as false', () => {
      expect(service.enabled).toBe(false);
    });

    it('getMetrics returns empty string', async () => {
      const metrics = await service.getMetrics();
      expect(metrics).toBe('');
    });

    it('getContentType returns fallback content type', () => {
      expect(service.getContentType()).toBe('text/plain; version=0.0.4; charset=utf-8');
    });

    it('createCounter returns a no-op that does not throw', () => {
      const counter = service.createCounter('test_total', 'test', ['label']);
      expect(() => counter.inc({ label: 'a' })).not.toThrow();
    });

    it('createHistogram returns a no-op that does not throw', () => {
      const histogram = service.createHistogram('test_duration', 'test', ['label']);
      expect(() => histogram.observe({ label: 'a' }, 0.5)).not.toThrow();
    });

    it('createGauge returns a no-op that does not throw', () => {
      const gauge = service.createGauge('test_gauge', 'test', ['label']);
      expect(() => gauge.set({ label: 'a' }, 5)).not.toThrow();
      expect(() => gauge.inc({ label: 'a' })).not.toThrow();
      expect(() => gauge.dec({ label: 'a' })).not.toThrow();
    });
  });

  describe('enabled mode', () => {
    let service: MetricsService;

    beforeEach(() => {
      service = new MetricsService({
        enabled: true,
        serviceName: 'test-service',
        defaultBuckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1],
        collectDefaultMetrics: false,
      });
    });

    it('reports enabled as true', () => {
      expect(service.enabled).toBe(true);
    });

    it('createCounter creates a working counter', async () => {
      const counter = service.createCounter('spechive_http_requests_total', 'Total requests', [
        'method',
        'status_code',
      ]);
      counter.inc({ method: 'GET', status_code: '200' });
      counter.inc({ method: 'POST', status_code: '201' });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('spechive_http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('method="POST"');
      expect(metrics).toContain('service="test_service"');
    });

    it('createHistogram creates a working histogram', async () => {
      const histogram = service.createHistogram(
        'spechive_http_request_duration_seconds',
        'Duration',
        ['route'],
      );
      histogram.observe({ route: '/api/test' }, 0.05);

      const metrics = await service.getMetrics();
      expect(metrics).toContain('spechive_http_request_duration_seconds');
      expect(metrics).toContain('route="/api/test"');
    });

    it('createGauge creates a working gauge', async () => {
      const gauge = service.createGauge('active_connections', 'Active connections', ['service']);
      gauge.set({ service: 'api' }, 10);

      const metrics = await service.getMetrics();
      expect(metrics).toContain('active_connections');
      expect(metrics).toContain('service="api"');
    });

    it('getContentType returns registry content type', () => {
      expect(service.getContentType()).toBe('text/plain; version=0.0.4; charset=utf-8');
    });

    it('accumulates metrics from multiple counters', async () => {
      const counter = service.createCounter('test_total', 'Test', ['label']);
      counter.inc({ label: 'a' });
      counter.inc({ label: 'a' });
      counter.inc({ label: 'b' });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('test_total');
    });
  });
});
