export interface CiInfo {
  branch?: string;
  commitSha?: string;
  ciUrl?: string;
  ciProvider?: string;
}

type RawCiInfo = { [K in keyof CiInfo]: string | undefined };

function stripUndefined(obj: RawCiInfo): CiInfo {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as CiInfo;
}

function env(name: string): string | undefined {
  return process.env[name] || undefined;
}

function detectGitHub(): RawCiInfo {
  const serverUrl = env('GITHUB_SERVER_URL');
  const repo = env('GITHUB_REPOSITORY');
  const runId = env('GITHUB_RUN_ID');

  const ciUrl =
    serverUrl && repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : undefined;

  return {
    branch: env('GITHUB_HEAD_REF') || env('GITHUB_REF_NAME'),
    commitSha: env('GITHUB_SHA'),
    ciUrl,
    ciProvider: 'github-actions',
  };
}

function detectGitLab(): RawCiInfo {
  return {
    branch: env('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME') || env('CI_COMMIT_BRANCH'),
    commitSha: env('CI_COMMIT_SHA'),
    ciUrl: env('CI_PIPELINE_URL'),
    ciProvider: 'gitlab-ci',
  };
}

function detectJenkins(): RawCiInfo {
  return {
    branch: env('CHANGE_BRANCH') || env('BRANCH_NAME'),
    commitSha: env('GIT_COMMIT'),
    ciUrl: env('BUILD_URL'),
    ciProvider: 'jenkins',
  };
}

function detectCircleCi(): RawCiInfo {
  return {
    branch: env('CIRCLE_BRANCH'),
    commitSha: env('CIRCLE_SHA1'),
    ciUrl: env('CIRCLE_BUILD_URL'),
    ciProvider: 'circleci',
  };
}

function detectAzureDevOps(): RawCiInfo {
  const raw = env('BUILD_SOURCEBRANCH');
  const branch = raw?.replace(/^refs\/heads\//, '');

  const serverUri = env('SYSTEM_TEAMFOUNDATIONSERVERURI');
  const project = env('SYSTEM_TEAMPROJECT');
  const buildId = env('BUILD_BUILDID');

  const ciUrl =
    serverUri && project && buildId
      ? `${serverUri}${project}/_build/results?buildId=${buildId}`
      : undefined;

  return {
    branch,
    commitSha: env('BUILD_SOURCEVERSION'),
    ciUrl,
    ciProvider: 'azure-devops',
  };
}

function detectGenericCi(): RawCiInfo {
  return {
    branch: env('BRANCH') || env('GIT_BRANCH'),
    commitSha: env('COMMIT_SHA') || env('GIT_COMMIT'),
    ciUrl: undefined,
    ciProvider: 'ci',
  };
}

/**
 * Detect the current CI environment from well-known env vars.
 *
 * Returns `undefined` when the process is not running inside any
 * recognised CI provider.
 */
export function detectCi(): CiInfo | undefined {
  if (env('GITHUB_ACTIONS')) return stripUndefined(detectGitHub());
  if (env('GITLAB_CI')) return stripUndefined(detectGitLab());
  if (env('JENKINS_URL')) return stripUndefined(detectJenkins());
  if (env('CIRCLECI')) return stripUndefined(detectCircleCi());
  if (env('TF_BUILD')) return stripUndefined(detectAzureDevOps());
  if (env('CI')) return stripUndefined(detectGenericCi());

  return undefined;
}
