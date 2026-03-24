/**
 * Signals a transient failure that will resolve on retry.
 * Use in any layer — handlers, services, or middleware.
 * Controllers/callers check `instanceof RetryableError` to adjust log severity.
 */
export class RetryableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RetryableError';
  }
}
