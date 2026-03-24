import {
  Bar,
  BarChart as RechartsBarChart,
  DefaultLegendContent,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS } from '@/shared/lib/chart-colors';

const ORG_AVG_COLOR = '#e2e8f0';

export interface DurationRangeChartProps {
  data: Array<{
    name: string;
    minDurationMs: number | null;
    avgDurationMs: number;
    maxDurationMs: number | null;
  }>;
  /** Optional dashed reference line at this duration (ms) */
  orgAvgDurationMs?: number | undefined;
  height?: number | undefined;
  ariaLabel?: string | undefined;
}

function msToReadable(ms: number): string {
  if (ms >= 60_000) {
    return `${(ms / 60_000).toFixed(1)}m`;
  }
  return `${(ms / 1_000).toFixed(1)}s`;
}

export function DurationRangeChart({
  data,
  orgAvgDurationMs,
  height,
  ariaLabel,
}: DurationRangeChartProps) {
  const chartHeight = height ?? Math.max(200, data.length * 40 + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <RechartsBarChart data={data} layout="vertical" role="img" aria-label={ariaLabel}>
        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={msToReadable} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
        <Tooltip
          formatter={(
            _value: unknown,
            _name: unknown,
            props: { payload?: Record<string, unknown> },
          ) => {
            const p = props.payload;
            if (!p) return ['—', undefined];
            const min = typeof p.minDurationMs === 'number' ? msToReadable(p.minDurationMs) : '—';
            const avg = typeof p.avgDurationMs === 'number' ? msToReadable(p.avgDurationMs) : '—';
            const max = typeof p.maxDurationMs === 'number' ? msToReadable(p.maxDurationMs) : '—';
            return [`Min ${min} · Avg ${avg} · Max ${max}`, 'Duration'];
          }}
        />
        <Legend
          content={(props) => {
            const payload = [...(props.payload ?? [])];
            if (orgAvgDurationMs !== undefined) {
              payload.push({ value: 'Org avg', type: 'plainline', color: ORG_AVG_COLOR });
            }
            return <DefaultLegendContent {...props} payload={payload} />;
          }}
        />
        {orgAvgDurationMs !== undefined && (
          <ReferenceLine
            x={orgAvgDurationMs}
            stroke={ORG_AVG_COLOR}
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        )}
        <Bar
          dataKey="avgDurationMs"
          name="Avg Duration"
          fill={CHART_COLORS.primary}
          radius={[0, 4, 4, 0]}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
