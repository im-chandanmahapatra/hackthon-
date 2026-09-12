import { Loader2 } from 'lucide-react';
import { cn } from './Badge';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Small inline spinner using Lucide icon — for buttons, inline states */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeMap = {
    sm: 14,
    md: 20,
    lg: 28,
  };

  return (
    <Loader2 
      size={sizeMap[size]} 
      className={cn("animate-spin text-muted", className)} 
    />
  );
}

/** Full-page loading state with premium orbital spinner */
export { PageSpinner } from './OrbitalSpinner';
