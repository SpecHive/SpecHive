import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FolderOpen,
  PlayCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { formatDurationMs } from '@/shared/lib/formatters';
import type { OrganizationAnalyticsSummary, ProjectAnalyticsSummary } from '@/types/api';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

function StatCard({ title, value, icon: Icon, tooltip }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

interface StatsCardsProps {
  summary: ProjectAnalyticsSummary | OrganizationAnalyticsSummary;
  isOrgView: boolean;
}

export function StatsCards({ summary, isOrgView }: StatsCardsProps) {
  return (
    <TooltipProvider>
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            title="Total Runs"
            value={summary.totalRuns.toLocaleString()}
            icon={PlayCircle}
            tooltip="Count of test runs completed in the selected time period."
          />
          <StatCard
            title="Pass Rate"
            value={`${summary.passRate.toFixed(1)}%`}
            icon={CheckCircle}
            tooltip="Percentage of tests that passed: (passed / total) × 100."
          />
          <StatCard
            title="Failed Tests"
            value={summary.failedTests}
            icon={XCircle}
            tooltip="Number of tests that did not pass during the selected period."
          />
          <StatCard
            title="Avg. Duration"
            value={formatDurationMs(summary.avgDurationMs)}
            icon={Clock}
            tooltip="Mean execution time across all test runs in the selected period."
          />
          <StatCard
            title="Flaky Tests"
            value={summary.flakyTests}
            icon={AlertTriangle}
            tooltip="Tests with inconsistent pass/fail results across multiple runs."
          />
          {isOrgView && 'projectCount' in summary ? (
            <StatCard
              title="Active Projects"
              value={summary.projectCount}
              icon={FolderOpen}
              tooltip="Projects with test data in the selected period."
            />
          ) : (
            <StatCard
              title="Retried Tests"
              value={summary.retriedTests}
              icon={RefreshCw}
              tooltip="Tests that required at least one retry during the selected period."
            />
          )}
        </div>
      </section>
    </TooltipProvider>
  );
}
