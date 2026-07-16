import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ece9" />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#9aa8a2" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#9aa8a2" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            name="Entregas"
            stroke="#24956e"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#65d6ad' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
