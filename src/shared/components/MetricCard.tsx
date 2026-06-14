export type Metric = {
  label: string;
  value: string;
  change: string;
};

export function MetricCard({ item }: { item: Metric }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{item.label}</p>
      <p className="metric-value">{item.value}</p>
      <p className="metric-change">{item.change}</p>
    </article>
  );
}
