import { RunStatus, TestStatus } from '@spechive/shared-types';

export const statusColorsDot: Record<string, string> = {
  [RunStatus.Passed]: 'bg-green-500',
  [RunStatus.Failed]: 'bg-destructive',
  [RunStatus.Running]: 'bg-blue-500',
  [RunStatus.Pending]: 'bg-gray-400',
  [RunStatus.Cancelled]: 'bg-yellow-500',
  [TestStatus.Flaky]: 'bg-orange-500',
  [TestStatus.Skipped]: 'bg-gray-300',
};

export const statusColorsBadge: Record<string, string> = {
  [RunStatus.Passed]: 'bg-green-500 text-white',
  [RunStatus.Failed]: 'bg-destructive text-destructive-foreground',
  [RunStatus.Running]: 'bg-blue-500 text-white',
  [RunStatus.Pending]: 'bg-gray-400 text-white',
  [RunStatus.Cancelled]: 'bg-yellow-500 text-white',
  [TestStatus.Skipped]: 'bg-gray-300 text-gray-700',
  [TestStatus.Flaky]: 'bg-orange-500 text-white',
};

export const runStatusOptions = ['', ...Object.values(RunStatus)];
export const testStatusOptions = ['', ...Object.values(TestStatus)];
