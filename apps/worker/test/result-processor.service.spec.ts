import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { Test } from '@nestjs/testing';
import { INBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ArtifactUploadHandler,
  RunEndHandler,
  RunStartHandler,
  SuiteEndHandler,
  SuiteStartHandler,
  TestEndHandler,
  TestStartHandler,
} from '../src/modules/result-processor/handlers';
import { ResultProcessorService } from '../src/modules/result-processor/result-processor.service';
import type { OutboxyEnvelope } from '../src/types/outboxy-envelope';

const VALID_TIMESTAMP = '2025-01-01T00:00:00.000Z';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '33333333-3333-4333-8333-333333333333';
const SUITE_ID = '44444444-4444-4444-8444-444444444444';
const TEST_ID = '55555555-5555-4555-8555-555555555555';

function makeEnvelope(
  eventType: string,
  event: Record<string, unknown>,
  overrides?: Partial<OutboxyEnvelope>,
): OutboxyEnvelope {
  return {
    id: 'evt-1',
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

describe('ResultProcessorService', () => {
  let service: ResultProcessorService;
  let mockTx: Record<string, unknown>;
  let mockDb: { transaction: ReturnType<typeof vi.fn> };
  let mockInbox: { receive: ReturnType<typeof vi.fn> };
  let handlers: Record<string, { handle: ReturnType<typeof vi.fn> }>;

  beforeEach(async () => {
    mockTx = { execute: vi.fn() };
    mockDb = {
      transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
    };
    mockInbox = {
      receive: vi.fn().mockResolvedValue({ eventId: 'inbox-1', status: 'processed' }),
    };
    handlers = {
      runStart: { handle: vi.fn() },
      runEnd: { handle: vi.fn() },
      suiteStart: { handle: vi.fn() },
      suiteEnd: { handle: vi.fn() },
      testStart: { handle: vi.fn() },
      testEnd: { handle: vi.fn() },
      artifactUpload: { handle: vi.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        ResultProcessorService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: INBOXY_CLIENT, useValue: mockInbox },
        { provide: RunStartHandler, useValue: handlers.runStart },
        { provide: RunEndHandler, useValue: handlers.runEnd },
        { provide: SuiteStartHandler, useValue: handlers.suiteStart },
        { provide: SuiteEndHandler, useValue: handlers.suiteEnd },
        { provide: TestStartHandler, useValue: handlers.testStart },
        { provide: TestEndHandler, useValue: handlers.testEnd },
        { provide: ArtifactUploadHandler, useValue: handlers.artifactUpload },
      ],
    }).compile();

    service = module.get(ResultProcessorService);
  });

  it('routes run.start to RunStartHandler', async () => {
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);
    expect(handlers.runStart.handle).toHaveBeenCalledOnce();
  });

  it('routes run.end to RunEndHandler', async () => {
    const envelope = makeEnvelope('run.end', { status: 'passed' });
    await service.processEvent(envelope);
    expect(handlers.runEnd.handle).toHaveBeenCalledOnce();
  });

  it('routes suite.start to SuiteStartHandler', async () => {
    const envelope = makeEnvelope('suite.start', {
      suiteId: SUITE_ID,
      suiteName: 'Auth Tests',
    });
    await service.processEvent(envelope);
    expect(handlers.suiteStart.handle).toHaveBeenCalledOnce();
  });

  it('routes suite.end to SuiteEndHandler', async () => {
    const envelope = makeEnvelope('suite.end', { suiteId: SUITE_ID });
    await service.processEvent(envelope);
    expect(handlers.suiteEnd.handle).toHaveBeenCalledOnce();
  });

  it('routes test.start to TestStartHandler', async () => {
    const envelope = makeEnvelope('test.start', {
      testId: TEST_ID,
      suiteId: SUITE_ID,
      testName: 'should login',
    });
    await service.processEvent(envelope);
    expect(handlers.testStart.handle).toHaveBeenCalledOnce();
  });

  it('routes test.end to TestEndHandler', async () => {
    const envelope = makeEnvelope('test.end', {
      testId: TEST_ID,
      status: 'passed',
    });
    await service.processEvent(envelope);
    expect(handlers.testEnd.handle).toHaveBeenCalledOnce();
  });

  it('routes artifact.upload to ArtifactUploadHandler', async () => {
    const envelope = makeEnvelope('artifact.upload', {
      testId: TEST_ID,
      artifactType: 'screenshot',
      name: 'failure.png',
      data: Buffer.from('test').toString('base64'),
    });
    await service.processEvent(envelope);
    expect(handlers.artifactUpload.handle).toHaveBeenCalledOnce();
  });

  it('logs error and returns on invalid payload', async () => {
    const envelope: OutboxyEnvelope = {
      id: 'evt-bad',
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
    expect(handlers.runStart.handle).not.toHaveBeenCalled();
  });

  it('sets RLS context before routing to handler', async () => {
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);

    // setTenantContext calls tx.execute with SET config
    expect(mockTx.execute).toHaveBeenCalled();
  });

  it('passes correct context to handler', async () => {
    const envelope = makeEnvelope('run.start', {});
    await service.processEvent(envelope);

    const [, ctx] = handlers.runStart.handle.mock.calls[0];
    expect(ctx.tx).toBe(mockTx);
    expect(ctx.organizationId).toBe(ORG_ID);
    expect(ctx.projectId).toBe(PROJECT_ID);
  });
});
