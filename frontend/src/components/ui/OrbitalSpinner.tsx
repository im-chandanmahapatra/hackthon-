import { cn } from './Badge';

interface OrbitalSpinnerProps {
  size?: number;
  className?: string;
}

/**
 * OrbitalSpinner — Premium loading indicator inspired by Apple's visionOS.
 * A circular arc with variable speed sweep and a subtle trail.
 */
export function OrbitalSpinner({ size = 48, className }: OrbitalSpinnerProps) {
  const strokeWidth = size > 40 ? 3 : 2;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      {/* Track ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border-default"
          opacity={0.3}
        />
      </svg>

      {/* Active arc */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 orbital-spinner"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-brand-accent"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.75}
        />
      </svg>

      {/* Glow dot at the leading edge */}
      <div 
        className="absolute inset-0 orbital-spinner"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute rounded-full bg-brand-accent glow-accent"
          style={{
            width: strokeWidth + 2,
            height: strokeWidth + 2,
            top: strokeWidth - 1,
            left: size / 2 - (strokeWidth + 2) / 2,
          }}
        />
      </div>
    </div>
  );
}

/**
 * PageSpinner — Full-page loading state with orbital spinner.
 */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-5 text-muted">
      <OrbitalSpinner size={48} />
      <span className="text-[13px] font-medium tracking-wide">{label}</span>
    </div>
  );
}
