export function MetricLine({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className ? `metric-inline ${className}` : "metric-inline"}>
      <span className="metric-inline-label">{label}</span>
      <span className="metric-inline-value">{value}</span>
    </div>
  );
}
