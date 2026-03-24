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

export interface StackedBarChartProps {
  data: Array<{
    name: string;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
  }>;
  /** Optional vertical reference line at this pass-rate percentage */
  orgAveragePassRate?: number | undefined;
  height?: number | undefined;
  ariaLabel?: string | undefined;
}

function tooltipFormatter(
  value: number | string | Array<number | string>,
  _name: string,
  props: { payload?: Record<string, number> },
): [string, undefined] {
  const numValue = typeof value === 'number' ? value : 0;
  const row = props.payload ?? {};
  const total = (row.passed ?? 0) + (row.failed ?? 0) + (row.skipped ?? 0) + (row.flaky ?? 0);
  const pct = total > 0 ? ((numValue / total) * 100).toFixed(1) : '0.0';
  return [`${numValue} (${pct}%)`, undefined];
}

export function StackedBarChart({
  data,
  orgAveragePassRate,
  height,
  ariaLabel,
}: StackedBarChartProps) {
  const chartHeight = height ?? Math.max(200, data.length * 40 + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <RechartsBarChart
        data={data}
        layout="vertical"
        stackOffset="expand"
        role="img"
        aria-label={ariaLabel}
      >
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 12 }}
        />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
        <Tooltip formatter={tooltipFormatter as (...args: unknown[]) => [string, undefined]} />
        <Legend
          content={(props) => {
            const payload = [...(props.payload ?? [])];
            if (orgAveragePassRate !== undefined) {
              payload.push({ value: 'Org avg', type: 'plainline', color: ORG_AVG_COLOR });
            }
            return <DefaultLegendContent {...props} payload={payload} />;
          }}
        />
        {orgAveragePassRate !== undefined && (
          <ReferenceLine
            x={orgAveragePassRate / 100}
            stroke={ORG_AVG_COLOR}
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        )}
        <Bar dataKey="passed" name="Passed" stackId="outcome" fill={CHART_COLORS.pass} />
        <Bar dataKey="failed" name="Failed" stackId="outcome" fill={CHART_COLORS.fail} />
        <Bar dataKey="skipped" name="Skipped" stackId="outcome" fill={CHART_COLORS.skip} />
        <Bar
          dataKey="flaky"
          name="Flaky"
          stackId="outcome"
          fill={CHART_COLORS.warning}
          radius={[0, 4, 4, 0]}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
