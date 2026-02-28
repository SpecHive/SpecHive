import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import type { UserContext } from '../src/modules/auth/types';

const JWT_SECRET = 'test-secret-for-unit-tests-only-not-for-production-use';
const secret = new TextEncoder().encode(JWT_SECRET);

async function signToken(payload: Record<string, unknown>, expiresIn = '1h') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

function makeContext(
  headers: Record<string, string> = {},
  handlerMeta: Record<string, unknown> = {},
) {
  const request: { headers: Record<string, string>; user?: UserContext } = { headers };
  const handler = () => {};
  const klass = class {};

  // Attach metadata to handler/class for reflector
  for (const [key, value] of Object.entries(handlerMeta)) {
    Reflect.defineMetadata(key, value, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => klass,
    request,
  } as never;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue(JWT_SECRET),
          },
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
  });

  it('allows @Public() routes without a token', async () => {
    const ctx = makeContext({}, { isPublic: true });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws 401 when Authorization header is missing', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Missing or malformed Authorization header',
    );
  });

  it('throws 401 when Authorization header is not Bearer', async () => {
    const ctx = makeContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Missing or malformed Authorization header',
    );
  });

  it('throws 401 for an expired token', async () => {
    const token = await new SignJWT({ sub: 'user1', organizationId: 'org1', role: 'member' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);

    const ctx = makeContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid or expired token');
  });

  it('throws 401 for a token signed with the wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret');
    const token = await new SignJWT({ sub: 'user1', organizationId: 'org1', role: 'member' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const ctx = makeContext({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid or expired token');
  });

  it('sets request.user with correct UserContext on valid token', async () => {
    const token = await signToken({
      sub: 'user-123',
      organizationId: 'org-456',
      role: 'admin',
    });

    const ctx = makeContext({ authorization: `Bearer ${token}` });
    const { request } = ctx as unknown as { request: { user?: UserContext } };

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: 'user-123',
      organizationId: 'org-456',
      role: 'admin',
    });
  });
});
