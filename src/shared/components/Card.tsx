import { type ReactNode } from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <section className="card">
      <header className="card-header">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
