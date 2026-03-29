import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { REDIS_CLIENT } from '../constants';

interface RedisLike {
  quit(): Promise<string>;
}

@Injectable()
export class RedisShutdownService implements OnModuleDestroy {
  constructor(
    @InjectPinoLogger(RedisShutdownService.name) private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisLike,
  ) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.info('Redis connection closed');
    } catch {
      this.logger.warn('Failed to close Redis connection gracefully');
    }
  }
}
