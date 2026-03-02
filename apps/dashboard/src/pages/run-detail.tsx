import { ChevronRight, Download, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { SuiteTree } from '@/components/suite-tree';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { statusColorsBadge, testStatusOptions } from '@/lib/constants';
import { formatDateTime, formatDuration, truncateId } from '@/lib/formatters';
import type {
  ArtifactDownloadResponse,
  PaginatedResponse,
  RunDetail,
  SuiteSummary,
  TestDetail,
  TestSummary,
} from '@/types/api';

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${
        statusColorsBadge[status] || 'bg-gray-400 text-white'
      } ${large ? 'text-sm' : 'text-xs'}`}
    >
      {status}
    </span>
  );
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [testPage, setTestPage] = useState(1);
  const [testStatus, setTestStatus] = useState('');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [stackTraceOpen, setStackTraceOpen] = useState(false);

  const { data: run, loading: runLoading, error: runError } = useApi<RunDetail>(`/v1/runs/${id}`);

  const { data: suites } = useApi<SuiteSummary[]>(id ? `/v1/runs/${id}/suites` : null);

  const testParams: Record<string, string> = { page: String(testPage), pageSize: '20' };
  if (testStatus) testParams.status = testStatus;
  if (selectedSuiteId) testParams.suiteId = selectedSuiteId;

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

  const handleDownload = useCallback(async (artifactId: string) => {
    try {
      const response = await apiClient.get<ArtifactDownloadResponse>(
        `/v1/artifacts/${artifactId}/download`,
      );
      window.open(response.url, '_blank');
    } catch {
      // Error handled by apiClient
    }
  }, []);

  const tests = testsData?.data || [];
  const testsMeta = testsData?.meta;

  const testCountBySuiteId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const test of tests) {
      counts[test.suiteId] = (counts[test.suiteId] ?? 0) + 1;
    }
    return counts;
  }, [tests]);

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
        <span className="font-mono">{truncateId(run.id)}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Run {truncateId(run.id)}</h1>
            <StatusBadge status={run.status} large />
          </div>
          <div className="mt-2 flex gap-6 text-sm text-muted-foreground">
            <span>
              {run.passedTests}/{run.totalTests} passed
            </span>
            <span>{run.failedTests} failed</span>
            <span>{run.skippedTests} skipped</span>
            <span>{run.suiteCount} suites</span>
          </div>
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
                  testCountBySuiteId={testCountBySuiteId}
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
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Duration</th>
                      <th className="pb-3">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((test) => (
                      <tr
                        key={test.id}
                        onClick={() => setSelectedTestId(test.id)}
                        className="cursor-pointer border-b transition-colors hover:bg-accent"
                      >
                        <td className="max-w-xs truncate py-3 pr-4 font-medium">{test.name}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={test.status} />
                        </td>
                        <td className="py-3 pr-4">{test.durationMs}ms</td>
                        <td className="max-w-xs truncate py-3 text-muted-foreground">
                          {test.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {testsMeta && testsMeta.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {testsMeta.page} of {testsMeta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testsMeta.page <= 1}
                    onClick={() => setTestPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testsMeta.page >= testsMeta.totalPages}
                    onClick={() => setTestPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test detail drawer */}
      {selectedTestId && testDetail && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelectedTestId(null)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l bg-background shadow-xl">
            <div className="flex h-full flex-col overflow-y-auto">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold">Test Details</h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTestId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6 p-4">
                <div>
                  <h3 className="font-medium">{testDetail.name}</h3>
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <StatusBadge status={testDetail.status} />
                    <span>{testDetail.durationMs}ms</span>
                    {testDetail.retryCount > 0 && (
                      <span className="text-muted-foreground">{testDetail.retryCount} retries</span>
                    )}
                  </div>
                </div>

                {testDetail.errorMessage && (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="mt-1 text-sm">{testDetail.errorMessage}</p>
                  </div>
                )}

                {testDetail.stackTrace && (
                  <div>
                    <button
                      onClick={() => setStackTraceOpen(!stackTraceOpen)}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      {stackTraceOpen ? 'Hide' : 'Show'} stack trace
                    </button>
                    {stackTraceOpen && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                        {testDetail.stackTrace}
                      </pre>
                    )}
                  </div>
                )}

                {testDetail.artifacts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium">Artifacts</h4>
                    <div className="mt-2 space-y-2">
                      {testDetail.artifacts.map((artifact) => (
                        <div
                          key={artifact.id}
                          className="flex items-center justify-between rounded-md border p-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">{artifact.name}</span>
                            <span className="ml-2 text-muted-foreground">
                              ({(artifact.sizeBytes / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(artifact.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
