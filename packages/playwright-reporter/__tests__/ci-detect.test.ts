import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectCi } from '../src/ci-detect.js';

describe('detectCi', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns undefined when no CI env vars are set', () => {
    // Ensure key sentinel vars are absent
    vi.stubEnv('GITHUB_ACTIONS', '');
    vi.stubEnv('GITLAB_CI', '');
    vi.stubEnv('JENKINS_URL', '');
    vi.stubEnv('CIRCLECI', '');
    vi.stubEnv('TF_BUILD', '');
    vi.stubEnv('CI', '');

    expect(detectCi()).toBeUndefined();
  });

  it('detects GitHub Actions', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('GITHUB_REF_NAME', 'main');
    vi.stubEnv('GITHUB_SHA', 'abc123def456');
    vi.stubEnv('GITHUB_SERVER_URL', 'https://github.com');
    vi.stubEnv('GITHUB_REPOSITORY', 'org/repo');
    vi.stubEnv('GITHUB_RUN_ID', '12345');

    expect(detectCi()).toEqual({
      branch: 'main',
      commitSha: 'abc123def456',
      ciUrl: 'https://github.com/org/repo/actions/runs/12345',
      ciProvider: 'github-actions',
    });
  });

  it('detects GitLab CI', () => {
    vi.stubEnv('GITLAB_CI', 'true');
    vi.stubEnv('CI_COMMIT_BRANCH', 'develop');
    vi.stubEnv('CI_COMMIT_SHA', 'deadbeef');
    vi.stubEnv('CI_PIPELINE_URL', 'https://gitlab.com/org/repo/-/pipelines/99');

    expect(detectCi()).toEqual({
      branch: 'develop',
      commitSha: 'deadbeef',
      ciUrl: 'https://gitlab.com/org/repo/-/pipelines/99',
      ciProvider: 'gitlab-ci',
    });
  });

  it('detects Jenkins', () => {
    vi.stubEnv('JENKINS_URL', 'https://jenkins.example.com/');
    vi.stubEnv('BRANCH_NAME', 'feature/test');
    vi.stubEnv('GIT_COMMIT', 'aabbccdd');
    vi.stubEnv('BUILD_URL', 'https://jenkins.example.com/job/my-job/42/');

    expect(detectCi()).toEqual({
      branch: 'feature/test',
      commitSha: 'aabbccdd',
      ciUrl: 'https://jenkins.example.com/job/my-job/42/',
      ciProvider: 'jenkins',
    });
  });

  it('detects CircleCI', () => {
    vi.stubEnv('CIRCLECI', 'true');
    vi.stubEnv('CIRCLE_BRANCH', 'main');
    vi.stubEnv('CIRCLE_SHA1', 'ff00ff00');
    vi.stubEnv('CIRCLE_BUILD_URL', 'https://circleci.com/gh/org/repo/42');

    expect(detectCi()).toEqual({
      branch: 'main',
      commitSha: 'ff00ff00',
      ciUrl: 'https://circleci.com/gh/org/repo/42',
      ciProvider: 'circleci',
    });
  });

  it('detects Azure DevOps and strips refs/heads/ prefix', () => {
    vi.stubEnv('TF_BUILD', 'True');
    vi.stubEnv('BUILD_SOURCEBRANCH', 'refs/heads/main');
    vi.stubEnv('BUILD_SOURCEVERSION', '11223344');
    vi.stubEnv('SYSTEM_TEAMFOUNDATIONSERVERURI', 'https://dev.azure.com/myorg/');
    vi.stubEnv('SYSTEM_TEAMPROJECT', 'MyProject');
    vi.stubEnv('BUILD_BUILDID', '777');

    expect(detectCi()).toEqual({
      branch: 'main',
      commitSha: '11223344',
      ciUrl: 'https://dev.azure.com/myorg/MyProject/_build/results?buildId=777',
      ciProvider: 'azure-devops',
    });
  });

  it('falls back to generic CI', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('BRANCH', 'main');
    vi.stubEnv('COMMIT_SHA', 'generic123');

    expect(detectCi()).toEqual({
      branch: 'main',
      commitSha: 'generic123',
      ciProvider: 'ci',
    });
  });

  it('GitHub Actions takes priority over generic CI', () => {
    vi.stubEnv('CI', 'true');
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('GITHUB_REF_NAME', 'main');
    vi.stubEnv('GITHUB_SHA', 'sha-github');

    const result = detectCi();

    expect(result).toBeDefined();
    expect(result!.ciProvider).toBe('github-actions');
  });

  it('GitHub Actions uses GITHUB_HEAD_REF for PRs', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    vi.stubEnv('GITHUB_HEAD_REF', 'feature/pr-branch');
    vi.stubEnv('GITHUB_REF_NAME', 'main');
    vi.stubEnv('GITHUB_SHA', 'pr-sha');

    const result = detectCi();

    expect(result).toBeDefined();
    expect(result!.branch).toBe('feature/pr-branch');
  });

  it('GitLab uses MR source branch when available', () => {
    vi.stubEnv('GITLAB_CI', 'true');
    vi.stubEnv('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME', 'mr-branch');
    vi.stubEnv('CI_COMMIT_BRANCH', 'main');
    vi.stubEnv('CI_COMMIT_SHA', 'mr-sha');

    const result = detectCi();

    expect(result).toBeDefined();
    expect(result!.branch).toBe('mr-branch');
  });
});
