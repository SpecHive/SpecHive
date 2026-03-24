export enum RunStatus {
  Pending = 'pending',
  Running = 'running',
  Passed = 'passed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum TestStatus {
  Pending = 'pending',
  Running = 'running',
  Passed = 'passed',
  Failed = 'failed',
  Skipped = 'skipped',
  Flaky = 'flaky',
}

export enum ArtifactType {
  Screenshot = 'screenshot',
  Video = 'video',
  Trace = 'trace',
  Log = 'log',
  Other = 'other',
}

export enum MembershipRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Viewer = 'viewer',
}

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}
