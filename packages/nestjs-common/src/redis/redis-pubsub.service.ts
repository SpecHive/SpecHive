import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { REDIS_CLIENT } from '../constants';

type MessageCallback = (message: unknown) => void;

/**
 * Lightweight Redis pub/sub wrapper for SSE event distribution.
 *
 * Uses the injected REDIS_CLIENT for publishing. Creates a lazy duplicate
 * connection for subscribing (ioredis requirement: subscribed clients
 * cannot run other commands).
 *
 * All operations are fail-silent — if Redis is unavailable, events are
 * dropped. SSE notifications are best-effort.
 */
@Injectable()
export class RedisPubSubService implements OnModuleDestroy {
  private subscriber: Redis | null = null;
  private subscriberPromise: Promise<void> | null = null;
  private readonly channelCallbacks = new Map<string, Set<MessageCallback>>();
  private readonly subscribedChannels = new Set<string>();

  constructor(
    @InjectPinoLogger(RedisPubSubService.name) private readonly logger: PinoLogger,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async publish(channel: string, message: object): Promise<void> {
    try {
      await this.redis.publish(channel, JSON.stringify(message));
    } catch (error) {
      this.logger.warn({ err: error, channel }, 'Failed to publish SSE event');
    }
  }

  /**
   * Subscribe to a Redis channel. Returns an unsubscribe function.
   * The subscriber connection is created lazily on first subscription.
   */
  subscribe(channel: string, callback: MessageCallback): () => void {
    let callbacks = this.channelCallbacks.get(channel);
    if (!callbacks) {
      callbacks = new Set();
      this.channelCallbacks.set(channel, callbacks);
    }
    callbacks.add(callback);

    if (!this.subscribedChannels.has(channel)) {
      this.ensureSubscriber()
        .then(() => this.subscribeToChannel(channel))
        .then(() => {
          this.subscribedChannels.add(channel);
        })
        .catch((err) => {
          this.logger.warn({ err, channel }, 'Failed to set up subscription');
        });
    }

    return () => {
      callbacks!.delete(callback);
      if (callbacks!.size === 0) {
        this.channelCallbacks.delete(channel);
        this.subscribedChannels.delete(channel);
        this.unsubscribeFromChannel(channel);
      }
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch {
        this.logger.warn('Failed to close Redis subscriber connection');
      }
      this.subscriber = null;
    }
    this.subscriberPromise = null;
    this.channelCallbacks.clear();
    this.subscribedChannels.clear();
  }

  private ensureSubscriber(): Promise<void> {
    if (!this.subscriberPromise) {
      this.subscriberPromise = this.createSubscriber().catch((err) => {
        this.subscriberPromise = null;
        throw err;
      });
    }
    return this.subscriberPromise;
  }

  private createSubscriber(): Promise<void> {
    this.subscriber = this.redis.duplicate();
    let initialReady = false;

    return new Promise<void>((resolve, reject) => {
      this.subscriber!.on('error', (err) => {
        this.logger.warn({ err }, 'Redis subscriber connection error');
      });

      this.subscriber!.on('end', () => {
        this.logger.warn('Redis subscriber connection ended — will reconnect on next subscription');
        this.subscriber = null;
        this.subscriberPromise = null;
        this.subscribedChannels.clear();
        if (!initialReady) {
          reject(new Error('Redis subscriber connection ended before ready'));
        }
      });

      this.subscriber!.on('ready', () => {
        if (!initialReady) {
          initialReady = true;
          resolve();
          return;
        }

        // Reconnection — resubscribe to all active channels
        for (const channel of this.channelCallbacks.keys()) {
          this.subscribeToChannel(channel)
            .then(() => {
              this.subscribedChannels.add(channel);
            })
            .catch((err) => {
              this.logger.warn({ err, channel }, 'Failed to resubscribe after reconnect');
            });
        }
      });

      this.subscriber!.on('message', (channel: string, message: string) => {
        const callbacks = this.channelCallbacks.get(channel);
        if (!callbacks) return;

        let parsed: unknown;
        try {
          parsed = JSON.parse(message);
        } catch {
          this.logger.warn({ channel }, 'Failed to parse pub/sub message');
          return;
        }

        for (const cb of callbacks) {
          try {
            cb(parsed);
          } catch (error) {
            this.logger.warn({ err: error, channel }, 'SSE callback error');
          }
        }
      });
    });
  }

  private async subscribeToChannel(channel: string): Promise<void> {
    try {
      await this.subscriber?.subscribe(channel);
    } catch (error) {
      this.logger.warn({ err: error, channel }, 'Failed to subscribe to channel');
    }
  }

  private async unsubscribeFromChannel(channel: string): Promise<void> {
    try {
      await this.subscriber?.unsubscribe(channel);
    } catch (error) {
      this.logger.warn({ err: error, channel }, 'Failed to unsubscribe from channel');
    }
  }
}
