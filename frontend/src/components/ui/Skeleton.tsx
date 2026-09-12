import { cn } from './Badge';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton bg-surface-alt/70 rounded-[var(--radius-sm)]', className)}
      {...props}
    />
  );
}

export function MetricTileSkeleton() {
  return (
    <div className="p-4 sm:p-5 rounded-[var(--radius-md)] bg-card-elevated border border-default card-glow flex flex-col justify-between h-[104px]">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <div className="flex items-baseline justify-between mt-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function ViewportSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] bg-card-elevated border border-default card-glow overflow-hidden">
      <div className="px-5 py-3 border-b border-subtle flex justify-between items-center bg-surface/60">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="aspect-[16/9] sm:aspect-[16/8.5] bg-surface-alt/40 flex items-center justify-center p-8">
        <Skeleton className="w-full h-full rounded-[var(--radius-sm)]" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-[var(--radius-md)] bg-card-elevated border border-default card-glow p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-[220px] w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-card-elevated border border-default card-glow overflow-hidden divide-y divide-border-subtle">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-2 h-2 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
