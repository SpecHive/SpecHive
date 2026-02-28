import { createThrottleTestSuite } from '@assertly/nestjs-common/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

createThrottleTestSuite('query-api', { describe, it, expect, beforeEach, afterEach });
