import type {
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
  Reporter,
} from '@playwright/test/reporter';

import type { AssertlyReporterConfig } from './types.js';

export default class AssertlyReporter implements Reporter {
  private readonly config: AssertlyReporterConfig;

  constructor(config: AssertlyReporterConfig) {
    this.config = { enabled: true, batchSize: 100, timeout: 30000, ...config };
  }

  get isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    if (!this.isEnabled) return;
    // TODO: Send run.start event
  }

  onTestBegin(_test: TestCase): void {
    if (!this.isEnabled) return;
    // TODO: Track test start
  }

  onTestEnd(_test: TestCase, _result: TestResult): void {
    if (!this.isEnabled) return;
    // TODO: Send test.end event
  }

  onEnd(_result: FullResult): void {
    if (!this.isEnabled) return;
    // TODO: Send run.end event, flush queue
  }
}

export type { AssertlyReporterConfig } from './types.js';
