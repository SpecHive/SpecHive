import type { V1Event } from '@spechive/reporter-core-protocol';

import type { SpecHiveClient } from './client.js';

const DEFAULT_MAX_QUEUE_SIZE = 10_000;

export interface QueueOptions {
  flushTimeout: number;
  maxQueueSize?: number;
}

export interface QueueStats {
  readonly eventsSent: number;
  readonly eventsFailed: number;
  readonly retriesTotal: number;
}

export class ReporterQueue {
  private readonly items: V1Event[] = [];
  private processing = false;
  private readonly drainCallbacks = new Set<() => void>();
  private readonly maxQueueSize: number;
  private readonly flushTimeout: number;

  private _eventsSent = 0;
  private _eventsFailed = 0;
  private _retriesTotal = 0;

  constructor(
    private readonly client: SpecHiveClient,
    options: QueueOptions,
  ) {
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.flushTimeout = options.flushTimeout;
  }

  get stats(): QueueStats {
    return {
      eventsSent: this._eventsSent,
      eventsFailed: this._eventsFailed,
      retriesTotal: this._retriesTotal,
    };
  }

  enqueue(event: V1Event): void {
    if (this.items.length >= this.maxQueueSize) {
      this.items.shift();
      console.warn('[spechive] Event queue full — dropping oldest event');
    }
    this.items.push(event);
    this.processQueue();
  }

  /**
   * Returns a promise that resolves when the queue is fully drained
   * or the flush timeout expires, whichever comes first.
   *
   * Safe to call concurrently — all callers resolve when the drain completes.
   */
  waitForDrain(): Promise<void> {
    if (this.items.length === 0 && !this.processing) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.drainCallbacks.add(resolve);

      const timeout = setTimeout(() => {
        const remaining = this.items.length;
        if (remaining > 0) {
          console.warn(`[spechive] Flush timeout — ${remaining} events unsent`);
        }
        this.drainCallbacks.delete(resolve);
        resolve();
      }, this.flushTimeout);

      // Avoid holding the process open
      if (typeof timeout === 'object' && 'unref' in timeout) {
        timeout.unref();
      }
    });
  }

  private processQueue(): void {
    if (this.processing) return;
    this.processing = true;
    void this.drainLoop();
  }

  private async drainLoop(): Promise<void> {
    while (this.items.length > 0) {
      const event = this.items.shift()!;
      const result = await this.client.sendEvent(event);
      if (result.ok) {
        this._eventsSent++;
      } else {
        this._eventsFailed++;
        console.warn(`[spechive] Event ${event.eventType} failed after retries`);
      }
      this._retriesTotal += result.retries ?? 0;
    }
    this.processing = false;
    this.resolveDrainCallbacks();
  }

  private resolveDrainCallbacks(): void {
    for (const callback of this.drainCallbacks) {
      callback();
    }
    this.drainCallbacks.clear();
  }
}
