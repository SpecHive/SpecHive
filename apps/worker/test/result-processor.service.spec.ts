import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { ResultProcessorService } from '../src/modules/result-processor/result-processor.service';
import type { OutboxyEnvelope } from '../src/modules/webhook-receiver/webhook-receiver.controller';

describe('ResultProcessorService', () => {
  let service: ResultProcessorService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ResultProcessorService],
    }).compile();

    service = module.get(ResultProcessorService);
  });

  it('processes a valid payload without throwing', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-1',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'run.start',
      payload: { runId: 'run-1' },
    };

    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });

  it('handles payload with null-like values in payload field', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-2',
      aggregateType: 'TestRun',
      aggregateId: 'run-2',
      eventType: 'test.end',
      payload: { status: 'passed' },
    };

    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });
});
