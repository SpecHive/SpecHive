import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IS_PRODUCTION, RetryableError } from '@spechive/nestjs-common';
import type { Mock } from 'vitest';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { createWebhookPayload } from '../../../test/helpers/factories/webhook.factory';
import { createMockPinoLogger } from '../../../test/unit-helpers/mock-logger';
import { WebhookAuthGuard } from '../src/guards/webhook-auth.guard';
import { ResultProcessorService } from '../src/modules/result-processor/result-processor.service';
import { WebhookReceiverController } from '../src/modules/webhook-receiver/webhook-receiver.controller';

const WEBHOOK_SECRET = 'test-secret-123';

const mockLoggerProvider = createMockPinoLogger('WebhookReceiverController');
const mockLogger = mockLoggerProvider.useValue;

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
        mockLoggerProvider,
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

  describe('error handling', () => {
    beforeEach(() => {
      mockProcessEvent.mockReset();
      (mockLogger.warn as Mock).mockClear();
      (mockLogger.error as Mock).mockClear();
    });

    it('logs retryable failure at warn level, not error', async () => {
      mockProcessEvent.mockRejectedValue(new RetryableError('transient'));

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/outboxy',
        headers: { 'x-webhook-secret': WEBHOOK_SECRET },
        payload: JSON.parse(createWebhookPayload()),
      });

      expect(response.statusCode).toBe(500);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: expect.any(String) }),
        expect.stringContaining('Retryable'),
      );
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Failed to process event'),
      );
    });

    it('logs permanent failure at error level, not warn', async () => {
      mockProcessEvent.mockRejectedValue(new Error('permanent'));

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/outboxy',
        headers: { 'x-webhook-secret': WEBHOOK_SECRET },
        payload: JSON.parse(createWebhookPayload()),
      });

      expect(response.statusCode).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: expect.any(String) }),
        expect.stringContaining('Failed to process event'),
      );
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Retryable'),
      );
    });

    it('logs summary at error level for mixed batch with non-retryable failures', async () => {
      mockProcessEvent
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('permanent'));

      const payload = {
        batch: true,
        count: 2,
        events: [
          {
            eventId: 'evt-1',
            aggregateType: 'TestRun',
            aggregateId: 'run-1',
            eventType: 'run.start',
            payload: {},
          },
          {
            eventId: 'evt-2',
            aggregateType: 'TestRun',
            aggregateId: 'run-1',
            eventType: 'run.end',
            payload: {},
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/outboxy',
        headers: { 'x-webhook-secret': WEBHOOK_SECRET },
        payload,
      });

      expect(response.statusCode).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ retryableCount: 0 }),
        expect.stringContaining('Batch failures'),
      );
    });
  });
});
