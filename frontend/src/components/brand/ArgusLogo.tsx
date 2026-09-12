import type { SVGProps } from 'react';
import { cn } from '../ui/Badge';

export interface LogoProps extends SVGProps<SVGSVGElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'monochrome' | 'accent' | 'subtle';
  className?: string;
}

const SIZE_MAP = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

/**
 * Argus Sentinel Prism Mark
 * A minimalist, timeless geometric silhouette combining the letterform 'A'
 * with a precision optical focal axis.
 * Engineered for sub-pixel clarity from 16x16px to billboard scale.
 */
export function ArgusMark({
  size = 'md',
  variant = 'accent',
  className,
  ...props
}: LogoProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];

  const colorClass = {
    monochrome: 'text-primary fill-current',
    accent: 'text-brand-accent fill-current',
    subtle: 'text-muted fill-current',
  }[variant];

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block shrink-0 transition-colors duration-200', colorClass, className)}
      aria-label="Argus Logo"
      {...props}
    >
      {/* 
        Mathematical Sentinel Geometry:
        - Outer chevron with precision 45° apex
        - Optical negative-space core
        - Floating calibrated focal diamond
      */}
      {/* Left Monolith Pillar */}
      <path
        d="M16 2.5L3 27H9.5L16 14.5V2.5Z"
        fill="currentColor"
      />
      {/* Right Monolith Pillar */}
      <path
        d="M16 2.5V14.5L22.5 27H29L16 2.5Z"
        fill="currentColor"
        fillOpacity="0.88"
      />
      {/* Floating Precision Focal Core (The Optical Horizon) */}
      <path
        d="M16 17.5L20 23.5H12L16 17.5Z"
        fill="currentColor"
      />
      {/* Sub-pixel ground balance bar */}
      <rect
        x="13.5"
        y="25.5"
        width="5"
        height="1.5"
        rx="0.75"
        fill="currentColor"
        fillOpacity="0.6"
      />
    </svg>
  );
}

/**
 * Argus Complete Brand Lockup (Mark + Typographic Wordmark)
 */
export function ArgusLogo({
  size = 'md',
  variant = 'accent',
  showWordmark = true,
  showTagline = false,
  className,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'monochrome' | 'accent' | 'subtle';
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <ArgusMark size={size} variant={variant} />
      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold tracking-[0.18em] text-[13px] uppercase text-primary leading-none">
              Argus
            </span>
            <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-[4px] bg-brand-accent-subtle text-brand-accent uppercase font-bold leading-none">
              AI
            </span>
          </div>
          {showTagline && (
            <span className="text-[10px] text-muted tracking-tight mt-0.5 leading-none">
              Safety Intelligence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
