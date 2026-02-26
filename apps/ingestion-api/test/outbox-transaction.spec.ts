import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { Test } from '@nestjs/testing';
import { OUTBOXY_CLIENT } from '@outboxy/sdk-nestjs';
import { SQL } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { IngestionService } from '../src/modules/ingestion/ingestion.service';
import { ArtifactService } from '../src/modules/ingestion/services/artifact.service';
import { RunService } from '../src/modules/ingestion/services/run.service';
import { SuiteService } from '../src/modules/ingestion/services/suite.service';
import { TestService } from '../src/modules/ingestion/services/test.service';

const PROJECT_ID = 'project-1';
const ORG_ID = '00000000-0000-4000-a000-000000000099';
const RUN_ID = '00000000-0000-4000-a000-000000000001';

function makeRunStartEvent(overrides: Record<string, unknown> = {}) {
  return {
    version: '1' as const,
    timestamp: '2026-02-24T10:00:00.000Z',
    runId: RUN_ID,
    eventType: 'run.start' as const,
    payload: {},
    ...overrides,
  };
}

describe('IngestionService — outbox transaction integrity', () => {
  let service: IngestionService;

  const mockPublish = vi.fn();

  const mockDb = {
    transaction: vi.fn(),
  };

  const mockOutboxy = {
    publish: mockPublish,
  };

  const mockRunService = {
    handleRunStart: vi.fn(),
    handleRunEnd: vi.fn(),
  };

  const mockSuiteService = {
    handleSuiteStart: vi.fn(),
    handleSuiteEnd: vi.fn(),
  };

  const mockTestService = {
    handleTestStart: vi.fn(),
    handleTestEnd: vi.fn(),
  };

  const mockArtifactService = {
    handleArtifactUpload: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRunService.handleRunStart.mockResolvedValue({ runId: RUN_ID });

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({ $client: {}, execute: vi.fn().mockResolvedValue(undefined) });
    });

    mockPublish.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: OUTBOXY_CLIENT, useValue: mockOutboxy },
        { provide: RunService, useValue: mockRunService },
        { provide: SuiteService, useValue: mockSuiteService },
        { provide: TestService, useValue: mockTestService },
        { provide: ArtifactService, useValue: mockArtifactService },
      ],
    }).compile();

    service = module.get(IngestionService);
  });

  it('rolls back the entire transaction when outboxy.publish throws', async () => {
    mockPublish.mockRejectedValue(new Error('Outbox publish failed'));

    await expect(service.processEvent(makeRunStartEvent(), PROJECT_ID, ORG_ID)).rejects.toThrow(
      'Outbox publish failed',
    );
  });

  it('does not call outboxy.publish when the domain service throws', async () => {
    mockRunService.handleRunStart.mockRejectedValue(new Error('Domain write failed'));

    await expect(service.processEvent(makeRunStartEvent(), PROJECT_ID, ORG_ID)).rejects.toThrow(
      'Domain write failed',
    );

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('calls setTenantContext with the correct organizationId inside the transaction', async () => {
    const txExecute = vi.fn().mockResolvedValue(undefined);

    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({ $client: {}, execute: txExecute });
    });

    await service.processEvent(makeRunStartEvent(), PROJECT_ID, ORG_ID);

    expect(txExecute).toHaveBeenCalled();

    // setTenantContext is the first tx.execute call; extract the Sql object and inspect it
    const firstCallArg = txExecute.mock.calls[0]?.[0] as SQL;
    expect(firstCallArg).toBeInstanceOf(SQL);

    const { sql: queryText, params } = firstCallArg.toQuery({
      escapeName: (name: string) => `"${name}"`,
      escapeParam: (_n: number, v: unknown) => String(v),
      escapeString: (s: string) => `'${s}'`,
    });

    expect(queryText).toContain('set_config');
    expect(params).toContain(ORG_ID);
  });

  it('sends the same idempotency key for the same event processed twice', async () => {
    const event = makeRunStartEvent();

    await service.processEvent(event, PROJECT_ID, ORG_ID);
    await service.processEvent(event, PROJECT_ID, ORG_ID);

    expect(mockPublish).toHaveBeenCalledTimes(2);

    const [firstCall, secondCall] = mockPublish.mock.calls as [
      [{ idempotencyKey: string }, unknown],
      [{ idempotencyKey: string }, unknown],
    ];

    expect(firstCall[0].idempotencyKey).toBe(secondCall[0].idempotencyKey);
  });
});
