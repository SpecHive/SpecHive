import {
  AlertTriangle,
  CheckCircle,
  Clock,
  EyeOff,
  PlayCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { TrendIndicator } from '@/shared/components/trend-indicator';
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
  delta?: number | null | undefined;
  positiveIsGood?: boolean | undefined;
}

function StatCard({ title, value, icon: Icon, tooltip, delta, positiveIsGood }: StatCardProps) {
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
        {delta != null && (
          <TrendIndicator delta={delta} positiveIsGood={positiveIsGood} className="mt-1" />
        )}
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
            delta={'passRateDelta' in summary ? summary.passRateDelta : undefined}
            positiveIsGood={true}
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
            title="Flaky Rate"
            value={`${(summary.totalTests > 0 ? (summary.flakyTests / summary.totalTests) * 100 : 0).toFixed(1)}%`}
            icon={AlertTriangle}
            tooltip="Percentage of tests with inconsistent pass/fail results — lower is better."
            delta={
              'flakyRateDelta' in summary
                ? (summary as OrganizationAnalyticsSummary).flakyRateDelta
                : undefined
            }
            positiveIsGood={false}
          />
          {isOrgView && 'projectCount' in summary ? (
            <StatCard
              title="Skip Rate"
              value={`${summary.totalTests > 0 ? ((summary.skippedTests / summary.totalTests) * 100).toFixed(1) : '0.0'}%`}
              icon={EyeOff}
              tooltip="Percentage of tests skipped — high skip rates may hide failures."
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
