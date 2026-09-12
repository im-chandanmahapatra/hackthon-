import { motion } from 'motion/react';
import { cn } from './Badge';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  layoutId?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  layoutId = 'segmented-control-active',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-full bg-surface-alt/70 border border-border-subtle select-none shadow-xs',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex items-center justify-center font-body font-medium transition-colors duration-200 z-10 focus:outline-none cursor-pointer',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[12px]',
              isActive ? 'text-primary font-semibold' : 'text-muted hover:text-primary'
            )}
          >
            {/* Gliding Active Pill */}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-card-elevated shadow-[0_1px_4px_rgba(0,0,0,0.12)] border border-border-subtle/80 z-[-1]"
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 30,
                }}
              />
            )}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  'ml-1.5 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold',
                  isActive
                    ? 'bg-brand-accent/15 text-brand-accent'
                    : 'bg-surface text-muted'
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
