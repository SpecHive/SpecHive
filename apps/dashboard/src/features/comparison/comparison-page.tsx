import { ComparisonTable } from './components/comparison-table';
import { DurationComparisonCard } from './components/duration-comparison-card';
import { TestOutcomeChart } from './components/test-outcome-chart';
import { useComparisonData } from './hooks/use-comparison-data';

import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/layout/page-header';
import { PeriodSelector } from '@/shared/components/period-selector';
import { Card, CardContent } from '@/shared/components/ui/card';
import { usePeriodSelector } from '@/shared/hooks/use-period-selector';

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function ProjectComparisonPage() {
  const { selectedProjectIds, isAllSelected } = useProject();
  const { days, setDays, options } = usePeriodSelector({
    options: [7, 14, 30, 60, 90],
    defaultDays: 30,
    syncWithUrl: true,
  });

  const { data, loading } = useComparisonData(selectedProjectIds, isAllSelected, days);

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  const projects = data?.projects ?? [];
  const orgAverage = data?.orgAverage;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Project Comparison"
        description="Compare test health across all projects in your organization."
      />

      <PeriodSelector options={options} value={days} onChange={setDays} />

      {!projects.length ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No test data found. Run tests across multiple projects to see comparisons.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <TestOutcomeChart projects={projects} orgAveragePassRate={orgAverage?.passRate} />
            <DurationComparisonCard
              projects={projects}
              orgAvgDurationMs={orgAverage?.avgDurationMs}
            />
          </div>

          {orgAverage && <ComparisonTable projects={projects} orgAverage={orgAverage} />}
        </>
      )}
    </div>
  );
}
