import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export function PerformanceGauge({
  score,
  label,
  loading,
}: {
  score: number;
  label: string;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="chart-skeleton skeleton" aria-busy="true" />;
  }
  const clamped = Math.max(0, Math.min(100, score));
  const data = [
    { name: 'score', value: clamped },
    { name: 'rest', value: 100 - clamped },
  ];
  return (
    <div className="gauge-wrap" data-testid="chart-performance-gauge">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={85}
            cx="50%"
            cy="90%"
            stroke="none"
          >
            <Cell fill="#24956e" />
            <Cell fill="#e8ece9" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="gauge-center">
        <strong>{clamped}</strong>
        <span>/100</span>
        <p>{label}</p>
      </div>
    </div>
  );
}
