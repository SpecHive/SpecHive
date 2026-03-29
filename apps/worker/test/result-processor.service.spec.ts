import { Reflector } from '@nestjs/core';
import { DiscoveryService } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { INBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { DATABASE_CONNECTION, RetryableError } from '@spechive/nestjs-common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EVENT_HANDLER_KEY, type IEventHandler } from '../src/modules/result-processor/handlers';
import { ResultProcessorService } from '../src/modules/result-processor/result-processor.service';
import type { OutboxyEvent } from '../src/types/outboxy-envelope';

const VALID_TIMESTAMP = '2025-01-01T00:00:00.000Z';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '33333333-3333-4333-8333-333333333333';
const SUITE_ID = '44444444-4444-4444-8444-444444444444';
const TEST_ID = '55555555-5555-4555-8555-555555555555';

function makeEnvelope(
  eventType: string,
  event: Record<string, unknown>,
  overrides?: Partial<OutboxyEvent>,
): OutboxyEvent {
  return {
    eventId: 'evt-1',
    aggregateType: 'TestRun',
    aggregateId: RUN_ID,
    eventType,
    payload: {
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      event: {
        version: '1',
        timestamp: VALID_TIMESTAMP,
        runId: RUN_ID,
        eventType,
        payload: event,
      },
    },
    ...overrides,
  };
}

function createMockHandler(eventType: string): IEventHandler {
  return {
    eventType: eventType as IEventHandler['eventType'],
    handle: vi.fn(),
  };
}

class MockRunStartHandler {}
class MockRunEndHandler {}
class MockSuiteStartHandler {}
class MockSuiteEndHandler {}
class MockTestStartHandler {}
class MockTestEndHandler {}
class MockArtifactUploadHandler {}

const HANDLER_METATYPES = [
  MockRunStartHandler,
  MockRunEndHandler,
  MockSuiteStartHandler,
  MockSuiteEndHandler,
  MockTestStartHandler,
  MockTestEndHandler,
  MockArtifactUploadHandler,
];

describe('ResultProcessorService', () => {
  let service: ResultProcessorService;
  let mockTx: Record<string, unknown>;
  let mockDb: { transaction: ReturnType<typeof vi.fn> };
  let mockInbox: { receive: ReturnType<typeof vi.fn> };
  let handlers: IEventHandler[];

  beforeEach(async () => {
    mockTx = { execute: vi.fn() };
    mockDb = {
      transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    };
    mockInbox = {
      receive: vi.fn().mockResolvedValue({ eventId: 'inbox-1', status: 'processed' }),
    };

    handlers = [
      createMockHandler('run.start'),
      createMockHandler('run.end'),
      createMockHandler('suite.start'),
      createMockHandler('suite.end'),
      createMockHandler('test.start'),
      createMockHandler('test.end'),
      createMockHandler('artifact.upload'),
    ];

    const wrappers = handlers.map((handler, i) => ({
      metatype: HANDLER_METATYPES[i],
      instance: handler,
      isDependencyTreeStatic: () => true,
    }));

    const mockDiscovery = { getProviders: vi.fn().mockReturnValue(wrappers) };
    const mockReflector = {
      get: vi.fn().mockImplementation((key: symbol, metatype: unknown) => {
        if (
          key === EVENT_HANDLER_KEY &&
          HANDLER_METATYPES.includes(metatype as typeof MockRunStartHandler)
        ) {
          return true;
        }
        return undefined;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ResultProcessorService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: INBOXY_CLIENT, useValue: mockInbox },
        { provide: DiscoveryService, useValue: mockDiscovery },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    service = module.get(ResultProcessorService);
    service.onModuleInit();
  });

  it('routes run.start to RunStartHandler', async () => {
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);
    expect(handlers[0]!.handle).toHaveBeenCalledOnce();
  });

  it('routes run.end to RunEndHandler', async () => {
    const envelope = makeEnvelope('run.end', { status: 'passed' });
    await service.processEvent(envelope);
    expect(handlers[1]!.handle).toHaveBeenCalledOnce();
  });

  it('routes suite.start to SuiteStartHandler', async () => {
    const envelope = makeEnvelope('suite.start', {
      suiteId: SUITE_ID,
      suiteName: 'Auth Tests',
    });
    await service.processEvent(envelope);
    expect(handlers[2]!.handle).toHaveBeenCalledOnce();
  });

  it('routes suite.end to SuiteEndHandler', async () => {
    const envelope = makeEnvelope('suite.end', { suiteId: SUITE_ID });
    await service.processEvent(envelope);
    expect(handlers[3]!.handle).toHaveBeenCalledOnce();
  });

  it('routes test.start to TestStartHandler', async () => {
    const envelope = makeEnvelope('test.start', {
      testId: TEST_ID,
      suiteId: SUITE_ID,
      testName: 'should login',
    });
    await service.processEvent(envelope);
    expect(handlers[4]!.handle).toHaveBeenCalledOnce();
  });

  it('routes test.end to TestEndHandler', async () => {
    const envelope = makeEnvelope('test.end', {
      testId: TEST_ID,
      status: 'passed',
    });
    await service.processEvent(envelope);
    expect(handlers[5]!.handle).toHaveBeenCalledOnce();
  });

  it('routes artifact.upload to ArtifactUploadHandler', async () => {
    const envelope = makeEnvelope('artifact.upload', {
      artifactId: '00000000-0000-4000-a000-000000000040',
      testId: TEST_ID,
      artifactType: 'screenshot',
      name: 'failure.png',
      storagePath: 'org/proj/run/test/artifact_failure.png',
    });
    await service.processEvent(envelope);
    expect(handlers[6]!.handle).toHaveBeenCalledOnce();
  });

  it('logs error and returns on invalid payload', async () => {
    const envelope: OutboxyEvent = {
      eventId: 'evt-bad',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'run.start',
      payload: { invalid: true },
    };
    await expect(service.processEvent(envelope)).resolves.toBeUndefined();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('skips handler on duplicate event', async () => {
    mockInbox.receive.mockResolvedValue({ eventId: null, status: 'duplicate' });
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);
    expect(handlers[0]!.handle).not.toHaveBeenCalled();
  });

  it('sets RLS context before routing to handler', async () => {
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);
    expect(mockTx.execute).toHaveBeenCalled();
  });

  it('passes correct context to handler', async () => {
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);

    const handlerMock = handlers[0]!.handle as ReturnType<typeof vi.fn>;
    const [, ctx] = handlerMock.mock.calls[0];
    expect(ctx.tx).toBe(mockTx);
    expect(ctx.organizationId).toBe(ORG_ID);
    expect(ctx.projectId).toBe(PROJECT_ID);
  });

  describe('error classification', () => {
    it('propagates RetryableError from handler as-is', async () => {
      const retryable = new RetryableError('transient');
      (handlers[0]!.handle as ReturnType<typeof vi.fn>).mockRejectedValue(retryable);

      const envelope = makeEnvelope('run.start', {});

      await expect(service.processEvent(envelope)).rejects.toSatisfy((err: unknown) => {
        expect(err).toBe(retryable);
        expect(err).toBeInstanceOf(RetryableError);
        return true;
      });
    });

    it('wraps retryable PG error in RetryableError', async () => {
      const pgError = Object.assign(new Error('foreign key violation'), { code: '23503' });
      (handlers[0]!.handle as ReturnType<typeof vi.fn>).mockRejectedValue(pgError);

      const envelope = makeEnvelope('run.start', {});

      await expect(service.processEvent(envelope)).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(RetryableError);
        expect((err as RetryableError).cause).toBe(pgError);
        return true;
      });
    });

    it('propagates permanent error unchanged', async () => {
      const permanent = new Error('permanent failure');
      (handlers[0]!.handle as ReturnType<typeof vi.fn>).mockRejectedValue(permanent);

      const envelope = makeEnvelope('run.start', {});

      await expect(service.processEvent(envelope)).rejects.toSatisfy((err: unknown) => {
        expect(err).toBe(permanent);
        expect(err).not.toBeInstanceOf(RetryableError);
        return true;
      });
    });

    it('does not double-wrap RetryableError with PG cause', async () => {
      const pgCause = Object.assign(new Error('fk'), { code: '23503' });
      const alreadyWrapped = new RetryableError('already classified', { cause: pgCause });
      (handlers[0]!.handle as ReturnType<typeof vi.fn>).mockRejectedValue(alreadyWrapped);

      const envelope = makeEnvelope('run.start', {});

      await expect(service.processEvent(envelope)).rejects.toSatisfy((err: unknown) => {
        expect(err).toBe(alreadyWrapped);
        return true;
      });
    });
  });
});
