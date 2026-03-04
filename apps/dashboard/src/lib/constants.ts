export const statusColorsDot: Record<string, string> = {
  passed: 'bg-green-500',
  failed: 'bg-destructive',
  running: 'bg-blue-500',
  pending: 'bg-gray-400',
  cancelled: 'bg-yellow-500',
  flaky: 'bg-orange-500',
  skipped: 'bg-gray-300',
};

export const statusColorsBadge: Record<string, string> = {
  passed: 'bg-green-500 text-white',
  failed: 'bg-destructive text-destructive-foreground',
  running: 'bg-blue-500 text-white',
  pending: 'bg-gray-400 text-white',
  cancelled: 'bg-yellow-500 text-white',
  skipped: 'bg-gray-300 text-gray-700',
  flaky: 'bg-orange-500 text-white',
};

export const runStatusOptions = ['', 'passed', 'failed', 'running', 'pending', 'cancelled'];
export const testStatusOptions = ['', 'passed', 'failed', 'skipped', 'pending', 'flaky', 'running'];
