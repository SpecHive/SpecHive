import { Controller, HttpException, HttpStatus, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common/interfaces';
import type { UserContext } from '@spechive/nestjs-common';
import { RedisPubSubService } from '@spechive/nestjs-common/redis';
import { Observable } from 'rxjs';

import { CurrentUser } from '../../decorators/current-user.decorator';

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONNECTIONS_PER_ORG = 50;

@Controller('v1/sse')
export class SseController {
  private readonly connectionCounts = new Map<string, number>();

  constructor(private readonly pubsub: RedisPubSubService) {}

  /**
   * SSE endpoint — one connection per browser tab per authenticated user.
   * Each connection holds one Redis subscription scoped to the user's org.
   * Capped at MAX_CONNECTIONS_PER_ORG concurrent connections per org to
   * prevent file descriptor exhaustion from runaway clients.
   */
  @Sse('events')
  events(@CurrentUser() user: UserContext): Observable<MessageEvent> {
    const orgId = user.organizationId;
    const currentCount = this.connectionCounts.get(orgId) ?? 0;

    if (currentCount >= MAX_CONNECTIONS_PER_ORG) {
      throw new HttpException(
        'Too many SSE connections for this organization',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.connectionCounts.set(orgId, currentCount + 1);
    const channel = `sse:${orgId}`;

    return new Observable((subscriber) => {
      const unsubscribe = this.pubsub.subscribe(channel, (message) => {
        subscriber.next({ data: JSON.stringify(message), type: 'notification' });
      });

      const heartbeat = setInterval(() => {
        subscriber.next({ data: '', type: 'heartbeat' });
      }, HEARTBEAT_INTERVAL_MS);

      return () => {
        const count = (this.connectionCounts.get(orgId) ?? 1) - 1;
        if (count <= 0) {
          this.connectionCounts.delete(orgId);
        } else {
          this.connectionCounts.set(orgId, count);
        }
        unsubscribe();
        clearInterval(heartbeat);
      };
    });
  }
}
