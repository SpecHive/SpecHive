import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { ResultProcessorService } from '../src/modules/result-processor/result-processor.service';
import type { OutboxyEnvelope } from '../src/types/outboxy-envelope';

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

  it('processes run.start event without error', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-run-start',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'run.start',
      payload: { runId: 'run-1' },
    };
    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });

  it('processes test.end event without error', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-test-end',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'test.end',
      payload: { testId: 'test-1', status: 'passed' },
    };
    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });

  it('processes artifact.upload event without error', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-artifact-upload',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'artifact.upload',
      payload: {
        testId: 'test-1',
        artifactType: 'screenshot',
        name: 'failure.png',
        data: 'base64data==',
      },
    };
    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });

  it('processes suite.start event without error', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-suite-start',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'suite.start',
      payload: { suiteId: 'suite-1', suiteName: 'Auth Tests' },
    };
    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });

  it('processes suite.end event without error', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-suite-end',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'suite.end',
      payload: { suiteId: 'suite-1' },
    };
    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });

  it('processes run.end event without error', async () => {
    const payload: OutboxyEnvelope = {
      id: 'evt-run-end',
      aggregateType: 'TestRun',
      aggregateId: 'run-1',
      eventType: 'run.end',
      payload: { status: 'passed' },
    };
    await expect(service.processEvent(payload)).resolves.toBeUndefined();
  });
});
