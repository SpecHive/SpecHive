/**
 * pino-pretty is a devDependency — unavailable in production Docker images.
 * When those images run with NODE_ENV≠production (e.g. cloud dev compose),
 * we fall back to JSON output on stdout instead of crashing.
 *
 * Pino v10 transports run in worker_threads and have no optional/fallback
 * mechanism. require.resolve is the standard Node.js pattern for checking
 * optional dependency availability before passing a transport target.
 */
export function isPinoPrettyAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}
