import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SortableHeader } from '@/components/ui/sortable-header';
import type { SortDirection } from '@/components/ui/sortable-header';
import { useApi } from '@/hooks/use-api';
import { runStatusOptions } from '@/lib/constants';
import { formatDuration, formatRelativeTime, truncateId } from '@/lib/formatters';
import { useProject } from '@/lib/project-context';
import type { PaginatedResponse, RunSummary } from '@/types/api';

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedProjectId } = useProject();

  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || '';
  const sortOrder = (searchParams.get('sortOrder') as SortDirection) || null;
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('pageSize') || '20';

  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (searchInput === search) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchInput) {
          next.set('search', searchInput);
        } else {
          next.delete('search');
        }
        next.delete('page');
        return next;
      });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, search, setSearchParams]);

  const params: Record<string, string> = { page, pageSize };
  if (selectedProjectId) params.projectId = selectedProjectId;
  if (status) params.status = status;
  if (search) params.search = search;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;

  const { data: runsData, loading } = useApi<PaginatedResponse<RunSummary>>(
    selectedProjectId ? '/v1/runs' : null,
    selectedProjectId ? params : undefined,
  );

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const handleSort = (column: string, direction: SortDirection) => {
    const next = new URLSearchParams(searchParams);
    if (direction) {
      next.set('sortBy', column);
      next.set('sortOrder', direction);
    } else {
      next.delete('sortBy');
      next.delete('sortOrder');
    }
    next.delete('page');
    setSearchParams(next);
  };

  const runs = runsData?.data || [];
  const meta = runsData?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title="Test Runs" description="Browse and filter test run results." />

      <div className="flex gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search runs…"
            className="rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
            aria-label="Search runs"
          />
        </div>
        <select
          value={status}
          onChange={(e) => updateParam('status', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {runStatusOptions.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !runsData ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No runs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <SortableHeader
                      label="Status"
                      column="status"
                      currentSort={sortBy || null}
                      currentDirection={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Name"
                      column="name"
                      currentSort={sortBy || null}
                      currentDirection={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Tests"
                      column="totalTests"
                      currentSort={sortBy || null}
                      currentDirection={sortOrder}
                      onSort={handleSort}
                    />
                    <th className="pb-3 pr-4">Duration</th>
                    <SortableHeader
                      label="Started"
                      column="startedAt"
                      currentSort={sortBy || null}
                      currentDirection={sortOrder}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/runs/${run.id}`)}
                      className="cursor-pointer border-b transition-colors hover:bg-accent"
                    >
                      <td className="py-3 pr-4">
                        <StatusBadge status={run.status} variant="dot" />
                      </td>
                      <td className={`py-3 pr-4 ${run.name ? '' : 'font-mono text-xs'}`}>
                        {run.name ?? truncateId(run.id)}
                      </td>
                      <td className="py-3 pr-4">
                        {run.passedTests}/{run.totalTests}
                      </td>
                      <td className="py-3 pr-4">{formatDuration(run.startedAt, run.finishedAt)}</td>
                      <td className="py-3">{formatRelativeTime(run.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && (
            <Pagination
              meta={meta}
              onPageChange={(p) => updateParam('page', String(p))}
              pageSize={Number(pageSize)}
              onPageSizeChange={(s) => updateParam('pageSize', String(s))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
