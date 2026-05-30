export type StatusKind = "correct" | "incorrect" | "unanswered";

export function StatusPill({ label, status }: { label: string; status: StatusKind }) {
  return <span className={`status-pill ${status}`}>{label}</span>;
}
