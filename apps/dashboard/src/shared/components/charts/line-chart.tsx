import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ContentType } from 'recharts/types/component/Tooltip';

import { CHART_COLORS } from '@/shared/lib/chart-colors';

const DEFAULT_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.pass,
  CHART_COLORS.fail,
  CHART_COLORS.warning,
  CHART_COLORS.purple,
];

export interface LineChartLine {
  key: string;
  label: string;
  color?: string;
  dashed?: boolean;
}

export interface LineChartProps<T extends object = object> {
  data: T[];
  xKey: string;
  lines: LineChartLine[];
  height?: number;
  xFormatter?: (value: string) => string;
  yFormatter?: (value: number) => string;
  yDomain?: [number | 'auto', number | 'auto'];
  tooltipContent?: ContentType<number, string>;
  ariaLabel?: string;
}

export function LineChart<T extends object>({
  data,
  xKey,
  lines,
  height = 300,
  xFormatter,
  yFormatter,
  yDomain,
  tooltipContent,
  ariaLabel,
}: LineChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} role="img" aria-label={ariaLabel}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" />
        <XAxis
          dataKey={xKey}
          {...(xFormatter ? { tickFormatter: xFormatter } : {})}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          {...(yDomain ? { domain: yDomain } : {})}
          {...(yFormatter ? { tickFormatter: yFormatter } : {})}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => [
            yFormatter && typeof value === 'number' ? yFormatter(value) : value,
          ]}
          {...(tooltipContent ? { content: tooltipContent } : {})}
        />
        <Legend />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            {...(line.dashed ? { strokeDasharray: '5 5' } : {})}
            dot={false}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
