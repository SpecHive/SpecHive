import type Redis from 'ioredis';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RedisPubSubService } from '../src/redis/redis-pubsub.service';

type EventHandler = (...args: unknown[]) => void;

function createMockRedis() {
  const handlers = new Map<string, EventHandler[]>();

  const mock = {
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn((event: string, handler: EventHandler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return mock;
    }),
    duplicate: vi.fn(),
  } as unknown as Redis & {
    on: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    duplicate: ReturnType<typeof vi.fn>;
  };

  function emit(event: string, ...args: unknown[]) {
    for (const handler of handlers.get(event) ?? []) {
      handler(...args);
    }
  }

  return { mock, emit };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    setContext: vi.fn(),
  };
}

describe('RedisPubSubService', () => {
  let service: RedisPubSubService;
  let publisher: ReturnType<typeof createMockRedis>;
  let subscriber: ReturnType<typeof createMockRedis>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();

    publisher = createMockRedis();
    subscriber = createMockRedis();
    logger = createMockLogger();

    publisher.mock.duplicate = vi.fn(() => subscriber.mock);

    service = new (RedisPubSubService as new (...args: unknown[]) => RedisPubSubService)(
      logger as never,
      publisher.mock as never,
    );
  });

  describe('publish', () => {
    it('serializes message and calls redis.publish', async () => {
      await service.publish('sse:org-1', { type: 'run.updated', runId: 'r-1' });

      expect(publisher.mock.publish).toHaveBeenCalledWith(
        'sse:org-1',
        JSON.stringify({ type: 'run.updated', runId: 'r-1' }),
      );
    });

    it('swallows errors and logs warning', async () => {
      publisher.mock.publish.mockRejectedValueOnce(new Error('Redis down'));

      await service.publish('ch', { data: 1 });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error), channel: 'ch' }),
        'Failed to publish SSE event',
      );
    });
  });

  describe('subscribe', () => {
    it('creates subscriber lazily and dispatches messages', async () => {
      const callback = vi.fn();
      service.subscribe('sse:org-1', callback);

      // Simulate subscriber ready
      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalledWith('sse:org-1'));

      // Simulate incoming message
      subscriber.emit('message', 'sse:org-1', JSON.stringify({ type: 'run.updated' }));

      expect(callback).toHaveBeenCalledWith({ type: 'run.updated' });
    });

    it('supports multiple callbacks on the same channel', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      service.subscribe('ch', cb1);
      service.subscribe('ch', cb2);

      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalled());

      subscriber.emit('message', 'ch', JSON.stringify({ x: 1 }));

      expect(cb1).toHaveBeenCalledWith({ x: 1 });
      expect(cb2).toHaveBeenCalledWith({ x: 1 });
    });

    it('returns unsubscribe that removes callback', async () => {
      const cb = vi.fn();
      const unsub = service.subscribe('ch', cb);

      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalled());

      unsub();

      // Last callback removed — should unsubscribe from Redis channel
      expect(subscriber.mock.unsubscribe).toHaveBeenCalledWith('ch');
    });

    it('does not unsubscribe from Redis when other callbacks remain', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = service.subscribe('ch', cb1);
      service.subscribe('ch', cb2);

      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalled());

      unsub1();

      expect(subscriber.mock.unsubscribe).not.toHaveBeenCalled();
    });

    it('recovers subscriber after initial Redis connection failure', async () => {
      const callback = vi.fn();
      service.subscribe('ch', callback);

      // First connection fails — end fires before ready
      subscriber.emit('end');

      // Wait for the failed promise to settle
      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Failed to set up subscription',
        ),
      );

      // Create a fresh subscriber mock for the retry
      const subscriber2 = createMockRedis();
      publisher.mock.duplicate = vi.fn(() => subscriber2.mock);

      // Second subscribe call should retry creating the subscriber
      const cb2 = vi.fn();
      service.subscribe('ch', cb2);

      subscriber2.emit('ready');
      await vi.waitFor(() => expect(subscriber2.mock.subscribe).toHaveBeenCalledWith('ch'));

      subscriber2.emit('message', 'ch', JSON.stringify({ recovered: true }));

      expect(callback).toHaveBeenCalledWith({ recovered: true });
      expect(cb2).toHaveBeenCalledWith({ recovered: true });
    });

    it('retries channel subscription after setup failure on same channel', async () => {
      const callback = vi.fn();
      service.subscribe('ch', callback);

      // Connection fails
      subscriber.emit('end');
      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          'Failed to set up subscription',
        ),
      );

      // Unsubscribe the old callback
      // (simulates the SSE controller teardown + new connection)

      // Fresh subscriber for retry
      const subscriber2 = createMockRedis();
      publisher.mock.duplicate = vi.fn(() => subscriber2.mock);

      // New subscribe on same channel should retry
      const cb2 = vi.fn();
      service.subscribe('ch', cb2);

      subscriber2.emit('ready');
      await vi.waitFor(() => expect(subscriber2.mock.subscribe).toHaveBeenCalledWith('ch'));

      subscriber2.emit('message', 'ch', JSON.stringify({ retried: true }));
      expect(cb2).toHaveBeenCalledWith({ retried: true });
    });

    it('resubscribes channels after connection end event on established connection', async () => {
      const callback = vi.fn();
      service.subscribe('ch', callback);

      // Initial connection succeeds
      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalledWith('ch'));

      // Connection drops
      subscriber.emit('end');

      // Fresh subscriber for reconnect
      const subscriber2 = createMockRedis();
      publisher.mock.duplicate = vi.fn(() => subscriber2.mock);

      // New subscribe triggers reconnection
      const cb2 = vi.fn();
      service.subscribe('ch', cb2);

      subscriber2.emit('ready');
      await vi.waitFor(() => expect(subscriber2.mock.subscribe).toHaveBeenCalledWith('ch'));

      subscriber2.emit('message', 'ch', JSON.stringify({ reconnected: true }));
      expect(callback).toHaveBeenCalledWith({ reconnected: true });
      expect(cb2).toHaveBeenCalledWith({ reconnected: true });
    });

    it('skips malformed JSON and logs warning', async () => {
      const cb = vi.fn();
      service.subscribe('ch', cb);

      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalled());

      subscriber.emit('message', 'ch', 'not-json');

      expect(cb).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { channel: 'ch' },
        'Failed to parse pub/sub message',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('quits subscriber and clears state', async () => {
      service.subscribe('ch', vi.fn());
      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalled());

      await service.onModuleDestroy();

      expect(subscriber.mock.quit).toHaveBeenCalled();
    });

    it('handles quit failure silently', async () => {
      service.subscribe('ch', vi.fn());
      subscriber.emit('ready');
      await vi.waitFor(() => expect(subscriber.mock.subscribe).toHaveBeenCalled());

      subscriber.mock.quit.mockRejectedValueOnce(new Error('already closed'));

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith('Failed to close Redis subscriber connection');
    });
  });
});
