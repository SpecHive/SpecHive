import { Link } from 'react-router';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { statusColorsDot } from '@/shared/lib/constants';
import { formatDuration, formatRelativeTime, truncateId } from '@/shared/lib/formatters';
import type { RunSummary } from '@/types/api';

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={`h-2 w-2 rounded-full ${statusColorsDot[status] || 'bg-gray-400'}`}
      aria-label={status}
    />
  );
}

interface RecentRunsCardProps {
  runs: RunSummary[];
}

export function RecentRunsCard({ runs }: RecentRunsCardProps) {
  return (
    <section aria-labelledby="recent-runs-heading">
      <Card>
        <CardHeader>
          <CardTitle id="recent-runs-heading">Recent Runs</CardTitle>
          <CardDescription>
            {runs.length > 0 ? `Last ${runs.length} test runs` : 'No runs yet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No test runs found. Push some test results to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={run.status} />
                    <span className={`font-medium ${run.name ? '' : 'font-mono text-xs'}`}>
                      {run.name ?? truncateId(run.id)}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-muted-foreground">
                    <span>
                      {run.passedTests} / {run.totalTests} passed
                    </span>
                    <span>{formatDuration(run.startedAt, run.finishedAt)}</span>
                    <span>{formatRelativeTime(run.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
