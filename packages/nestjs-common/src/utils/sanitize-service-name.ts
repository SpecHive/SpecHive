/**
 * Sanitize a service name for use as a Prometheus label value and Loki stream label.
 *
 * Prometheus `service` default label (via MetricsService) and Loki `app` label
 * (via createLoggerModule) must produce identical output so Grafana can join
 * traces/logs/metrics by the same identifier. Centralized here so both callsites
 * stay in lockstep if the rules ever change.
 */
export function sanitizeServiceName(name: string | undefined, fallback = 'spechive'): string {
  return (name || fallback).replace(/-/g, '_');
}
