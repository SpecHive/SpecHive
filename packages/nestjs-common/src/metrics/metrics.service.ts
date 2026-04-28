import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

import { sanitizeServiceName } from '../utils/sanitize-service-name';

import { DEFAULT_HISTOGRAM_BUCKETS, type MetricsModuleOptions } from './metrics.constants';

/** No-op implementations returned when metrics are disabled. */
const NOOP_COUNTER = { inc: () => {}, labels: () => NOOP_COUNTER } as unknown as Counter<string>;
const NOOP_HISTOGRAM = {
  observe: () => {},
  startTimer: () => () => {},
  labels: () => NOOP_HISTOGRAM,
} as unknown as Histogram<string>;
const NOOP_GAUGE = {
  set: () => {},
  inc: () => {},
  dec: () => {},
  labels: () => NOOP_GAUGE,
  startTimer: () => () => {},
} as unknown as Gauge<string>;

@Injectable()
export class MetricsService {
  readonly enabled: boolean;
  private readonly registry: Registry | null = null;
  private readonly defaultBuckets: number[];

  constructor(options: MetricsModuleOptions) {
    this.enabled = options.enabled;
    this.defaultBuckets = options.defaultBuckets ?? DEFAULT_HISTOGRAM_BUCKETS;

    if (!options.enabled) return;

    this.registry = new Registry();

    // sanitizeServiceName guarantees a non-empty result via its fallback — no conditional needed.
    this.registry.setDefaultLabels({ service: sanitizeServiceName(options.serviceName) });

    if (options.collectDefaultMetrics) {
      collectDefaultMetrics({ register: this.registry });
    }
  }

  createCounter(name: string, help: string, labelNames: string[]): Counter<string> {
    if (!this.registry) return NOOP_COUNTER;
    return new Counter({ name, help, labelNames, registers: [this.registry] });
  }

  createHistogram(
    name: string,
    help: string,
    labelNames: string[],
    buckets?: number[],
  ): Histogram<string> {
    if (!this.registry) return NOOP_HISTOGRAM;
    return new Histogram({
      name,
      help,
      labelNames,
      buckets: buckets ?? this.defaultBuckets,
      registers: [this.registry],
    });
  }

  createGauge(name: string, help: string, labelNames: string[]): Gauge<string> {
    if (!this.registry) return NOOP_GAUGE;
    return new Gauge({ name, help, labelNames, registers: [this.registry] });
  }

  getContentType(): string {
    return this.registry?.contentType ?? 'text/plain; version=0.0.4; charset=utf-8';
  }

  async getMetrics(): Promise<string> {
    if (!this.registry) return '';
    return this.registry.metrics();
  }
}
