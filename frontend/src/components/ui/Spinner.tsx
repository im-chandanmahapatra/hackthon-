interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 18, md: 32, lg: 48 };

export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const px = SIZE_MAP[size];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent-amber)"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ animation: 'spin 0.8s linear infinite' }}
        aria-label="Loading"
      >
        <circle cx="12" cy="12" r="10" stroke="var(--bg-overlay)" strokeWidth="2.5" />
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      {label && (
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {label}
        </span>
      )}
    </div>
  );
}

/** Full-page centered loading state */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', flexDirection: 'column', gap: 'var(--space-4)'
    }}>
      <Spinner size="lg" label={label} />
    </div>
  );
}
