import { Link } from 'react-router';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useApi } from '@/shared/hooks/use-api';
import type { RunErrorsSummary } from '@/types/api';

interface RunErrorsSummaryProps {
  runId: string;
  projectId: string;
}

export function RunErrorsSummary({ runId, projectId: _projectId }: RunErrorsSummaryProps) {
  const { data, loading } = useApi<RunErrorsSummary>(`/v1/runs/${runId}/errors/summary`);

  if (!loading && (!data || data.totalFailedTests === 0 || data.topErrors.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Top Errors</CardTitle>
          {!loading && data && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {data.totalErrorGroups} unique errors
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data!.topErrors.slice(0, 5).map((error) => (
              <Link
                key={error.errorGroupId}
                to={`/errors?errorGroupId=${error.errorGroupId}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium">{error.title}</p>
                  {error.errorName && (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {error.errorName}
                    </span>
                  )}
                </div>
                <span className="ml-4 shrink-0 text-muted-foreground">
                  {error.occurrences} occurrence{error.occurrences !== 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
      {!loading && data && (
        <CardFooter>
          <Link to="/errors" className="text-sm text-primary hover:underline">
            View all errors &rarr;
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
