import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';
import { REDIS_CLIENT } from '@spechive/nestjs-common/redis';
import type { Redis } from 'ioredis';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_SECONDS = 900; // 15 minutes
const KEY_PREFIX = 'login:ratelimit:';

/**
 * Redis-backed login rate limiting — tracks failed login attempts per email
 * and blocks further attempts after exceeding the threshold within the window.
 * Fails open: if Redis is unavailable, login attempts are allowed through.
 */
@Injectable()
export class LoginRateLimitService {
  constructor(
    @InjectPinoLogger(LoginRateLimitService.name) private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isBlocked(email: string): Promise<boolean> {
    try {
      const count = await this.redis.get(this.key(email));
      return count !== null && parseInt(count, 10) >= MAX_FAILED_ATTEMPTS;
    } catch (error) {
      this.logger.warn({ err: error }, 'Redis unavailable for rate-limit check');
      return false;
    }
  }

  async recordFailure(email: string): Promise<void> {
    try {
      const key = this.key(email);
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, WINDOW_SECONDS, 'NX');
      await pipeline.exec();
    } catch (error) {
      this.logger.warn({ err: error }, 'Redis unavailable for recording failure');
    }
  }

  async recordSuccess(email: string): Promise<void> {
    try {
      await this.redis.del(this.key(email));
    } catch (error) {
      this.logger.warn({ err: error }, 'Redis unavailable for clearing rate-limit');
    }
  }

  private key(email: string): string {
    return `${KEY_PREFIX}${email.toLowerCase()}`;
  }
}
