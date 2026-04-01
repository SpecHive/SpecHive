import { ChevronDown } from 'lucide-react';
import { Fragment } from 'react';

import { CategoryBadge } from '@/shared/components/category-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Pagination } from '@/shared/components/ui/pagination';
import { SortableHeader } from '@/shared/components/ui/sortable-header';
import { formatRelativeTime } from '@/shared/lib/formatters';
import type { ErrorGroupSummary, PaginatedResponse } from '@/types/api';

interface ErrorGroupsTableProps {
  data: PaginatedResponse<ErrorGroupSummary> | null;
  loading: boolean;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  sortBy: string | null;
  sortDirection: 'asc' | 'desc' | null;
  onSort: (column: string, direction: 'asc' | 'desc' | null) => void;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  renderDetail?: (groupId: string) => React.ReactNode;
}

const COLUMN_COUNT = 5;

export function ErrorGroupsTable({
  data,
  loading,
  expandedId,
  onExpand,
  sortBy,
  sortDirection,
  onSort,
  pageSize,
  onPageChange,
  onPageSizeChange,
  renderDetail,
}: ErrorGroupsTableProps) {
  const groups = data?.data || [];
  const meta = data?.meta;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Groups</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No errors found in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <SortableHeader
                    label="Error"
                    column="title"
                    currentSort={sortBy}
                    currentDirection={sortDirection}
                    onSort={onSort}
                    className="min-w-[300px]"
                  />
                  <SortableHeader
                    label="Occurrences"
                    column="occurrences"
                    currentSort={sortBy}
                    currentDirection={sortDirection}
                    onSort={onSort}
                  />
                  <SortableHeader
                    label="Affected Tests"
                    column="uniqueTests"
                    currentSort={sortBy}
                    currentDirection={sortDirection}
                    onSort={onSort}
                  />
                  <SortableHeader
                    label="Affected Branches"
                    column="uniqueBranches"
                    currentSort={sortBy}
                    currentDirection={sortDirection}
                    onSort={onSort}
                  />
                  <SortableHeader
                    label="Last Seen"
                    column="lastSeenAt"
                    currentSort={sortBy}
                    currentDirection={sortDirection}
                    onSort={onSort}
                  />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const isExpanded = expandedId === group.id;
                  return (
                    <Fragment key={group.id}>
                      <tr
                        onClick={() => onExpand(isExpanded ? null : group.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onExpand(isExpanded ? null : group.id);
                          }
                        }}
                        tabIndex={0}
                        role="row"
                        aria-expanded={isExpanded}
                        className="cursor-pointer border-b transition-colors hover:bg-accent"
                      >
                        <td className="max-w-[400px] py-3 pr-4">
                          <div className="flex items-start gap-2">
                            <ChevronDown
                              className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                            <div className="min-w-0">
                              <p className="line-clamp-2 break-all">{group.title}</p>
                              <CategoryBadge category={group.errorCategory} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">{group.occurrences}</td>
                        <td className="py-3 pr-4">{group.uniqueTests}</td>
                        <td className="py-3 pr-4">{group.uniqueBranches}</td>
                        <td className="py-3">{formatRelativeTime(group.lastSeenAt)}</td>
                      </tr>
                      {isExpanded && renderDetail && (
                        <tr key={`${group.id}-detail`}>
                          <td colSpan={COLUMN_COUNT} className="bg-muted/30 px-4 py-4">
                            {renderDetail(group.id)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <Pagination
            meta={meta}
            onPageChange={onPageChange}
            pageSize={pageSize}
            onPageSizeChange={onPageSizeChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
