import { Test } from '@nestjs/testing';
import type { RunId } from '@spechive/shared-types';
import { RunStatus } from '@spechive/shared-types';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { createMockPinoLogger } from '../../../../test/unit-helpers/mock-logger';
import { RunStartHandler } from '../../src/modules/result-processor/handlers/run-start.handler';

describe('RunStartHandler', () => {
  let handler: RunStartHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    const module = await Test.createTestingModule({
      providers: [RunStartHandler, createMockPinoLogger('RunStartHandler')],
    }).compile();

    handler = module.get(RunStartHandler);
  });

  it('inserts a run with correct fields', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.start' as const,
      payload: { metadata: { ci: true } },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.insert).toHaveBeenCalled();
    expect(mocks.insert.values).toHaveBeenCalledWith({
      id: 'run-1',
      projectId: 'proj-1',
      organizationId: 'org-1',
      name: null,
      status: RunStatus.Pending,
      startedAt: new Date('2025-01-01T00:00:00.000Z'),
      metadata: { ci: true },
      branch: null,
      commitSha: null,
      ciProvider: null,
      ciUrl: null,
    });
  });

  it('passes runName through as name', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-3' as RunId,
      eventType: 'run.start' as const,
      payload: { runName: 'Nightly E2E', metadata: {} },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nightly E2E' }),
    );
  });

  it('defaults metadata to empty object when not provided', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-2' as RunId,
      eventType: 'run.start' as const,
      payload: {},
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.values).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
  });

  it('populates promoted CI columns from ci object', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-ci' as RunId,
      eventType: 'run.start' as const,
      payload: {
        runName: 'CI Run',
        ci: {
          branch: 'main',
          commitSha: 'abc1234567890def1234567890abcdef12345678',
          ciProvider: 'github-actions',
          ciUrl: 'https://github.com/org/repo/actions/runs/123',
        },
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'main',
        commitSha: 'abc1234567890def1234567890abcdef12345678',
        ciProvider: 'github-actions',
        ciUrl: 'https://github.com/org/repo/actions/runs/123',
      }),
    );
  });

  it('populates only branch when partial ci is provided', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-partial-ci' as RunId,
      eventType: 'run.start' as const,
      payload: {
        ci: {
          branch: 'feature/test',
        },
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'feature/test',
        commitSha: null,
        ciProvider: null,
        ciUrl: null,
      }),
    );
  });

  it('logs debug when duplicate is skipped', async () => {
    mocks.insert.returning.mockResolvedValueOnce([]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-dup' as RunId,
      eventType: 'run.start' as const,
      payload: {},
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.returning).toHaveBeenCalled();
  });
});
