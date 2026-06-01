export function Toast({
  message,
  onClose,
  closeLabel,
  variant = "success",
}: {
  message: string;
  onClose: () => void;
  closeLabel: string;
  variant?: "success" | "error";
}) {
  return (
    <div className={`toast toast-${variant}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label={closeLabel}>
        x
      </button>
    </div>
  );
}
