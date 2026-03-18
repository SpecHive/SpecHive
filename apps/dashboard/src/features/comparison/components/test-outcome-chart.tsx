import { StackedBarChart } from '@/shared/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { ProjectComparisonItem } from '@/types/api';

interface TestOutcomeChartProps {
  projects: ProjectComparisonItem[];
  orgAveragePassRate?: number | undefined;
}

export function TestOutcomeChart({ projects, orgAveragePassRate }: TestOutcomeChartProps) {
  const data = projects.map((p) => ({
    name: p.projectName,
    passed: p.passedTests,
    failed: p.failedTests,
    skipped: p.skippedTests,
    flaky: p.flakyTests,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Outcome Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <StackedBarChart
          data={data}
          orgAveragePassRate={orgAveragePassRate}
          ariaLabel="Test outcome distribution by project"
        />
      </CardContent>
    </Card>
  );
}
