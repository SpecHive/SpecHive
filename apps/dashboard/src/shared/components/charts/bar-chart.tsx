import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS } from '@/shared/lib/chart-colors';

export interface HorizontalBarChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  nameKey: string;
  height?: number;
  formatter?: (value: number) => string;
  color?: string;
  ariaLabel?: string;
}

export function HorizontalBarChart({
  data,
  dataKey,
  nameKey,
  height,
  formatter,
  color = CHART_COLORS.primary,
  ariaLabel,
}: HorizontalBarChartProps) {
  const chartHeight = height ?? Math.max(200, data.length * 40 + 40);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <RechartsBarChart data={data} layout="vertical" role="img" aria-label={ariaLabel}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12 }}
          {...(formatter ? { tickFormatter: formatter } : {})}
        />
        <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 12 }} width={120} />
        <Tooltip
          formatter={(value) => [formatter && typeof value === 'number' ? formatter(value) : value]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
