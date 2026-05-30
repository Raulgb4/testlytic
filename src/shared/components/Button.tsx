type ButtonProps = {
  children: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
};

export function Button({ children, variant = "primary", onClick, disabled }: ButtonProps) {
  const className = variant === "primary" ? "btn btn-primary" : "btn btn-secondary";
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
