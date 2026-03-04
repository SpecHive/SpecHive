export function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return '< 1s';
  return formatDurationMs(ms);
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '—';

  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
  return dateTimeFormatter.format(new Date(dateString));
}

export function truncateId(id: string): string {
  return id.slice(0, 8);
}

export function formatDurationMs(ms: number): string {
  if (ms < 0) return '—';
  if (ms === 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return seconds > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function formatDateLabel(dateStr: string): string {
  const safeDate = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
  return dateLabelFormatter.format(new Date(safeDate));
}
