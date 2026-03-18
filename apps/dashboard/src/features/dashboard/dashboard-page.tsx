import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';

import { useProject } from '@/contexts/project-context';
import { FlakyTestsCard } from '@/features/dashboard/components/flaky-tests-card';
import { RecentRunsCard } from '@/features/dashboard/components/recent-runs-card';
import { StatsCards } from '@/features/dashboard/components/stats-cards';
import { useDashboardAnalytics } from '@/features/dashboard/hooks/use-dashboard-analytics';
import { PageHeader } from '@/layout/page-header';
import { LineChart, type LineChartLine } from '@/shared/components/charts';
import { CreateProjectDialog } from '@/shared/components/create-project-dialog';
import { OnboardingCard } from '@/shared/components/onboarding-card';
import { PeriodSelector } from '@/shared/components/period-selector';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { usePeriodSelector } from '@/shared/hooks/use-period-selector';
import { CHART_COLORS } from '@/shared/lib/chart-colors';
import { formatDateLabel, formatDurationMs } from '@/shared/lib/formatters';
import type { PassRateTrendPoint } from '@/types/api';

const PASS_RATE_LINES: LineChartLine[] = [
  { key: 'passRate', label: 'Pass Rate', color: CHART_COLORS.pass },
];

const DURATION_LINES: LineChartLine[] = [
  { key: 'avgDurationMs', label: 'Avg', color: CHART_COLORS.primary },
  { key: 'minDurationMs', label: 'Min', color: CHART_COLORS.pass, dashed: true },
  { key: 'maxDurationMs', label: 'Max', color: CHART_COLORS.fail, dashed: true },
];

function PassRateTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as PassRateTrendPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-md">
      <p className="font-medium">{formatDateLabel(String(label))}</p>
      <p className="text-green-500">Pass Rate: {point.passRate.toFixed(1)}%</p>
      <p className="text-muted-foreground">Total: {point.totalTests}</p>
      <p className="text-muted-foreground">Passed: {point.passedTests}</p>
      <p className="text-muted-foreground">Failed: {point.failedTests}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}

export function DashboardPage() {
  const {
    projects,
    selectedProjectIds,
    isAllSelected,
    loading: projectsLoading,
    refetchProjects,
    setSelectedProjectIds,
  } = useProject();

  const isOrgView = isAllSelected;
  const effectiveProjectId = selectedProjectIds.length === 1 ? selectedProjectIds[0] : null;

  const { days, setDays, options } = usePeriodSelector({
    options: [7, 14, 30],
  });
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [onboardingActive, setOnboardingActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!projectsLoading) {
      setOnboardingActive((prev) => {
        if (prev === null) return projects.length === 0;
        if (!prev && projects.length === 0) return true;
        return prev;
      });
    }
  }, [projectsLoading, projects.length]);

  const {
    summary,
    passRateTrend,
    durationTrend,
    flakyTests,
    recentRuns,
    loading,
    summaryLoading,
    trendLoading,
    durationLoading,
    flakyLoading,
    summaryError,
  } = useDashboardAnalytics(selectedProjectIds, isAllSelected, days, projectsLoading);

  if (loading && recentRuns.length === 0) {
    return <LoadingSkeleton />;
  }

  if (onboardingActive) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Welcome! Let's get you set up."
          description="Follow the steps below to start reporting test results."
        />
        <OnboardingCard
          onCreateProject={() => setCreateProjectOpen(true)}
          projectCreated={projects.length > 0}
          selectedProjectId={effectiveProjectId}
          onComplete={() => setOnboardingActive(false)}
        />
        <CreateProjectDialog
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
          onCreated={(project) => {
            refetchProjects();
            setSelectedProjectIds([project.id]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your test suite health and recent activity."
        actions={
          <Button size="sm" onClick={() => setCreateProjectOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Project
          </Button>
        }
      />

      {summaryError && <p className="text-sm text-destructive">Failed to load analytics data</p>}

      {summaryLoading && !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      ) : (
        summary && <StatsCards summary={summary} isOrgView={isOrgView} />
      )}

      <PeriodSelector options={options} value={days} onChange={setDays} />

      {/* Pass Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Pass Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <div className="h-[300px] animate-pulse rounded bg-muted" />
          ) : passRateTrend && passRateTrend.length > 0 ? (
            <LineChart
              data={passRateTrend}
              xKey="date"
              lines={PASS_RATE_LINES}
              xFormatter={formatDateLabel}
              yDomain={[0, 100]}
              yFormatter={(v) => `${v}%`}
              tooltipContent={PassRateTooltip}
              ariaLabel="Pass rate trend over time"
            />
          ) : (
            <p className="py-12 text-center text-muted-foreground">No data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* Duration Trend + Flaky Tests */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Duration Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {durationLoading ? (
              <div className="h-[300px] animate-pulse rounded bg-muted" />
            ) : durationTrend && durationTrend.length > 0 ? (
              <LineChart
                data={durationTrend}
                xKey="date"
                lines={DURATION_LINES}
                xFormatter={formatDateLabel}
                yFormatter={formatDurationMs}
                ariaLabel="Test duration trend over time"
              />
            ) : (
              <p className="py-12 text-center text-muted-foreground">No data for this period</p>
            )}
          </CardContent>
        </Card>

        <FlakyTestsCard flakyTests={flakyTests} isOrgView={isOrgView} loading={flakyLoading} />
      </div>

      <RecentRunsCard runs={recentRuns} />

      <CreateProjectDialog
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onCreated={(project) => {
          refetchProjects();
          setSelectedProjectIds([project.id]);
        }}
      />
    </div>
  );
}
