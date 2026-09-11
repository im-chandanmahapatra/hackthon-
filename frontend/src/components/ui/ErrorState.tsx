interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--space-12) var(--space-8)',
        gap: 'var(--space-4)', textAlign: 'center', minHeight: 320,
      }}
    >
      <span
        style={{
          fontSize: '2.5rem', width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ⚠️
      </span>
      <div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>{title}</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 400 }}>
          {message}
        </p>
      </div>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          ↻ Retry
        </button>
      )}
    </div>
  );
}
