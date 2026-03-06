import { IS_PRODUCTION } from '@assertly/nestjs-common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

import { createWebhookPayload } from '../../../test/helpers/factories/webhook.factory';
import { WebhookAuthGuard } from '../src/guards/webhook-auth.guard';
import { ResultProcessorService } from '../src/modules/result-processor/result-processor.service';
import { WebhookReceiverController } from '../src/modules/webhook-receiver/webhook-receiver.controller';

const WEBHOOK_SECRET = 'test-secret-123';

describe('WebhookReceiverController', () => {
  let app: NestFastifyApplication;
  const mockProcessEvent = vi.fn();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [WebhookReceiverController],
      providers: [
        {
          provide: ResultProcessorService,
          useValue: {
            processEvent: mockProcessEvent,
            sortEventsByPriority: vi.fn().mockImplementation((events: unknown[]) => [...events]),
          },
        },
        { provide: IS_PRODUCTION, useValue: false },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('test'),
            getOrThrow: vi.fn().mockReturnValue(WEBHOOK_SECRET),
          },
        },
        WebhookAuthGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 for a valid payload with correct secret', async () => {
    mockProcessEvent.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/outboxy',
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      payload: JSON.parse(createWebhookPayload()),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(body.processed).toBe(1);
    expect(mockProcessEvent).toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload shape', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/outboxy',
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      payload: { totally: 'wrong' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 401 when x-webhook-secret is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/outboxy',
      payload: JSON.parse(createWebhookPayload({ payload: {} })),
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 when x-webhook-secret is wrong', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/outboxy',
      headers: { 'x-webhook-secret': 'wrong-secret' },
      payload: JSON.parse(createWebhookPayload({ payload: {} })),
    });

    expect(response.statusCode).toBe(401);
  });
});
