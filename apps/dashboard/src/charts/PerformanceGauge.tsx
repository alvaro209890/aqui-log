import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { themeColors } from '../theme';

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
          {/* UX-02 — mesmo achado de DeliveriesByStatus.tsx: a animação
              padrão do Pie do Recharts 3.9 colapsa em React 19 StrictMode. */}
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
            isAnimationActive={false}
          >
            <Cell fill={themeColors.primary} />
            <Cell fill={themeColors.chartTrack} />
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
