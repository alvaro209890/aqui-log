import type { ReactNode } from 'react';
import { formatChange } from '../chartMappers';

export function MetricCard({
  icon,
  tone,
  label,
  value,
  changePercent,
  loading,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: string;
  changePercent: number | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <article className="metric-card skeleton-card" aria-busy="true">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton-lines">
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line tiny" />
        </div>
      </article>
    );
  }

  const change = formatChange(changePercent);
  const positive =
    changePercent !== null && changePercent > 0
      ? true
      : changePercent !== null && changePercent < 0
        ? false
        : null;

  return (
    <article className="metric-card">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span
          className={
            positive === true
              ? 'positive'
              : positive === false
                ? 'negative'
                : ''
          }
        >
          {change} vs ontem
        </span>
      </div>
    </article>
  );
}
