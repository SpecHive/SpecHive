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
const OTHER_COLOR = '#94a3b8';

interface ErrorTimelineChartProps {
  data: ErrorTimelineResponse | null;
  loading: boolean;
  metric: string;
}

export function ErrorTimelineChart({ data, loading, metric }: ErrorTimelineChartProps) {
  if (loading) {
    return <div className="h-[300px] animate-pulse rounded bg-muted" />;
  }

  if (!data || (data.series.length === 0 && data.otherSeries.length === 0)) {
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
      entry[s.errorGroupId] = dp[metric as keyof typeof dp] as number;
      dateMap.set(dp.date, entry);
    }
  }
  for (const dp of data.otherSeries) {
    const entry = dateMap.get(dp.date) ?? {};
    entry['Other'] = dp[metric as keyof typeof dp] as number;
    dateMap.set(dp.date, entry);
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  const seriesKeys = [
    ...data.series.map((s) => s.errorGroupId),
    ...(data.otherSeries.length > 0 ? ['Other'] : []),
  ];

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
            stroke={i < data.series.length ? SERIES_COLORS[i % SERIES_COLORS.length] : OTHER_COLOR}
            fill={i < data.series.length ? SERIES_COLORS[i % SERIES_COLORS.length] : OTHER_COLOR}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
