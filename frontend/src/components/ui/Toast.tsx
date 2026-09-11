import type { Toast, ToastType } from '../../hooks/useToast';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const COLORS: Record<ToastType, string> = {
  success: 'var(--color-safe)',
  error: 'var(--color-critical)',
  info: 'var(--accent-blue)',
};

interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastList({ toasts, onDismiss }: ToastListProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} role="alert">
          <span
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: COLORS[t.type],
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {ICONS[t.type]}
          </span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '1rem', lineHeight: 1, padding: '0 0 0 var(--space-2)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
