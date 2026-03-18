import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { StatusBadge } from '@/shared/components/status-badge';
import { formatDateTime, formatDuration, truncateId } from '@/shared/lib/formatters';
import type { RunDetail } from '@/types/api';

interface RunHeaderProps {
  run: RunDetail;
}

export function RunHeader({ run }: RunHeaderProps) {
  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/runs" className="hover:text-foreground">
          Runs
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className={run.name ? '' : 'font-mono'}>{run.name ?? truncateId(run.id)}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{run.name ?? `Run ${truncateId(run.id)}`}</h1>
            <StatusBadge status={run.status} large />
          </div>
          {run.name && (
            <span className="font-mono text-sm text-muted-foreground">{truncateId(run.id)}</span>
          )}
          <div className="mt-2 flex gap-6 text-sm text-muted-foreground">
            <span>
              {run.passedTests}/{run.totalTests} passed
            </span>
            <span>{run.failedTests} failed</span>
            <span>{run.skippedTests} skipped</span>
            <span>{run.suiteCount} suites</span>
          </div>
          {(run.branch || run.commitSha || run.ciUrl) && (
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              {run.branch && (
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                  {run.branch}
                </span>
              )}
              {run.commitSha && (
                <span className="font-mono text-xs">{run.commitSha.slice(0, 7)}</span>
              )}
              {run.ciUrl && /^https?:\/\//.test(run.ciUrl) && (
                <a
                  href={run.ciUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CI Build ↗
                </a>
              )}
            </div>
          )}
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>Duration: {formatDuration(run.startedAt, run.finishedAt)}</div>
          <div>Started: {formatDateTime(run.startedAt)}</div>
          {run.finishedAt && <div>Finished: {formatDateTime(run.finishedAt)}</div>}
        </div>
      </div>
    </>
  );
}
