import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS } from '@/shared/lib/chart-colors';
import { formatDateLabel } from '@/shared/lib/formatters';
import type { ErrorTimelineResponse } from '@/types/api';

const SERIES_COLORS = [
  CHART_COLORS.fail,
  CHART_COLORS.warning,
  CHART_COLORS.primary,
  CHART_COLORS.purple,
  CHART_COLORS.pass,
];
export type ErrorMetric = 'occurrences' | 'uniqueTests' | 'uniqueBranches';

interface ErrorTimelineChartProps {
  data: ErrorTimelineResponse | null;
  loading: boolean;
  metric: ErrorMetric;
}

export function ErrorTimelineChart({ data, loading, metric }: ErrorTimelineChartProps) {
  if (loading) {
    return <div className="h-[300px] animate-pulse rounded bg-muted" />;
  }

  if (!data || data.series.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <p className="text-muted-foreground">No errors in this period</p>
      </div>
    );
  }

  // Merge all dates into a unified dataset, keyed by errorGroupId to avoid title collisions
  const dateMap = new Map<string, Record<string, number>>();
  for (const s of data.series) {
    for (const dp of s.dataPoints) {
      const entry = dateMap.get(dp.date) ?? {};
      entry[s.errorGroupId] = dp[metric];
      dateMap.set(dp.date, entry);
    }
  }

  // Fill date gaps so recharts doesn't interpolate over missing days
  if (dateMap.size > 0) {
    const dates = Array.from(dateMap.keys()).sort();
    const start = new Date(dates[0]);
    const end = new Date(dates[dates.length - 1]);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!dateMap.has(key)) {
        dateMap.set(key, {});
      }
    }
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  const seriesKeys = data.series.map((s) => s.errorGroupId);

  // Map errorGroupId → title for human-readable tooltip labels
  const labelMap = new Map(data.series.map((s) => [s.errorGroupId, s.title]));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsAreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          className="text-xs"
          tick={{ fill: 'currentColor' }}
        />
        <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
        <Tooltip
          labelFormatter={(label) => formatDateLabel(String(label))}
          formatter={(value, name) => [value, labelMap.get(String(name)) ?? name]}
          contentStyle={{ fontSize: '0.875rem' }}
        />
        {seriesKeys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stackId="1"
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
