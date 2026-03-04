import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SortableHeader } from '@/components/ui/sortable-header';
import type { SortDirection } from '@/components/ui/sortable-header';
import { useApi } from '@/hooks/use-api';
import { runStatusOptions } from '@/lib/constants';
import { formatDuration, formatRelativeTime, truncateId } from '@/lib/formatters';
import type { PaginatedResponse, Project, RunSummary } from '@/types/api';

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const projectId = searchParams.get('projectId') || '';
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

  const { data: projectsData } = useApi<PaginatedResponse<Project>>('/v1/projects');

  const params: Record<string, string> = { page, pageSize };
  if (projectId) params.projectId = projectId;
  if (status) params.status = status;
  if (search) params.search = search;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;

  const effectiveProjectId = projectId || projectsData?.data[0]?.id || '';

  const { data: runsData, loading } = useApi<PaginatedResponse<RunSummary>>(
    effectiveProjectId ? '/v1/runs' : null,
    effectiveProjectId ? { ...params, projectId: effectiveProjectId } : undefined,
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

  const projects = projectsData?.data || [];
  const runs = runsData?.data || [];
  const meta = runsData?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Runs</h1>
        <p className="mt-1 text-muted-foreground">Browse and filter test run results.</p>
      </div>

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
          value={effectiveProjectId}
          onChange={(e) => updateParam('projectId', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="Filter by project"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => updateParam('pageSize', e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  aria-label="Page size"
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => updateParam('page', String(meta.page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => updateParam('page', String(meta.page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
