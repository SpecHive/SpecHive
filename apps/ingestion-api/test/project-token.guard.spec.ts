import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { verify } from 'argon2';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProjectTokenGuard } from '../src/guards/project-token.guard';
import type { ProjectContext } from '../src/guards/project-token.guard';

vi.mock('argon2', () => ({
  verify: vi.fn(),
}));

const mockVerify = vi.mocked(verify);

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

  it('throws 401 when no candidates match the token prefix', async () => {
    mockExecute.mockResolvedValue([]);

    const context = makeContext({ 'x-project-token': 'tok_unknown' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or revoked project token'),
    );
  });

  it('throws 401 when argon2 verify fails for all candidates', async () => {
    mockExecute.mockResolvedValue([
      { token_hash: '$argon2id$hash1', project_id: PROJECT_ID, organization_id: ORG_ID },
    ]);
    mockVerify.mockResolvedValue(false);

    const context = makeContext({ 'x-project-token': 'tok_bad_password' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or revoked project token'),
    );
  });

  it('sets request.projectContext with correct projectId and organizationId on valid token', async () => {
    const argon2Hash = '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash';
    mockExecute
      .mockResolvedValueOnce([
        { token_hash: argon2Hash, project_id: PROJECT_ID, organization_id: ORG_ID },
      ])
      .mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(true);

    const ctx = makeContext({ 'x-project-token': 'tok_valid_token_here' });
    const { request } = ctx as unknown as { request: { projectContext?: ProjectContext } };

    await guard.canActivate(ctx);

    expect(request.projectContext).toEqual({
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
    });
  });

  it('fires lastUsedAt update without blocking the guard response', async () => {
    let resolveTouchCall!: () => void;
    const touchPromise = new Promise<undefined>((resolve) => {
      resolveTouchCall = () => resolve(undefined);
    });

    const argon2Hash = '$argon2id$hash';
    mockExecute
      .mockResolvedValueOnce([
        { token_hash: argon2Hash, project_id: PROJECT_ID, organization_id: ORG_ID },
      ])
      .mockReturnValueOnce(touchPromise);
    mockVerify.mockResolvedValue(true);

    const context = makeContext({ 'x-project-token': 'tok_valid_token_here' });

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
      .mockResolvedValueOnce([
        { token_hash: '$argon2id$hash', project_id: PROJECT_ID, organization_id: ORG_ID },
      ])
      .mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(true);

    const context = makeContext({ 'x-project-token': 'tok_valid_token_here' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('extracts the first 16 chars as prefix and queries by prefix', async () => {
    const token = 'abcdefghijklmnop_rest_of_token';
    const expectedPrefix = 'abcdefghijklmnop';

    mockExecute
      .mockResolvedValueOnce([
        { token_hash: '$argon2id$hash', project_id: PROJECT_ID, organization_id: ORG_ID },
      ])
      .mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(true);

    const context = makeContext({ 'x-project-token': token });
    await guard.canActivate(context);

    const firstCallArg = mockExecute.mock.calls[0]?.[0] as { queryChunks?: unknown[] };
    const sqlString = JSON.stringify(firstCallArg);
    expect(sqlString).toContain(expectedPrefix);
  });

  it('calls argon2.verify with the candidate hash and the raw token', async () => {
    const token = 'tok_verify_check_token';
    const argon2Hash = '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash';

    mockExecute
      .mockResolvedValueOnce([
        { token_hash: argon2Hash, project_id: PROJECT_ID, organization_id: ORG_ID },
      ])
      .mockResolvedValue(undefined);
    mockVerify.mockResolvedValue(true);

    const context = makeContext({ 'x-project-token': token });
    await guard.canActivate(context);

    expect(mockVerify).toHaveBeenCalledWith(argon2Hash, token);
  });
});
