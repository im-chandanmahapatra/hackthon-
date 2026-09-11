interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--space-12) var(--space-8)',
        gap: 'var(--space-4)', textAlign: 'center', minHeight: 320,
      }}
    >
      <span style={{ fontSize: '3rem', lineHeight: 1 }}>{icon}</span>
      <div>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>{title}</h3>
        {description && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 360 }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
