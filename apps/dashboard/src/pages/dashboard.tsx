import { CheckCircle, XCircle, PlayCircle, Clock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}

// TODO: Replace with real data from API once dashboard endpoints are implemented
const stats: StatCard[] = [
  {
    title: 'Total Runs',
    value: '1,284',
    description: 'All time test runs',
    icon: PlayCircle,
    trend: '+12% from last month',
  },
  {
    title: 'Pass Rate',
    value: '94.2%',
    description: 'Across all suites',
    icon: CheckCircle,
    trend: '+2.1% from last week',
  },
  {
    title: 'Failed Tests',
    value: '47',
    description: 'In the last 30 days',
    icon: XCircle,
    trend: '-8 from last month',
  },
  {
    title: 'Avg. Duration',
    value: '3m 42s',
    description: 'Per run average',
    icon: Clock,
    trend: '-14s from last week',
  },
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your test suite health and recent activity.
        </p>
      </div>

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ title, value, description, icon: Icon, trend }) => (
            <Card key={title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <CardDescription className="mt-1">{description}</CardDescription>
                {trend && <p className="mt-2 text-xs text-muted-foreground">{trend}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-runs-heading">
        <Card>
          <CardHeader>
            <CardTitle id="recent-runs-heading">Recent Runs</CardTitle>
            <CardDescription>The last 5 test suite executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${i === 2 ? 'bg-destructive' : 'bg-green-500'}`}
                      aria-label={i === 2 ? 'Failed' : 'Passed'}
                    />
                    <span className="font-medium">Suite #{1284 - i}</span>
                  </div>
                  <div className="flex items-center gap-6 text-muted-foreground">
                    <span>{i === 2 ? '87 / 100 passed' : '100 / 100 passed'}</span>
                    <span>
                      {3 + i}m {i * 12}s
                    </span>
                    <span>{i === 0 ? 'Just now' : `${i * 2}h ago`}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
