import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = [
  '#24956e',
  '#4E83A1',
  '#b0823d',
  '#806b9e',
  '#ea7856',
  '#65d6ad',
  '#9aa8a2',
  '#e17b59',
];

export function DeliveriesByStatus({
  data,
  loading,
}: {
  data: Array<{ name: string; value: number }>;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="chart-skeleton skeleton" aria-busy="true" />;
  }
  return (
    <div className="chart-wrap" data-testid="chart-deliveries-by-status">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
