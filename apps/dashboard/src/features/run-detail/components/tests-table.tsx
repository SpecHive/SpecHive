import { StatusBadge } from '@/shared/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Pagination } from '@/shared/components/ui/pagination';
import { SortableHeader } from '@/shared/components/ui/sortable-header';
import type { SortDirection } from '@/shared/components/ui/sortable-header';
import { testStatusOptions } from '@/shared/lib/constants';
import type { PaginatedResponse, PaginationMeta, TestSummary } from '@/types/api';

interface TestsTableProps {
  tests: TestSummary[];
  testsLoading: boolean;
  testsData: PaginatedResponse<TestSummary> | null;
  testsMeta: PaginationMeta | null;
  testStatus: string;
  onTestStatusChange: (status: string) => void;
  testSortBy: string | null;
  testSortOrder: SortDirection;
  onTestSort: (column: string, direction: SortDirection) => void;
  onTestPageChange: (page: number) => void;
  onTestSelect: (testId: string) => void;
}

export function TestsTable({
  tests,
  testsLoading,
  testsData,
  testsMeta,
  testStatus,
  onTestStatusChange,
  testSortBy,
  testSortOrder,
  onTestSort,
  onTestPageChange,
  onTestSelect,
}: TestsTableProps) {
  return (
    <Card className="min-w-0 flex-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tests</CardTitle>
        <select
          value={testStatus}
          onChange={(e) => onTestStatusChange(e.target.value)}
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
                    onSort={onTestSort}
                  />
                  <SortableHeader
                    label="Status"
                    column="status"
                    currentSort={testSortBy}
                    currentDirection={testSortOrder}
                    onSort={onTestSort}
                  />
                  <SortableHeader
                    label="Duration"
                    column="durationMs"
                    currentSort={testSortBy}
                    currentDirection={testSortOrder}
                    onSort={onTestSort}
                  />
                  <th className="pb-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr
                    key={test.id}
                    onClick={() => onTestSelect(test.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onTestSelect(test.id);
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

        {testsMeta && <Pagination meta={testsMeta} onPageChange={onTestPageChange} />}
      </CardContent>
    </Card>
  );
}
