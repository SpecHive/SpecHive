import { createHash } from 'node:crypto';

import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProjectTokenGuard } from '../src/guards/project-token.guard';
import type { ProjectContext } from '../src/guards/project-token.guard';

const PROJECT_ID = '00000000-0000-4000-a000-000000000001';
const ORG_ID = '00000000-0000-4000-a000-000000000099';

function makeContext(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; projectContext?: ProjectContext } = {
    headers,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  } as never;
}

describe('ProjectTokenGuard', () => {
  let guard: ProjectTokenGuard;

  const mockExecute = vi.fn();

  const mockDb = {
    execute: mockExecute,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [ProjectTokenGuard, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    guard = module.get(ProjectTokenGuard);
  });

  it('throws 401 when x-project-token header is missing', async () => {
    const context = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing x-project-token header'),
    );
  });

  it('throws 401 when token hash is not found in the database', async () => {
    mockExecute.mockResolvedValue([]);

    const context = makeContext({ 'x-project-token': 'tok_unknown' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or revoked project token'),
    );
  });

  it('sets request.projectContext with correct projectId and organizationId on valid token', async () => {
    mockExecute
      .mockResolvedValueOnce([{ project_id: PROJECT_ID, organization_id: ORG_ID }])
      .mockResolvedValue(undefined);

    const ctx = makeContext({ 'x-project-token': 'tok_valid' });
    const { request } = ctx as unknown as { request: { projectContext?: ProjectContext } };

    await guard.canActivate(ctx);

    expect(request.projectContext).toEqual({
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
    });
  });

  it('fires lastUsedAt update without blocking the guard response', async () => {
    // Resolve validate immediately; delay the touch call to confirm non-blocking behaviour
    let resolveTouchCall!: () => void;
    const touchPromise = new Promise<undefined>((resolve) => {
      resolveTouchCall = () => resolve(undefined);
    });

    mockExecute
      .mockResolvedValueOnce([{ project_id: PROJECT_ID, organization_id: ORG_ID }])
      .mockReturnValueOnce(touchPromise);

    const context = makeContext({ 'x-project-token': 'tok_valid' });

    const result = await guard.canActivate(context);

    // Guard resolves before the touch promise settles
    expect(result).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(2);

    // Settle the dangling promise so vitest does not leak open handles
    resolveTouchCall();
    await touchPromise;
  });

  it('returns true on valid token', async () => {
    mockExecute
      .mockResolvedValueOnce([{ project_id: PROJECT_ID, organization_id: ORG_ID }])
      .mockResolvedValue(undefined);

    const context = makeContext({ 'x-project-token': 'tok_valid' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('hashes the token with SHA-256 and queries the database with the hex digest', async () => {
    const knownToken = 'tok_test_deterministic';
    const expectedHash = createHash('sha256').update(knownToken).digest('hex');

    mockExecute
      .mockResolvedValueOnce([{ project_id: PROJECT_ID, organization_id: ORG_ID }])
      .mockResolvedValue(undefined);

    const context = makeContext({ 'x-project-token': knownToken });
    await guard.canActivate(context);

    // The first db.execute call is the token validation query
    const firstCallArg = mockExecute.mock.calls[0]?.[0] as { queryChunks?: unknown[] };
    // The Sql object contains the hash as one of its params; convert the query to inspect it
    const sqlString = JSON.stringify(firstCallArg);
    expect(sqlString).toContain(expectedHash);
  });
});
