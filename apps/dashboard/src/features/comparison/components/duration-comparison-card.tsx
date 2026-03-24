import { DurationRangeChart } from '@/shared/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { ProjectComparisonItem } from '@/types/api';

interface DurationComparisonCardProps {
  projects: ProjectComparisonItem[];
  orgAvgDurationMs?: number | undefined;
}

export function DurationComparisonCard({
  projects,
  orgAvgDurationMs,
}: DurationComparisonCardProps) {
  const data = projects.map((p) => ({
    name: p.projectName,
    minDurationMs: p.minDurationMs,
    avgDurationMs: p.avgDurationMs,
    maxDurationMs: p.maxDurationMs,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duration Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <DurationRangeChart
          data={data}
          orgAvgDurationMs={orgAvgDurationMs}
          ariaLabel="Duration comparison across projects"
        />
      </CardContent>
    </Card>
  );
}
