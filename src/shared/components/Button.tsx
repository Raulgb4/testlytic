import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
};

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const variantClassName = `btn btn-${variant}`;
  const resolvedClassName = className ? `${variantClassName} ${className}` : variantClassName;
  return (
    <button type={type} className={resolvedClassName} {...props}>
      {children}
    </button>
  );
}
