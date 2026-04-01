/* eslint-disable no-console */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ProjectId,
  ArtifactType,
  MembershipRole,
  RunStatus,
  TOKEN_PREFIX_LENGTH,
  TestStatus,
  asProjectId,
  asRunId,
  asSuiteId,
  asTestId,
} from '@spechive/shared-types';
import { hash } from 'argon2';
import { uuidv7 } from 'uuidv7';

import { backfillDailyStats } from './backfill-daily-stats.js';
import { type Database, createDbConnection, getRawClient } from './connection.js';
import { artifacts, runs, suites, tests } from './schema/execution.js';
import { projects, projectTokens } from './schema/project.js';
import { organizations, users, memberships } from './schema/tenant.js';

// Deterministic PRNG (seeded Linear Congruential Generator)

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

// Scale Configuration

export type SeedScale = 'small' | 'medium' | 'large';

interface ScaleConfig {
  runMultiplier: number;
  timeWindowDays: number;
  regressionDays: number[];
}

const SCALE_CONFIGS: Record<SeedScale, ScaleConfig> = {
  small: {
    runMultiplier: 1,
    timeWindowDays: 30,
    regressionDays: [5, 12, 20, 27],
  },
  medium: {
    runMultiplier: 10,
    timeWindowDays: 60,
    regressionDays: [5, 12, 20, 27, 35, 42, 50, 57],
  },
  large: {
    runMultiplier: 50,
    timeWindowDays: 90,
    regressionDays: [5, 12, 20, 27, 35, 42, 50, 57, 65, 72, 80, 87],
  },
};

// Batch Insert Helpers

const PG_PARAM_LIMIT = 65_534;

async function insertBatched(
  db: Database,
  table: Parameters<Database['insert']>[0],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  columnsPerRow: number,
): Promise<void> {
  if (rows.length === 0) return;
  const chunkSize = Math.floor(PG_PARAM_LIMIT / columnsPerRow);
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db
      .insert(table)
      .values(rows.slice(i, i + chunkSize))
      .onConflictDoNothing();
  }
}

function logProgress(entity: string, current: number, total: number): void {
  const pct = Math.round((current / total) * 100);
  process.stdout.write(
    `\r  ${entity}: ${current.toLocaleString()}/${total.toLocaleString()} (${pct}%)`,
  );
  if (current >= total) process.stdout.write('\n');
}

// Helper Functions

function generateTimestamp(daysAgo: number, hourOffset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() + hourOffset);
  return date;
}

function generateCommitSha(): string {
  return randomBytes(20).toString('hex');
}

function getDailyPassRate(baseRate: number, dayIndex: number, regressionDays: number[]): number {
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

// Project Configuration

interface ProjectConfig {
  name: string;
  runCount: number;
  testsPerRun: { min: number; max: number };
  suiteConfig: { depth: number; suitesPerLevel: number };
  artifactTypes: ArtifactType[];
  passRate: number;
  testNames: string[];
  durationRange: { min: number; max: number };
  runDurationRange: { min: number; max: number };
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
    runDurationRange: { min: 300_000, max: 900_000 },
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
    runDurationRange: { min: 60_000, max: 300_000 },
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
    runDurationRange: { min: 20_000, max: 90_000 },
  },
];

// Error Messages & Stack Traces

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

/**
 * Deterministic base duration for a test name within a given range.
 * Uses a string hash so the same test always gets a similar duration.
 * Quadratic skew: most tests are fast, few are slow (realistic distribution).
 */
function getTestBaseDuration(testName: string, range: { min: number; max: number }): number {
  let hash = 0;
  for (let i = 0; i < testName.length; i++) {
    hash = ((hash << 5) - hash + testName.charCodeAt(i)) | 0;
  }
  const normalized = (((hash % 10_000) + 10_000) % 10_000) / 10_000;
  const skewed = normalized * normalized;
  return Math.round(range.min + skewed * (range.max - range.min));
}

// Suite Generation

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

interface FlatSuiteRow {
  id: string;
  runId: string;
  organizationId: string;
  name: string;
  parentSuiteId: string | null;
}

/**
 * Flatten a suite hierarchy into insert-ready rows with pre-generated UUIDs (parent-first order).
 * Deduplicates by name within a run because suites have a unique constraint on (run_id, name).
 */
function flattenSuiteHierarchy(
  hierarchy: SuiteContext[],
  runId: string,
  orgId: string,
): { rows: FlatSuiteRow[]; leafSuiteIds: string[] } {
  const rows: FlatSuiteRow[] = [];
  const leafSuiteIds: string[] = [];
  const nameToId = new Map<string, string>();

  function walk(nodes: SuiteContext[], parentId: string | null) {
    for (const node of nodes) {
      let realId = nameToId.get(node.name);
      if (!realId) {
        realId = uuidv7();
        nameToId.set(node.name, realId);
        rows.push({
          id: realId,
          runId,
          organizationId: orgId,
          name: node.name,
          parentSuiteId: parentId,
        });
      }
      if (node.children.length === 0) {
        leafSuiteIds.push(realId);
      } else {
        walk(node.children, realId);
      }
    }
  }

  walk(hierarchy, null);
  return { rows, leafSuiteIds: [...new Set(leafSuiteIds)] };
}

// Main Seed Function

export async function seed(dbUrl: string, password?: string, scale: SeedScale = 'small') {
  const db = createDbConnection(dbUrl);
  const scaleConfig = SCALE_CONFIGS[scale];
  const { runMultiplier, timeWindowDays, regressionDays } = scaleConfig;

  try {
    console.log(`Seeding database (scale: ${scale}, multiplier: ${runMultiplier}x)...`);

    // Reset database — safe because seed only runs in non-production environments
    const rawClient = getRawClient(db);
    await rawClient`TRUNCATE organizations, users CASCADE`;
    console.log('Truncated all tables.');

    // Organization & User Setup

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

    // Create Projects

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

    // Phase 1: Generate & Insert All Runs

    interface RunMeta {
      id: string;
      projectId: string;
      configIndex: number;
      status: RunStatus;
      startedAt: Date;
      speedFactor: number;
      dailyPassRate: number;
      testCount: number;
      runIndex: number;
      daysAgo: number;
    }

    const allRunRows: (typeof runs.$inferInsert)[] = [];
    const runMetas: RunMeta[] = [];

    for (const { id: projectId, config } of createdProjects) {
      const scaledRunCount = config.runCount * runMultiplier;
      const configIndex = createdProjects.findIndex((p) => p.id === projectId);

      const runDates: number[] = [];
      for (let i = 0; i < scaledRunCount; i++) {
        runDates.push(Math.floor((i / scaledRunCount) * timeWindowDays));
      }
      const shuffledDates = rng.shuffle(runDates);

      for (let runIndex = 0; runIndex < scaledRunCount; runIndex++) {
        const daysAgo = shuffledDates[runIndex]!;
        const startedAt = generateTimestamp(daysAgo, rng.nextInt(0, 23));
        const testCount = rng.nextInt(config.testsPerRun.min, config.testsPerRun.max);
        const dailyPassRate = getDailyPassRate(config.passRate, daysAgo, regressionDays);
        const runSpeedFactor = 0.9 + rng.next() * 0.2;

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

        const timeGrowth = 1 + 0.18 * (1 - daysAgo / timeWindowDays);
        const runDurationMs = Math.round(
          rng.nextInt(config.runDurationRange.min, config.runDurationRange.max) *
            runSpeedFactor *
            timeGrowth,
        );
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

        const runId = asRunId(uuidv7());

        allRunRows.push({
          id: runId,
          projectId,
          organizationId: seedOrg.id,
          name: runName,
          status: runStatus,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          expectedTests: 0,
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
        });

        runMetas.push({
          id: runId,
          projectId,
          configIndex,
          status: runStatus,
          startedAt,
          speedFactor: runSpeedFactor,
          dailyPassRate,
          testCount,
          runIndex,
          daysAgo,
        });
      }
    }

    const totalRuns = allRunRows.length;
    console.log(`\nPhase 1: Inserting ${totalRuns.toLocaleString()} runs...`);
    await insertBatched(db, runs, allRunRows, 17);
    logProgress('Runs', totalRuns, totalRuns);

    // Phase 2: Generate & Insert All Suites

    const runLeafSuiteMap = new Map<string, string[]>();
    const allSuiteRows: FlatSuiteRow[] = [];

    for (const meta of runMetas) {
      const config = createdProjects[meta.configIndex]!.config;
      const hierarchy = generateSuiteHierarchy(
        config.suiteConfig.depth,
        config.suiteConfig.suitesPerLevel,
      );
      const { rows, leafSuiteIds } = flattenSuiteHierarchy(hierarchy, meta.id, seedOrg.id);
      allSuiteRows.push(...rows);
      runLeafSuiteMap.set(meta.id, leafSuiteIds);
    }

    const totalSuites = allSuiteRows.length;
    console.log(`Phase 2: Inserting ${totalSuites.toLocaleString()} suites...`);
    await insertBatched(db, suites, allSuiteRows, 5);
    logProgress('Suites', totalSuites, totalSuites);

    // Phase 3: Generate & Insert Tests + Artifacts (per project)

    let totalTests = 0;
    let totalArtifacts = 0;

    for (const { id: projectId, config } of createdProjects) {
      const projectRunMetas = runMetas.filter((m) => m.projectId === projectId);
      const scaledRunCount = projectRunMetas.length;

      console.log(
        `\nPhase 3: Generating tests for ${config.name} (${scaledRunCount.toLocaleString()} runs)...`,
      );

      const allTests: (typeof tests.$inferInsert)[] = [];
      const allArtifacts: (typeof artifacts.$inferInsert)[] = [];
      const runCountUpdates: {
        runId: string;
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        flaky: number;
        expected: number;
      }[] = [];

      for (const meta of projectRunMetas) {
        const leafSuiteIds = runLeafSuiteMap.get(meta.id);
        if (!leafSuiteIds || leafSuiteIds.length === 0) continue;

        const testsPerSuite = Math.ceil(meta.testCount / leafSuiteIds.length);
        const testStatusCounts = { passed: 0, failed: 0, skipped: 0, flaky: 0 };

        const shuffledNames = rng.shuffle(config.testNames);
        let testNameIndex = 0;
        const runTestStart = allTests.length;

        for (const suiteId of leafSuiteIds) {
          const suiteTestCount = Math.min(
            testsPerSuite,
            meta.testCount - (allTests.length - runTestStart),
          );
          for (let t = 0; t < suiteTestCount && testNameIndex < shuffledNames.length; t++) {
            const testName = shuffledNames[testNameIndex]!;
            testNameIndex++;

            let testStatus: TestStatus;
            if (meta.status === RunStatus.Running) {
              testStatus = rng.pick([TestStatus.Passed, TestStatus.Running, TestStatus.Pending]);
              if (testStatus === TestStatus.Passed) testStatusCounts.passed++;
            } else if (meta.status === RunStatus.Cancelled) {
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
              } else if (statusRoll < 0.1 + (1 - meta.dailyPassRate)) {
                testStatus = TestStatus.Failed;
                testStatusCounts.failed++;
              } else {
                testStatus = TestStatus.Passed;
                testStatusCounts.passed++;
              }
            }

            const baseDuration = getTestBaseDuration(testName, config.durationRange);
            const noise = 0.9 + rng.next() * 0.2;
            const testTimeGrowth = 1 + 0.18 * (1 - meta.daysAgo / timeWindowDays);
            const duration = Math.round(baseDuration * noise * testTimeGrowth);
            const testStartedAt = new Date(meta.startedAt.getTime() + rng.nextInt(0, 60_000));
            const testFinishedAt = new Date(testStartedAt.getTime() + duration);

            const testId = asTestId(uuidv7());

            allTests.push({
              id: testId,
              suiteId: asSuiteId(suiteId),
              runId: asRunId(meta.id),
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

            if (
              config.name === 'Frontend E2E' &&
              config.artifactTypes.includes(ArtifactType.Video)
            ) {
              allArtifacts.push({
                testId,
                organizationId: seedOrg.id,
                type: ArtifactType.Video,
                name: `${testName}.webm`,
                storagePath: `spechive-artifacts/${projectId}/${meta.id}/${testId}/video.webm`,
                sizeBytes: rng.nextInt(500_000, 5_000_000),
                mimeType: 'video/webm',
              });
            }

            if (
              config.artifactTypes.includes(ArtifactType.Screenshot) &&
              (config.name === 'Frontend E2E' || testStatus === TestStatus.Failed)
            ) {
              allArtifacts.push({
                testId,
                organizationId: seedOrg.id,
                type: ArtifactType.Screenshot,
                name: `${testName}.png`,
                storagePath: `spechive-artifacts/${projectId}/${meta.id}/${testId}/screenshot.png`,
                sizeBytes: rng.nextInt(50_000, 500_000),
                mimeType: 'image/png',
              });
            }

            if (
              testStatus === TestStatus.Failed &&
              config.artifactTypes.includes(ArtifactType.Trace)
            ) {
              allArtifacts.push({
                testId,
                organizationId: seedOrg.id,
                type: ArtifactType.Trace,
                name: `${testName}.trace`,
                storagePath: `spechive-artifacts/${projectId}/${meta.id}/${testId}/trace.json`,
                sizeBytes: rng.nextInt(100_000, 2_000_000),
                mimeType: 'application/json',
              });
            }

            if (config.name === 'Backend API' && config.artifactTypes.includes(ArtifactType.Log)) {
              allArtifacts.push({
                testId,
                organizationId: seedOrg.id,
                type: ArtifactType.Log,
                name: `${testName}.log`,
                storagePath: `spechive-artifacts/${projectId}/${meta.id}/${testId}/test.log`,
                sizeBytes: rng.nextInt(1_000, 50_000),
                mimeType: 'text/plain',
              });
            }
          }
        }

        runCountUpdates.push({
          runId: meta.id,
          total: allTests.length - runTestStart,
          passed: testStatusCounts.passed,
          failed: testStatusCounts.failed,
          skipped: testStatusCounts.skipped,
          flaky: testStatusCounts.flaky,
          expected: allTests.length - runTestStart,
        });
      }

      console.log(`  Inserting ${allTests.length.toLocaleString()} tests...`);
      await insertBatched(db, tests, allTests, 13);
      logProgress('Tests', allTests.length, allTests.length);

      if (allArtifacts.length > 0) {
        console.log(`  Inserting ${allArtifacts.length.toLocaleString()} artifacts...`);
        await insertBatched(db, artifacts, allArtifacts, 8);
        logProgress('Artifacts', allArtifacts.length, allArtifacts.length);
      }

      if (runCountUpdates.length > 0) {
        const client = getRawClient(db);
        const updateChunkSize = 5000;
        for (let i = 0; i < runCountUpdates.length; i += updateChunkSize) {
          const chunk = runCountUpdates.slice(i, i + updateChunkSize);
          await client`
            UPDATE runs AS r SET
              total_tests = v.total,
              passed_tests = v.passed,
              failed_tests = v.failed,
              skipped_tests = v.skipped,
              flaky_tests = v.flaky,
              expected_tests = v.expected
            FROM (
              SELECT
                unnest(${chunk.map((u) => u.runId)}::uuid[]) AS id,
                unnest(${chunk.map((u) => u.total)}::int[]) AS total,
                unnest(${chunk.map((u) => u.passed)}::int[]) AS passed,
                unnest(${chunk.map((u) => u.failed)}::int[]) AS failed,
                unnest(${chunk.map((u) => u.skipped)}::int[]) AS skipped,
                unnest(${chunk.map((u) => u.flaky)}::int[]) AS flaky,
                unnest(${chunk.map((u) => u.expected)}::int[]) AS expected
            ) AS v
            WHERE r.id = v.id
          `;
        }
      }

      totalTests += allTests.length;
      totalArtifacts += allArtifacts.length;

      console.log(
        `  ${config.name}: ${allTests.length.toLocaleString()} tests, ${allArtifacts.length.toLocaleString()} artifacts`,
      );
    }

    console.log('\nSeed completed successfully!');
    console.log('\nSummary:');
    console.log(`  Scale: ${scale} (${runMultiplier}x)`);
    console.log(`  Organizations: 1`);
    console.log(`  Projects: ${PROJECTS.length}`);
    console.log(`  Total runs: ${totalRuns.toLocaleString()}`);
    console.log(`  Total suites: ${totalSuites.toLocaleString()}`);
    console.log(`  Total tests: ${totalTests.toLocaleString()}`);
    console.log(`  Total artifacts: ${totalArtifacts.toLocaleString()}`);

    console.log('\nBackfilling analytics tables...');
    await backfillDailyStats(dbUrl);
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

  const rawScale = process.env['SEED_SCALE'] ?? 'small';
  if (!['small', 'medium', 'large'].includes(rawScale)) {
    console.error(`Invalid SEED_SCALE="${rawScale}". Must be: small, medium, or large`);
    process.exit(1);
  }
  const scale = rawScale as SeedScale;

  seed(url, process.env['SEED_USER_PASSWORD'], scale).catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
