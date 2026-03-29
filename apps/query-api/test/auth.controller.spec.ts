import cookie from '@fastify/cookie';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { DATABASE_CONNECTION, IS_PRODUCTION } from '@spechive/nestjs-common';
import { REDIS_CLIENT } from '@spechive/nestjs-common/redis';
import { verify } from 'argon2';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { createMockPinoLogger } from '../../../test/unit-helpers/mock-logger';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { LoginRateLimitService } from '../src/modules/auth/login-rate-limit.service';

vi.mock('argon2', () => ({
  verify: vi.fn(),
}));

const mockVerify = vi.mocked(verify);

const JWT_SECRET = 'test-secret-for-unit-tests-only-not-for-production-use';

const MOCK_USER = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'test@spechive.dev',
  password_hash: '$argon2id$hash',
  name: 'Test User',
};

const MOCK_ORG = {
  organization_id: '00000000-0000-4000-a000-000000000099',
  organization_name: 'Test Org',
  organization_slug: 'test-org',
  role: 'owner',
};

describe('AuthController', () => {
  let app: NestFastifyApplication;
  const mockExecute = vi.fn();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        LoginRateLimitService,
        {
          provide: REDIS_CLIENT,
          useValue: {
            get: vi.fn().mockResolvedValue(null),
            del: vi.fn().mockResolvedValue(1),
            pipeline: vi.fn(() => ({
              incr: vi.fn().mockReturnThis(),
              expire: vi.fn().mockReturnThis(),
              exec: vi.fn().mockResolvedValue([]),
            })),
            quit: vi.fn().mockResolvedValue('OK'),
          },
        },
        { provide: DATABASE_CONNECTION, useValue: { execute: mockExecute } },
        { provide: IS_PRODUCTION, useValue: false },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return undefined;
            }),
            getOrThrow: vi.fn((key: string) => {
              if (key === 'JWT_SECRET') return JWT_SECRET;
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              return '';
            }),
          },
        },
        createMockPinoLogger('LoginRateLimitService'),
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(cookie as any);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/auth/login returns 200 with token on success', async () => {
    mockExecute
      .mockResolvedValueOnce([MOCK_USER])
      .mockResolvedValueOnce([MOCK_ORG])
      .mockResolvedValueOnce([]);
    mockVerify.mockResolvedValue(true);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'test@spechive.dev', password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as { token: string };
    expect(body.token).toBeDefined();
  });

  it('POST /v1/auth/login returns 400 for invalid body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /v1/auth/login returns 401 for wrong password', async () => {
    mockExecute.mockResolvedValueOnce([MOCK_USER]);
    mockVerify.mockResolvedValue(false);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'test@spechive.dev', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
  });
});
