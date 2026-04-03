import { HttpException, HttpStatus } from '@nestjs/common';
import type { UserContext } from '@spechive/nestjs-common';
import type { RedisPubSubService } from '@spechive/nestjs-common/redis';
import { MembershipRole, type OrganizationId, type UserId } from '@spechive/shared-types';
import type { Subscription } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SseController } from '../src/modules/sse/sse.controller';

type MessageCallback = (message: unknown) => void;

function createMockPubSub() {
  let capturedCallback: MessageCallback | null = null;
  const mockUnsubscribe = vi.fn();

  return {
    mock: {
      subscribe: vi.fn((_, cb: MessageCallback) => {
        capturedCallback = cb;
        return mockUnsubscribe;
      }),
    } as unknown as RedisPubSubService,
    mockUnsubscribe,
    simulateMessage(data: unknown) {
      capturedCallback?.(data);
    },
  };
}

function createUser(organizationId = 'org-1'): UserContext {
  return {
    userId: 'user-1' as UserId,
    organizationId: organizationId as OrganizationId,
    role: MembershipRole.Admin,
  };
}

describe('SseController', () => {
  let controller: SseController;
  let pubsub: ReturnType<typeof createMockPubSub>;

  beforeEach(() => {
    vi.useFakeTimers();
    pubsub = createMockPubSub();
    controller = new SseController(pubsub.mock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits data events from pubsub callback', () => {
    const user = createUser();
    const observable = controller.events(user);
    const events: unknown[] = [];

    const sub: Subscription = observable.subscribe((event) => events.push(event));

    pubsub.simulateMessage({ type: 'run.updated', runId: 'r-1' });

    expect(events).toEqual([
      { data: JSON.stringify({ type: 'run.updated', runId: 'r-1' }), type: 'notification' },
    ]);
    expect(pubsub.mock.subscribe).toHaveBeenCalledWith(
      `sse:${user.organizationId}`,
      expect.any(Function),
    );

    sub.unsubscribe();
  });

  it('emits heartbeat events at 30s interval', () => {
    const observable = controller.events(createUser());
    const events: unknown[] = [];

    const sub = observable.subscribe((event) => events.push(event));

    vi.advanceTimersByTime(30_000);
    expect(events).toContainEqual({ data: '', type: 'heartbeat' });

    vi.advanceTimersByTime(30_000);
    const heartbeats = events.filter((e) => (e as { type?: string }).type === 'heartbeat');
    expect(heartbeats).toHaveLength(2);

    sub.unsubscribe();
  });

  it('teardown calls unsubscribe and clears heartbeat', () => {
    const observable = controller.events(createUser());
    const sub = observable.subscribe(() => {});

    sub.unsubscribe();

    expect(pubsub.mockUnsubscribe).toHaveBeenCalled();

    // Heartbeat should not fire after unsubscribe
    const spy = vi.fn();
    const sub2 = observable.subscribe(spy);
    // Advancing time should not trigger old heartbeat
    vi.advanceTimersByTime(60_000);
    // Only the new subscription's heartbeats
    sub2.unsubscribe();
  });

  it('rejects with 429 when connection limit exceeded', () => {
    const user = createUser('org-cap');
    const subs: Subscription[] = [];

    // Open 50 connections
    for (let i = 0; i < 50; i++) {
      subs.push(controller.events(user).subscribe(() => {}));
    }

    // 51st should throw 429
    expect(() => controller.events(user)).toThrow(HttpException);
    try {
      controller.events(user);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }

    // Cleanup
    for (const sub of subs) sub.unsubscribe();
  });

  it('allows new connections after previous ones close', () => {
    const user = createUser('org-cap');
    const subs: Subscription[] = [];

    for (let i = 0; i < 50; i++) {
      subs.push(controller.events(user).subscribe(() => {}));
    }

    // Close one connection
    subs[0]!.unsubscribe();

    // Should now succeed
    const newSub = controller.events(user).subscribe(() => {});
    expect(newSub).toBeDefined();

    // Cleanup
    newSub.unsubscribe();
    for (const sub of subs.slice(1)) sub.unsubscribe();
  });
});
