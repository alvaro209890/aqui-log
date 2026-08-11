import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { chartSeriesColors } from '../theme';

const COLORS = chartSeriesColors;

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
          {/*
            UX-02 — Recharts 3.9 + React 19 (StrictMode): a animação padrão do
            Pie usa um estado de raio interpolado por rAF que o double-invoke
            de efeitos do StrictMode corrompe, colapsando os setores numa
            linha quase invisível em vez do círculo. `isAnimationActive={false}`
            evita a máquina de animação problemática; o gráfico é pequeno o
            bastante para a perda de animação não ser sentida.
          */}
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            isAnimationActive={false}
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
