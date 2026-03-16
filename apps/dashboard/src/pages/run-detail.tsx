import { ChevronRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';

import { StatusBadge } from '@/components/status-badge';
import { SuiteTree } from '@/components/suite-tree';
import { TestDetailDrawer } from '@/components/test-detail-drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SortableHeader } from '@/components/ui/sortable-header';
import type { SortDirection } from '@/components/ui/sortable-header';
import { useApi } from '@/hooks/use-api';
import { testStatusOptions } from '@/lib/constants';
import { formatDateTime, formatDuration, truncateId } from '@/lib/formatters';
import type {
  PaginatedResponse,
  RunDetail,
  SuiteSummary,
  TestDetail,
  TestSummary,
} from '@/types/api';

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [testPage, setTestPage] = useState(1);
  const [testStatus, setTestStatus] = useState('');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [testSortBy, setTestSortBy] = useState<string | null>(null);
  const [testSortOrder, setTestSortOrder] = useState<SortDirection>(null);

  const { data: run, loading: runLoading, error: runError } = useApi<RunDetail>(`/v1/runs/${id}`);

  const { data: suites } = useApi<SuiteSummary[]>(id ? `/v1/runs/${id}/suites` : null);

  const testParams: Record<string, string> = { page: String(testPage), pageSize: '20' };
  if (testStatus) testParams.status = testStatus;
  if (selectedSuiteId) testParams.suiteId = selectedSuiteId;
  if (testSortBy && testSortOrder) {
    testParams.sortBy = testSortBy;
    testParams.sortOrder = testSortOrder;
  }

  const { data: testsData, loading: testsLoading } = useApi<PaginatedResponse<TestSummary>>(
    id ? `/v1/runs/${id}/tests` : null,
    testParams,
  );

  const { data: testDetail } = useApi<TestDetail>(
    selectedTestId && id ? `/v1/runs/${id}/tests/${selectedTestId}` : null,
  );

  const handleSuiteSelect = useCallback((suiteId: string | null) => {
    setSelectedSuiteId(suiteId);
    setTestPage(1);
  }, []);

  const handleTestSort = useCallback((column: string, direction: SortDirection) => {
    setTestSortBy(direction ? column : null);
    setTestSortOrder(direction);
    setTestPage(1);
  }, []);

  const tests = testsData?.data || [];
  const testsMeta = testsData?.meta;

  if (runLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-lg border bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Run not found</h1>
        <p className="mt-2 text-muted-foreground">
          The run you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link to="/runs" className="mt-4 inline-block text-sm text-primary underline">
          Back to runs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Tests table */}
      <div className="flex gap-6">
        {suites && suites.length > 0 && (
          <div className="w-64 shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suites</CardTitle>
              </CardHeader>
              <CardContent>
                <SuiteTree
                  suites={suites}
                  selectedSuiteId={selectedSuiteId}
                  onSuiteSelect={handleSuiteSelect}
                />
              </CardContent>
            </Card>
          </div>
        )}
        <Card className="min-w-0 flex-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tests</CardTitle>
            <select
              value={testStatus}
              onChange={(e) => {
                setTestStatus(e.target.value);
                setTestPage(1);
              }}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Filter tests by status"
            >
              <option value="">All statuses</option>
              {testStatusOptions.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent>
            {testsLoading && !testsData ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : tests.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No tests found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <SortableHeader
                        label="Name"
                        column="name"
                        currentSort={testSortBy}
                        currentDirection={testSortOrder}
                        onSort={handleTestSort}
                      />
                      <SortableHeader
                        label="Status"
                        column="status"
                        currentSort={testSortBy}
                        currentDirection={testSortOrder}
                        onSort={handleTestSort}
                      />
                      <SortableHeader
                        label="Duration"
                        column="durationMs"
                        currentSort={testSortBy}
                        currentDirection={testSortOrder}
                        onSort={handleTestSort}
                      />
                      <th className="pb-3">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((test) => (
                      <tr
                        key={test.id}
                        onClick={() => setSelectedTestId(test.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTestId(test.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        className="cursor-pointer border-b transition-colors hover:bg-accent"
                      >
                        <td className="max-w-xs truncate py-3 pr-4 font-medium">{test.name}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={test.status} />
                        </td>
                        <td className="py-3 pr-4">
                          {test.durationMs != null ? `${test.durationMs}ms` : '—'}
                        </td>
                        <td className="max-w-xs truncate py-3 text-muted-foreground">
                          {test.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {testsMeta && <Pagination meta={testsMeta} onPageChange={setTestPage} />}
          </CardContent>
        </Card>
      </div>

      {/* Test detail drawer */}
      {selectedTestId && testDetail && (
        <TestDetailDrawer testDetail={testDetail} onClose={() => setSelectedTestId(null)} />
      )}
    </div>
  );
}
