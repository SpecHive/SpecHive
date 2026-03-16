/* eslint-disable no-console */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ProjectId,
  type SuiteId,
  ArtifactType,
  MembershipRole,
  RunStatus,
  TOKEN_PREFIX_LENGTH,
  TestStatus,
  asProjectId,
  asRunId,
  asSuiteId,
} from '@spechive/shared-types';
import { hash } from 'argon2';
import { eq } from 'drizzle-orm';

import { createDbConnection, getRawClient } from './connection.js';
import { artifacts, runs, suites, tests } from './schema/execution.js';
import { projects, projectTokens } from './schema/project.js';
import { organizations, users, memberships } from './schema/tenant.js';

// ============================================================================
// Deterministic PRNG (seeded Linear Congruential Generator)
// ============================================================================

function createPRNG(seed: number) {
  let state = seed;
  return {
    next(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)]!;
    },
    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}

const rng = createPRNG(42);

// ============================================================================
// Helper Functions
// ============================================================================

function generateTimestamp(daysAgo: number, hourOffset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() + hourOffset);
  return date;
}

function generateCommitSha(): string {
  return randomBytes(20).toString('hex');
}

/** Returns a daily pass rate with deliberate variation to simulate regressions */
function getDailyPassRate(baseRate: number, dayIndex: number): number {
  const regressionDays = [5, 12, 20, 27];
  const isRegressionDay = regressionDays.includes(dayIndex);
  const modifier = isRegressionDay ? -0.25 : rng.next() * 0.1 - 0.05;
  return Math.max(0.3, Math.min(1.0, baseRate + modifier));
}

const RUN_NAMES: (string | null)[] = [
  'Nightly E2E',
  'PR #142 Checks',
  'Release v1.2.0',
  null,
  'Smoke Tests',
  null,
  'Merge Queue',
  'PR #87 Checks',
  null,
  'Hotfix Validation',
];

// ============================================================================
// Project Configuration
// ============================================================================

interface ProjectConfig {
  name: string;
  runCount: number;
  testsPerRun: { min: number; max: number };
  suiteConfig: { depth: number; suitesPerLevel: number };
  artifactTypes: ArtifactType[];
  passRate: number;
  testNames: string[];
  durationRange: { min: number; max: number };
}

const FRONTEND_E2E_TESTS = [
  'should login with email',
  'should login with OAuth',
  'should handle MFA',
  'should register new user',
  'should validate email format',
  'should reject duplicate email',
  'should send password reset email',
  'should display dashboard correctly',
  'should navigate to settings',
  'should update user profile',
  'should upload avatar image',
  'should filter data table',
  'should sort by column',
  'should paginate results',
  'should export to CSV',
  'should handle file upload',
  'should display error toast',
  'should validate form fields',
  'should toggle dark mode',
  'should respond to keyboard shortcuts',
  'should load lazy components',
  'should handle network timeout',
  'should display loading skeleton',
  'should cache API responses',
  'should handle offline mode',
  'should sync when back online',
  'should render charts correctly',
  'should handle date picker',
  'should support drag and drop',
  'should print report',
];

const BACKEND_API_TESTS = [
  'GET /api/users should return paginated list',
  'GET /api/users/:id should return user details',
  'POST /api/users should create user',
  'PUT /api/users/:id should update user',
  'DELETE /api/users/:id should soft delete user',
  'GET /api/projects should filter by org',
  'POST /api/projects should validate required fields',
  'GET /api/runs should include test counts',
  'POST /api/runs should create with status pending',
  'PUT /api/runs/:id should update status',
  'GET /api/tests should populate suite',
  'GET /api/artifacts should include signed URL',
  'POST /api/auth/login should return JWT',
  'POST /api/auth/login should reject invalid credentials',
  'POST /api/auth/refresh should rotate token',
  'POST /api/auth/logout should invalidate session',
  'GET /api/health should return 200',
  'GET /api/health/db should check connection',
  'POST /api/webhooks should validate signature',
  'GET /api/metrics should return prometheus format',
  'POST /api/tokens should hash token',
  'DELETE /api/tokens/:id should revoke',
  'GET /api/organizations/:id/members should list',
  'POST /api/organizations/:id/invites should send email',
  'PUT /api/organizations/:id should require owner',
  'GET /api/audit-log should filter by date',
  'POST /api/upload should store in S3',
  'GET /api/download should stream file',
  'POST /api/batch should process concurrently',
  'GET /api/search should support full-text',
  'POST /api/export should generate async',
  'GET /api/jobs/:id should return status',
  'DELETE /api/jobs/:id should cancel',
  'GET /api/stats should aggregate by day',
  'POST /api/reports should schedule',
  'GET /api/reports/:id/download should return PDF',
  'PUT /api/settings should validate schema',
  'GET /api/integrations should list connected',
  'POST /api/integrations/:type should OAuth',
  'DELETE /api/integrations/:id should disconnect',
];

const UNIT_TESTS = [
  'formatDate should handle ISO strings',
  'formatDate should handle null',
  'formatDate should use locale',
  'parseId should validate UUIDv7',
  'parseId should reject invalid format',
  'generateToken should be cryptographically random',
  'hashPassword should use argon2id',
  'hashPassword should verify correctly',
  'validateEmail should accept valid addresses',
  'validateEmail should reject invalid domains',
  'truncate should respect maxLength',
  'truncate should add ellipsis',
  'slugify should lowercase and hyphenate',
  'slugify should remove special chars',
  'camelCase should convert snake_case',
  'snakeCase should convert camelCase',
  'deepClone should handle circular refs',
  'deepEqual should compare nested objects',
  'groupBy should aggregate by key',
  'uniqueBy should deduplicate by property',
  'chunk should split into arrays',
  'flatten should recurse nested arrays',
  'debounce should delay execution',
  'throttle should limit calls',
  'memoize should cache results',
  'retry should exponential backoff',
  'timeout should reject after ms',
  'sleep should resolve after ms',
  'range should generate sequence',
  'shuffle should randomize order',
  'sample should pick random elements',
  'compact should remove falsy values',
  'omit should exclude properties',
  'pick should include properties',
  'merge should deep combine',
  'isEmpty should check all types',
  'isPlainObject should distinguish class',
  'sortBy should handle multiple keys',
  'difference should find unique items',
  'intersection should find common items',
  'union should combine unique',
  'zip should pair arrays',
  'unzip should separate pairs',
  'keyBy should map by property',
  'countBy should aggregate counts',
  'sumBy should aggregate numbers',
  'meanBy should calculate average',
  'clamp should constrain value',
  'inRange should check bounds',
  'randomInt should be inclusive',
  'round should handle precision',
  'floor should handle negative',
  'ceil should handle negative',
  'startsWith should check prefix',
  'endsWith should check suffix',
  'capitalize should title case',
  'trim should remove whitespace',
  'padStart should add leading chars',
  'padEnd should add trailing chars',
  'repeat should concatenate',
  'replace should handle regex',
  'split should limit results',
  'join should handle nulls',
  'escapeHtml should encode entities',
  'unescapeHtml should decode entities',
  'escapeRegex should quote metas',
  'template should interpolate',
  'truncateWords should limit count',
  'wordCount should split on spaces',
  'characterCount should include spaces',
  'lineCount should split on newlines',
  'pluralize should handle irregulars',
  'singularize should handle irregulars',
  'toOrdinal should add suffix',
  'toRoman should convert numbers',
  'fromRoman should parse numerals',
  'toWords should spell numbers',
  'fromWords should parse text',
  'levenshtein should measure distance',
  'soundex should phonetic match',
  'fuzzyMatch should tolerate typos',
  'highlightMatches should wrap',
  'parseQuery should extract params',
  'stringifyQuery should encode',
  'parseUrl should handle all parts',
  'isAbsoluteUrl should check protocol',
  'joinUrl should concat paths',
  'normalizeUrl should remove dupe slashes',
  'extractDomain should get hostname',
  'isValidUrl should validate format',
  'parseJson should handle errors',
  'safeStringify should handle circular',
  'deepFreeze should recurse',
  'getType should return accurate type',
  'isPromise should check thenable',
  'isAsyncFunction should detect async',
  'isGeneratorFunction should detect yield',
  'toAsyncIterable should wrap sync',
  'asyncToArray should collect',
  'asyncMap should transform',
  'asyncFilter should predicate',
  'asyncReduce should accumulate',
  'asyncForEach should iterate',
  'asyncSome should short-circuit',
  'asyncEvery should short-circuit',
  'asyncFind should return first',
  'asyncFindIndex should return index',
  'asyncFlatMap should flatten',
  'asyncGroupBy should aggregate',
];

const PROJECTS: ProjectConfig[] = [
  {
    name: 'Frontend E2E',
    runCount: 75,
    testsPerRun: { min: 15, max: 30 },
    suiteConfig: { depth: 3, suitesPerLevel: 3 },
    artifactTypes: [ArtifactType.Screenshot, ArtifactType.Trace, ArtifactType.Video],
    passRate: 0.7,
    testNames: FRONTEND_E2E_TESTS,
    durationRange: { min: 50, max: 8000 },
  },
  {
    name: 'Backend API',
    runCount: 60,
    testsPerRun: { min: 20, max: 40 },
    suiteConfig: { depth: 2, suitesPerLevel: 4 },
    artifactTypes: [ArtifactType.Log],
    passRate: 0.85,
    testNames: BACKEND_API_TESTS,
    durationRange: { min: 5, max: 1000 },
  },
  {
    name: 'Unit Tests',
    runCount: 90,
    testsPerRun: { min: 50, max: 100 },
    suiteConfig: { depth: 2, suitesPerLevel: 5 },
    artifactTypes: [],
    passRate: 0.95,
    testNames: UNIT_TESTS,
    durationRange: { min: 1, max: 100 },
  },
];

// ============================================================================
// Error Messages & Stack Traces
// ============================================================================

const ERROR_MESSAGES = [
  'Expected element to be visible but it was not found',
  'Expected status code 200 but received 500',
  'Element timed out after 30000ms waiting for selector',
  'AssertionError: expected true to be false',
  'TypeError: Cannot read properties of undefined',
  'Network request failed: ECONNREFUSED',
  'Validation error: Required field missing',
  'Database connection timeout exceeded',
  'Expected array length 3 but got 2',
  'Promise rejected with error: Unauthorized',
  'Element is not clickable at point (120, 450)',
  'Expected null to equal "success"',
  'Failed to parse JSON response: Unexpected token',
];

const STACK_TRACE_FRAGMENTS = [
  'at Object.<anonymous> (tests/e2e/auth.spec.ts:42:5)',
  'at processTicksAndRejections (node:internal/process/task_queues:95:5)',
  'at async Page.click (node_modules/playwright-core/lib/client/page.js:1234:56)',
  'at TestRunner.runTest (node_modules/@jest/core/build/runTest.js:567:23)',
  'at describe.it (tests/api/users.test.ts:89:12)',
  'at async Promise.all (index 0)',
  'at runNextTicks (node:internal/process/task_queues:64:3)',
  'at validateInput (src/middleware/validation.ts:45:11)',
  'at handleRequest (src/controllers/users.ts:112:18)',
  'at fetchWithRetry (src/utils/http.ts:23:9)',
];

function generateStackTrace(): string {
  const depth = rng.nextInt(3, 6);
  const frames = [];
  for (let i = 0; i < depth; i++) {
    frames.push(rng.pick(STACK_TRACE_FRAGMENTS));
  }
  return frames.join('\n    ');
}

// ============================================================================
// Suite Generation
// ============================================================================

interface SuiteContext {
  id: string;
  name: string;
  depth: number;
  children: SuiteContext[];
}

const SUITE_NAMES_BY_DEPTH: string[][] = [
  ['Auth Suite', 'Dashboard Suite', 'API Suite', 'Integration Suite', 'Core Suite'],
  ['Login Tests', 'Registration Tests', 'User Management', 'Data Operations', 'Export Tests'],
  [
    'Email Validation',
    'OAuth Flow',
    'Password Reset',
    'Profile Updates',
    'Permissions',
    'Query Params',
    'Pagination',
    'Error Handling',
  ],
];

function generateSuiteHierarchy(
  depth: number,
  suitesPerLevel: number,
  currentDepth = 0,
): SuiteContext[] {
  if (currentDepth >= depth) return [];

  const names = SUITE_NAMES_BY_DEPTH[currentDepth] ?? SUITE_NAMES_BY_DEPTH[0]!;
  const count = Math.min(suitesPerLevel, names.length);
  const suites: SuiteContext[] = [];

  for (let i = 0; i < count; i++) {
    const suite: SuiteContext = {
      id: `temp-${currentDepth}-${i}`,
      name: names[i]!,
      depth: currentDepth,
      children: generateSuiteHierarchy(depth, suitesPerLevel, currentDepth + 1),
    };
    suites.push(suite);
  }

  return suites;
}

function getLeafSuites(suites: SuiteContext[]): SuiteContext[] {
  const leaves: SuiteContext[] = [];
  function traverse(suite: SuiteContext) {
    if (suite.children.length === 0) {
      leaves.push(suite);
    } else {
      for (const child of suite.children) {
        traverse(child);
      }
    }
  }
  for (const suite of suites) {
    traverse(suite);
  }
  return leaves;
}

// ============================================================================
// Main Seed Function
// ============================================================================

export async function seed(dbUrl: string, password?: string) {
  const db = createDbConnection(dbUrl);

  try {
    console.log('Seeding database with enhanced test data...');

    // ========================================================================
    // Organization & User Setup
    // ========================================================================

    const [org] = await db
      .insert(organizations)
      .values({ name: 'SpecHive', slug: 'spechive' })
      .onConflictDoNothing()
      .returning();

    const seedOrg =
      org ??
      (await db.query.organizations.findFirst({
        where: (orgs, { eq }) => eq(orgs.slug, 'spechive'),
      }));

    if (!seedOrg) throw new Error('Failed to seed organization');

    const seedPassword = password ?? 'changeme';
    if (!password) {
      console.warn(
        '[seed] Using default password "changeme" — set SEED_USER_PASSWORD for a custom password',
      );
    }
    const passwordHash = await hash(seedPassword, { type: 2 });
    const [user] = await db
      .insert(users)
      .values({
        email: 'admin@spechive.dev',
        passwordHash,
        name: 'Admin',
      })
      .onConflictDoNothing()
      .returning();

    const seedUser =
      user ??
      (await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, 'admin@spechive.dev'),
      }));

    if (!seedUser) throw new Error('Failed to seed user');

    await db
      .insert(memberships)
      .values({
        organizationId: seedOrg.id,
        userId: seedUser.id,
        role: MembershipRole.Owner,
      })
      .onConflictDoNothing();

    // ========================================================================
    // Create Projects
    // ========================================================================

    const createdProjects: { id: ProjectId; config: ProjectConfig }[] = [];

    for (const config of PROJECTS) {
      const [project] = await db
        .insert(projects)
        .values({
          organizationId: seedOrg.id,
          name: config.name,
        })
        .onConflictDoNothing()
        .returning();

      const seedProject =
        project ??
        (await db.query.projects.findFirst({
          where: (p, { eq, and }) => and(eq(p.name, config.name), eq(p.organizationId, seedOrg.id)),
        }));

      if (!seedProject) {
        console.error(`Failed to seed project: ${config.name}`);
        continue;
      }

      createdProjects.push({ id: asProjectId(seedProject.id), config });

      // Create project token
      const plainToken = randomBytes(32).toString('hex');
      const tokenPrefix = plainToken.slice(0, TOKEN_PREFIX_LENGTH);
      const tokenHash = await hash(plainToken, { type: 2 });

      await db
        .insert(projectTokens)
        .values({
          projectId: seedProject.id,
          organizationId: seedOrg.id,
          name: `${config.name} Token`,
          tokenHash,
          tokenPrefix,
        })
        .onConflictDoNothing();

      console.log(`Created project: ${config.name} with token: ${plainToken}`);
    }

    // ========================================================================
    // Generate Runs, Suites, Tests, and Artifacts for Each Project
    // ========================================================================

    for (const { id: projectId, config } of createdProjects) {
      console.log(`\nGenerating data for ${config.name}...`);

      // Distribute runs across last 30 days
      const runDates: number[] = [];
      for (let i = 0; i < config.runCount; i++) {
        runDates.push(Math.floor((i / config.runCount) * 30));
      }
      const shuffledDates = rng.shuffle(runDates);
      runDates.length = 0;
      runDates.push(...shuffledDates);

      for (let runIndex = 0; runIndex < config.runCount; runIndex++) {
        const daysAgo = runDates[runIndex]!;
        const startedAt = generateTimestamp(daysAgo, rng.nextInt(0, 23));
        const testCount = rng.nextInt(config.testsPerRun.min, config.testsPerRun.max);
        const dailyPassRate = getDailyPassRate(config.passRate, daysAgo);

        // Per-run speed factor: some runs 0.5x-2x speed
        const runSpeedFactor = 0.5 + rng.next() * 1.5;

        // Determine run status based on daily pass rate (most recent runs may be running)
        let runStatus: RunStatus;
        if (runIndex < 2 && rng.next() < 0.3) {
          runStatus = RunStatus.Running;
        } else {
          const statusRoll = rng.next();
          if (statusRoll < 0.02) {
            runStatus = RunStatus.Cancelled;
          } else if (statusRoll < 0.02 + (1 - dailyPassRate)) {
            runStatus = RunStatus.Failed;
          } else {
            runStatus = RunStatus.Passed;
          }
        }

        // Vary run durations: 30s to 15min, scaled by speed factor
        const runDurationMs = Math.round(rng.nextInt(30_000, 900_000) * runSpeedFactor);
        const finishedAt =
          runStatus === RunStatus.Running ? null : new Date(startedAt.getTime() + runDurationMs);

        const runName = RUN_NAMES[runIndex % RUN_NAMES.length] ?? null;

        const seedBranch = rng.pick([
          'main',
          'develop',
          'feature/auth',
          'fix/login',
          'release/v1.0',
        ]);
        const seedCommitSha = generateCommitSha();
        const seedCiProvider = rng.pick(['github-actions', 'gitlab-ci', 'jenkins', 'circleci']);

        const [run] = await db
          .insert(runs)
          .values({
            projectId,
            organizationId: seedOrg.id,
            name: runName,
            status: runStatus,
            totalTests: testCount,
            passedTests: 0, // Will update after creating tests
            failedTests: 0,
            skippedTests: 0,
            startedAt,
            finishedAt,
            branch: seedBranch,
            commitSha: seedCommitSha,
            ciProvider: seedCiProvider,
            ciUrl: `https://ci.example.com/builds/${1000 + runIndex}`,
            metadata: {
              buildNumber: 1000 + runIndex,
              triggeredBy: rng.pick(['push', 'schedule', 'manual', 'webhook']),
            },
          })
          .onConflictDoNothing()
          .returning();

        if (!run) {
          console.log(`  Run ${runIndex + 1} already exists, skipping...`);
          continue;
        }

        // Generate suite hierarchy
        const suiteHierarchy = generateSuiteHierarchy(
          config.suiteConfig.depth,
          config.suiteConfig.suitesPerLevel,
        );

        // Insert suites recursively and track IDs
        const suiteIdMap = new Map<string, string>();

        async function insertSuites(
          suitesToInsert: SuiteContext[],
          parentSuiteId: SuiteId | null = null,
        ): Promise<void> {
          for (const suite of suitesToInsert) {
            const [inserted] = await db
              .insert(suites)
              .values({
                runId: run.id,
                organizationId: seedOrg.id,
                name: suite.name,
                parentSuiteId,
              })
              .onConflictDoNothing()
              .returning();

            if (!inserted) continue;

            suiteIdMap.set(suite.id, inserted.id);
            await insertSuites(suite.children, asSuiteId(inserted.id));
          }
        }

        await insertSuites(suiteHierarchy);

        // Get leaf suites to assign tests
        const leafSuites = getLeafSuites(suiteHierarchy);
        const leafSuiteIds = leafSuites
          .map((s) => suiteIdMap.get(s.id))
          .filter((id): id is string => id !== undefined)
          .map((id) => asSuiteId(id));

        if (leafSuiteIds.length === 0) {
          // Fallback: create a single suite if hierarchy generation failed
          const [fallbackSuite] = await db
            .insert(suites)
            .values({
              runId: run.id,
              organizationId: seedOrg.id,
              name: 'Tests',
            })
            .onConflictDoNothing()
            .returning();

          if (fallbackSuite) {
            leafSuiteIds.push(asSuiteId(fallbackSuite.id));
          }
        }

        // Distribute tests across leaf suites
        const testsPerSuite = Math.ceil(testCount / leafSuiteIds.length);
        const testsToCreate: (typeof tests.$inferInsert)[] = [];
        const testStatusCounts = { passed: 0, failed: 0, skipped: 0, flaky: 0 };

        // Shuffle and select test names
        const shuffledNames = rng.shuffle(config.testNames);
        let testNameIndex = 0;

        for (const suiteId of leafSuiteIds) {
          const suiteTestCount = Math.min(testsPerSuite, testCount - testsToCreate.length);

          for (let t = 0; t < suiteTestCount && testNameIndex < shuffledNames.length; t++) {
            const testName = shuffledNames[testNameIndex]!;
            testNameIndex++;

            // Determine test status based on run status and daily pass rate
            let testStatus: TestStatus;
            if (runStatus === RunStatus.Running) {
              testStatus = rng.pick([TestStatus.Passed, TestStatus.Running, TestStatus.Pending]);
              if (testStatus === TestStatus.Passed) testStatusCounts.passed++;
            } else if (runStatus === RunStatus.Cancelled) {
              testStatus = rng.pick([TestStatus.Passed, TestStatus.Skipped, TestStatus.Failed]);
              testStatusCounts[
                testStatus === TestStatus.Passed
                  ? 'passed'
                  : testStatus === TestStatus.Skipped
                    ? 'skipped'
                    : 'failed'
              ]++;
            } else {
              const statusRoll = rng.next();
              if (statusRoll < 0.05) {
                testStatus = TestStatus.Flaky;
                testStatusCounts.flaky++;
              } else if (statusRoll < 0.05 + 0.05) {
                testStatus = TestStatus.Skipped;
                testStatusCounts.skipped++;
              } else if (statusRoll < 0.1 + (1 - dailyPassRate)) {
                testStatus = TestStatus.Failed;
                testStatusCounts.failed++;
              } else {
                testStatus = TestStatus.Passed;
                testStatusCounts.passed++;
              }
            }

            const duration = Math.round(
              rng.nextInt(config.durationRange.min, config.durationRange.max) * runSpeedFactor,
            );
            const testStartedAt = new Date(startedAt.getTime() + rng.nextInt(0, 60_000));
            const testFinishedAt = new Date(testStartedAt.getTime() + duration);

            testsToCreate.push({
              suiteId,
              runId: run.id,
              organizationId: seedOrg.id,
              name: testName,
              status: testStatus,
              durationMs: duration,
              errorMessage: testStatus === TestStatus.Failed ? rng.pick(ERROR_MESSAGES) : null,
              stackTrace: testStatus === TestStatus.Failed ? generateStackTrace() : null,
              retryCount: testStatus === TestStatus.Flaky ? rng.nextInt(1, 3) : 0,
              startedAt: testStartedAt,
              finishedAt: testFinishedAt,
              createdAt: testStartedAt,
            });
          }
        }

        // Batch insert tests
        const insertedTests = await db
          .insert(tests)
          .values(testsToCreate)
          .onConflictDoNothing()
          .returning();

        // Update run with actual test counts
        await db
          .update(runs)
          .set({
            totalTests: testsToCreate.length,
            passedTests: testStatusCounts.passed,
            failedTests: testStatusCounts.failed,
            skippedTests: testStatusCounts.skipped,
            flakyTests: testStatusCounts.flaky,
          })
          .where(eq(runs.id, asRunId(run.id)));

        // Create artifacts based on project config
        const artifactsToCreate: (typeof artifacts.$inferInsert)[] = [];

        for (const test of insertedTests) {
          // Always add video for E2E tests
          if (config.name === 'Frontend E2E' && config.artifactTypes.includes(ArtifactType.Video)) {
            artifactsToCreate.push({
              testId: test.id,
              organizationId: seedOrg.id,
              type: ArtifactType.Video,
              name: `${test.name}.webm`,
              storagePath: `spechive-artifacts/${projectId}/${run.id}/${test.id}/video.webm`,
              sizeBytes: rng.nextInt(500_000, 5_000_000),
              mimeType: 'video/webm',
            });
          }

          // Add screenshot for all tests (E2E) or just failed tests
          if (
            config.artifactTypes.includes(ArtifactType.Screenshot) &&
            (config.name === 'Frontend E2E' || test.status === TestStatus.Failed)
          ) {
            artifactsToCreate.push({
              testId: test.id,
              organizationId: seedOrg.id,
              type: ArtifactType.Screenshot,
              name: `${test.name}.png`,
              storagePath: `spechive-artifacts/${projectId}/${run.id}/${test.id}/screenshot.png`,
              sizeBytes: rng.nextInt(50_000, 500_000),
              mimeType: 'image/png',
            });
          }

          // Add trace for failed E2E tests
          if (
            test.status === TestStatus.Failed &&
            config.artifactTypes.includes(ArtifactType.Trace)
          ) {
            artifactsToCreate.push({
              testId: test.id,
              organizationId: seedOrg.id,
              type: ArtifactType.Trace,
              name: `${test.name}.trace`,
              storagePath: `spechive-artifacts/${projectId}/${run.id}/${test.id}/trace.json`,
              sizeBytes: rng.nextInt(100_000, 2_000_000),
              mimeType: 'application/json',
            });
          }

          // Add log for backend tests
          if (config.name === 'Backend API' && config.artifactTypes.includes(ArtifactType.Log)) {
            artifactsToCreate.push({
              testId: test.id,
              organizationId: seedOrg.id,
              type: ArtifactType.Log,
              name: `${test.name}.log`,
              storagePath: `spechive-artifacts/${projectId}/${run.id}/${test.id}/test.log`,
              sizeBytes: rng.nextInt(1_000, 50_000),
              mimeType: 'text/plain',
            });
          }
        }

        if (artifactsToCreate.length > 0) {
          await db.insert(artifacts).values(artifactsToCreate).onConflictDoNothing();
        }

        console.log(
          `  Run ${runIndex + 1}: ${runStatus} - ${testsToCreate.length} tests, ${artifactsToCreate.length} artifacts`,
        );
      }
    }

    console.log('\nSeed completed successfully!');
    console.log('\nSummary:');
    console.log(`  Organizations: 1`);
    console.log(`  Projects: ${PROJECTS.length}`);
    console.log(`  Total runs: ${PROJECTS.reduce((sum, p) => sum + p.runCount, 0)}`);
  } finally {
    const client = getRawClient(db);
    await client.end();
  }
}

// CLI entry point
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('Seed script cannot run in production. Aborting.');
    process.exit(1);
  }
  const url = process.env['SEED_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!url) {
    console.error('SEED_DATABASE_URL or DATABASE_URL environment variable is required');
    process.exit(1);
  }
  seed(url, process.env['SEED_USER_PASSWORD']).catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
