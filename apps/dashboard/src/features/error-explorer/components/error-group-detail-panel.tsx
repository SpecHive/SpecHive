import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useErrorGroupDetail } from '../hooks/use-error-group-detail';

import { formatRelativeTime, truncateId } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

interface ErrorGroupDetailPanelProps {
  errorGroupId: string | null;
  dateFrom?: number;
  dateTo?: number;
}

const TABS = ['Affected Tests', 'Recent Executions', 'Affected Branches'] as const;
type Tab = (typeof TABS)[number];

export function ErrorGroupDetailPanel({
  errorGroupId,
  dateFrom,
  dateTo,
}: ErrorGroupDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Affected Tests');
  const { data: detail, loading, error } = useErrorGroupDetail(errorGroupId, dateFrom, dateTo);

  useEffect(() => {
    setActiveTab('Affected Tests');
  }, [errorGroupId]);

  if (!errorGroupId) return null;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-6 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (error)
    return (
      <p className="py-4 text-center text-sm text-destructive">Failed to load error details</p>
    );

  if (!detail) return null;

  const latestErrorMessage = detail.recentExecutions[0]?.errorMessage ?? null;

  return (
    <div>
      {latestErrorMessage && (
        <pre className="mb-4 max-h-48 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
          {latestErrorMessage}
        </pre>
      )}

      <div className="mb-3 flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Affected Tests' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Test Name</th>
              <th className="pb-2 pr-4">Occurrences</th>
              <th className="pb-2">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {detail.affectedTests.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted-foreground">
                  No affected tests
                </td>
              </tr>
            ) : (
              detail.affectedTests.map((t) => (
                <tr key={t.testName} className="border-b">
                  <td className="py-2 pr-4">
                    {t.lastRunId && t.lastTestId ? (
                      <Link
                        to={`/runs/${t.lastRunId}?testId=${t.lastTestId}`}
                        className="text-primary hover:underline"
                      >
                        {t.testName}
                      </Link>
                    ) : (
                      t.testName
                    )}
                  </td>
                  <td className="py-2 pr-4">{t.occurrenceCount}</td>
                  <td className="py-2">{formatRelativeTime(t.lastSeenAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {activeTab === 'Recent Executions' && (
        <div className="space-y-1">
          {detail.recentExecutions.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No recent executions</p>
          ) : (
            detail.recentExecutions.map((e) => (
              <Link
                key={e.occurrenceId}
                to={`/runs/${e.runId}`}
                className="flex items-center gap-3 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate">{e.testName}</span>
                {e.branch && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {e.branch}
                  </span>
                )}
                {e.commitSha && (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {truncateId(e.commitSha)}
                  </span>
                )}
                <span className="shrink-0 text-muted-foreground">
                  {formatRelativeTime(e.occurredAt)}
                </span>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === 'Affected Branches' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4">Branch</th>
              <th className="pb-2 pr-4">Occurrences</th>
              <th className="pb-2">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {detail.affectedBranches.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted-foreground">
                  No affected branches
                </td>
              </tr>
            ) : (
              detail.affectedBranches.map((b) => (
                <tr key={b.branch ?? 'unknown'} className="border-b">
                  <td className="py-2 pr-4 font-mono">{b.branch ?? '—'}</td>
                  <td className="py-2 pr-4">{b.occurrenceCount}</td>
                  <td className="py-2">{formatRelativeTime(b.lastSeenAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
