import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { themeColors } from '../theme';

export function DeliveriesByHour({
  data,
  loading,
}: {
  data: Array<{ hour: string; count: number }>;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="chart-skeleton skeleton" aria-busy="true" />;
  }
  return (
    <div className="chart-wrap" data-testid="chart-deliveries-by-hour">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={themeColors.chartGrid} />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke={themeColors.chartAxis} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke={themeColors.chartAxis} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            name="Entregas"
            stroke={themeColors.primary}
            strokeWidth={2.5}
            dot={{ r: 3, fill: themeColors.primary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
