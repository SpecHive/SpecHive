import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Proxy-aware throttler guard that uses the real client IP from X-Forwarded-For.
 * Parses the header directly for reliability across Fastify/Express adapters.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ThrottlerGuard parent signature requires Record<string, any>
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',')[0]!.trim();
    if (req.ips?.length) return req.ips[0];
    return req.ip;
  }
}
