import React from 'react';
import { AlertTriangle, HardHat, Glasses, Shirt, Flame, Wind, Hand } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for merging tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BadgeProps {
  variant: 'high' | 'medium' | 'low' | 'active' | 'offline' | 'open' | 'acknowledged' | 'default';
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function incidentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    no_helmet: 'No Helmet',
    no_vest: 'No Vest',
    no_boots: 'No Boots',
    no_gloves: 'No Gloves',
    no_goggles: 'No Goggles',
    fire: 'Fire Detected',
    smoke: 'Smoke Detected',
  };
  return map[type] || type.replace('_', ' ');
}

export function incidentTypeIcon(type: string, size = 16) {
  switch (type) {
    case 'fire': return <Flame size={size} />;
    case 'smoke': return <Wind size={size} />;
    case 'no_helmet': return <HardHat size={size} />;
    case 'no_vest': return <Shirt size={size} />;
    case 'no_goggles': return <Glasses size={size} />;
    case 'no_gloves': return <Hand size={size} />;
    default: return <AlertTriangle size={size} />;
  }
}

/**
 * Badge — Warm Stone palette badges using CSS custom properties.
 * No hardcoded Tailwind colors — everything flows from the design system.
 */
export function Badge({ variant, children, dot, className }: BadgeProps) {
  const variants: Record<string, string> = {
    high:         'bg-red-50 text-red-800 border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/15',
    medium:       'bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/15',
    low:          'bg-stone-100 text-stone-600 border-stone-200/60 dark:bg-stone-500/10 dark:text-stone-400 dark:border-stone-500/15',
    active:       'bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/15',
    offline:      'bg-stone-100 text-stone-500 border-stone-200/60 dark:bg-stone-400/10 dark:text-stone-500 dark:border-stone-400/15',
    open:         'bg-orange-50 text-orange-800 border-orange-200/60 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/15',
    acknowledged: 'bg-sky-50 text-sky-800 border-sky-200/60 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/15',
    default:      'bg-stone-100 text-stone-600 border-stone-200/60 dark:bg-stone-500/10 dark:text-stone-400 dark:border-stone-500/15',
  };

  const dotColors: Record<string, string> = {
    high:         'bg-red-500',
    medium:       'bg-amber-500',
    low:          'bg-stone-400',
    active:       'bg-emerald-500',
    offline:      'bg-stone-400',
    open:         'bg-orange-500',
    acknowledged: 'bg-sky-500',
    default:      'bg-stone-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
