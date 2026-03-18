import { Line, LineChart as RechartsLineChart, ResponsiveContainer } from 'recharts';

import { CHART_COLORS } from '@/shared/lib/chart-colors';

export interface SparklineProps {
  data: Array<{ date: string; value: number }>;
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  data,
  color = CHART_COLORS.primary,
  width = 120,
  height = 32,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <span
        className="inline-block bg-slate-200"
        style={{ width, height: 1, alignSelf: 'center' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <RechartsLineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
