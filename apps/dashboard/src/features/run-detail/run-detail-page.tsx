import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { RunErrorsSummary } from '@/features/run-detail/components/run-errors-summary';
import { RunHeader } from '@/features/run-detail/components/run-header';
import { TestsTable } from '@/features/run-detail/components/tests-table';
import { SuiteTree } from '@/shared/components/suite-tree';
import { TestDetailDrawer } from '@/shared/components/test-detail-drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { SortDirection } from '@/shared/components/ui/sortable-header';
import { useApi } from '@/shared/hooks/use-api';
import { useUpdateParam } from '@/shared/hooks/use-update-param';
import type {
  PaginatedResponse,
  RunDetail,
  SuiteSummary,
  TestDetail,
  TestSummary,
} from '@/types/api';

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const updateParam = useUpdateParam();
  const selectedTestId = searchParams.get('testId') || null;

  const [testPage, setTestPage] = useState(1);
  const [testStatus, setTestStatus] = useState('');
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
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

  const handleTestStatusChange = useCallback((status: string) => {
    setTestStatus(status);
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
      <RunHeader run={run} />
      <RunErrorsSummary runId={id!} branch={run.branch} projectId={run.projectId} />

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
        <TestsTable
          tests={tests}
          testsLoading={testsLoading}
          testsData={testsData ?? null}
          testsMeta={testsMeta ?? null}
          testStatus={testStatus}
          onTestStatusChange={handleTestStatusChange}
          testSortBy={testSortBy}
          testSortOrder={testSortOrder}
          onTestSort={handleTestSort}
          onTestPageChange={setTestPage}
          selectedTestId={selectedTestId}
          onTestSelect={(testId) => updateParam('testId', testId)}
        />
      </div>

      {selectedTestId && testDetail && (
        <TestDetailDrawer
          testDetail={testDetail}
          onClose={() => updateParam('testId', '')}
          projectId={run.projectId}
        />
      )}
    </div>
  );
}
