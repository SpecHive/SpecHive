export const METRICS_SERVICE = Symbol('METRICS_SERVICE');

// Fixed: Prometheus scrape targets in docker/prometheus/prometheus.yml and container
// `expose` in docker-compose.yml both hardcode this port. Changing it requires
// updating all three places in lockstep.
export const METRICS_PORT = 9464;

export const DEFAULT_HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export interface MetricsModuleOptions {
  enabled: boolean;
  serviceName: string;
  defaultBuckets?: number[];
  collectDefaultMetrics?: boolean;
}
