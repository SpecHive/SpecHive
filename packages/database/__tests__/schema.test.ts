import { getTableName } from 'drizzle-orm';
import { describe, it, expect } from 'vitest';

import {
  organizations,
  users,
  memberships,
  projects,
  projectTokens,
  runs,
  suites,
  tests,
  artifacts,
  membershipRoleEnum,
  runStatusEnum,
  testStatusEnum,
  artifactTypeEnum,
  organizationsRelations,
  usersRelations,
  membershipsRelations,
  projectsRelations,
  projectTokensRelations,
  runsRelations,
  suitesRelations,
  testsRelations,
  artifactsRelations,
  createDbConnection,
  setTenantContext,
} from '../src/index.js';

describe('schema tables', () => {
  const tableFixtures = [
    { table: organizations, expectedName: 'organizations' },
    { table: users, expectedName: 'users' },
    { table: memberships, expectedName: 'memberships' },
    { table: projects, expectedName: 'projects' },
    { table: projectTokens, expectedName: 'project_tokens' },
    { table: runs, expectedName: 'runs' },
    { table: suites, expectedName: 'suites' },
    { table: tests, expectedName: 'tests' },
    { table: artifacts, expectedName: 'artifacts' },
  ] as const;

  it.each(tableFixtures)('$expectedName is a Drizzle table object', ({ table }) => {
    expect(table).toBeDefined();
    // Drizzle tables expose a Symbol-keyed internal property; the presence of
    // getTableName succeeding without throwing confirms the value is a valid table.
    expect(() => getTableName(table)).not.toThrow();
  });

  it.each(tableFixtures)(
    '$expectedName has the correct SQL table name',
    ({ table, expectedName }) => {
      expect(getTableName(table)).toBe(expectedName);
    },
  );
});

describe('schema enums', () => {
  it('membershipRoleEnum is exported', () => {
    expect(membershipRoleEnum).toBeDefined();
    expect(typeof membershipRoleEnum).toBe('function');
  });

  it('runStatusEnum is exported', () => {
    expect(runStatusEnum).toBeDefined();
    expect(typeof runStatusEnum).toBe('function');
  });

  it('testStatusEnum is exported', () => {
    expect(testStatusEnum).toBeDefined();
    expect(typeof testStatusEnum).toBe('function');
  });

  it('artifactTypeEnum is exported', () => {
    expect(artifactTypeEnum).toBeDefined();
    expect(typeof artifactTypeEnum).toBe('function');
  });
});

describe('schema relations', () => {
  const relationFixtures = [
    { name: 'organizationsRelations', relation: organizationsRelations },
    { name: 'usersRelations', relation: usersRelations },
    { name: 'membershipsRelations', relation: membershipsRelations },
    { name: 'projectsRelations', relation: projectsRelations },
    { name: 'projectTokensRelations', relation: projectTokensRelations },
    { name: 'runsRelations', relation: runsRelations },
    { name: 'suitesRelations', relation: suitesRelations },
    { name: 'testsRelations', relation: testsRelations },
    { name: 'artifactsRelations', relation: artifactsRelations },
  ] as const;

  it.each(relationFixtures)('$name is exported and defined', ({ relation }) => {
    expect(relation).toBeDefined();
  });
});

describe('connection utilities', () => {
  it('createDbConnection is exported as a function', () => {
    expect(createDbConnection).toBeDefined();
    expect(typeof createDbConnection).toBe('function');
  });

  it('setTenantContext is exported as a function', () => {
    expect(setTenantContext).toBeDefined();
    expect(typeof setTenantContext).toBe('function');
  });
});
