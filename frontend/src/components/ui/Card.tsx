import type { ReactNode } from 'react';
import { cn } from './Badge';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  /** Accent left border: 'danger' | 'warning' | 'accent' */
  accent?: 'danger' | 'warning' | 'accent';
}

/**
 * Card — Elevated surface with material depth.
 * Dark mode gets inner glow (top-edge light reflection) and noise texture.
 */
export function Card({ children, className, hoverable, accent }: CardProps) {
  return (
    <div className={cn(
      "bg-card-elevated border border-default rounded-[var(--radius-md)] card-glow transition-all duration-200 ease-out",
      hoverable && "hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 hover:border-hover cursor-pointer",
      accent === 'danger' && "border-l-[3px] border-l-status-danger",
      accent === 'warning' && "border-l-[3px] border-l-status-warning",
      accent === 'accent' && "border-l-[3px] border-l-brand-accent",
      className
    )}>
      {children}
    </div>
  );
}
