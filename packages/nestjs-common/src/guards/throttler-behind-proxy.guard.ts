import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Proxy-aware throttler guard that uses the real client IP from X-Forwarded-For.
 * Requires `trustProxy: true` on the FastifyAdapter (set in bootstrapNestApp).
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ThrottlerGuard parent signature requires Record<string, any>
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.ips?.length ? req.ips[0] : req.ip;
  }
}
