import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { REDIS_CLIENT } from '../constants';

interface RedisLike {
  quit(): Promise<string>;
}

@Injectable()
export class RedisShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisShutdownService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisLike,
  ) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    } catch {
      this.logger.warn('Failed to close Redis connection gracefully');
    }
  }
}
