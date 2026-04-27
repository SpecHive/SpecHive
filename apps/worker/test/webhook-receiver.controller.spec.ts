import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IS_PRODUCTION, METRICS_SERVICE, RetryableError } from '@spechive/nestjs-common';
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
  const mockCounterInc = vi.fn();

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
          provide: METRICS_SERVICE,
          useValue: {
            enabled: true,
            createCounter: vi.fn().mockReturnValue({ inc: mockCounterInc }),
          },
        },
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
    mockProcessEvent.mockResolvedValue('processed');

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
    expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.start', status: 'success' });
  });

  it('increments counter with status=duplicate when inbox dedups the event', async () => {
    mockProcessEvent.mockResolvedValue('duplicate');
    mockCounterInc.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/outboxy',
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      payload: JSON.parse(createWebhookPayload()),
    });

    expect(response.statusCode).toBe(200);
    expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.start', status: 'duplicate' });
    expect(mockCounterInc).not.toHaveBeenCalledWith({ event_type: 'run.start', status: 'success' });
  });

  it('increments counter with status=invalid when envelope fails inner schema parse', async () => {
    mockProcessEvent.mockResolvedValue('invalid');
    mockCounterInc.mockClear();

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/outboxy',
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      payload: JSON.parse(createWebhookPayload()),
    });

    expect(response.statusCode).toBe(200);
    expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.start', status: 'invalid' });
    expect(mockCounterInc).not.toHaveBeenCalledWith({ event_type: 'run.start', status: 'success' });
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
      mockCounterInc.mockClear();
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
      expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.start', status: 'retryable' });
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
      expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.start', status: 'failed' });
    });

    it('logs summary at error level for mixed batch with non-retryable failures', async () => {
      mockProcessEvent
        .mockResolvedValueOnce('processed')
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
      expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.start', status: 'success' });
      expect(mockCounterInc).toHaveBeenCalledWith({ event_type: 'run.end', status: 'failed' });
    });
  });
});
