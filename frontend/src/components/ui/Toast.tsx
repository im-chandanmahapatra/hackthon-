import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X, Flame, Wind, Shield, HardHat } from 'lucide-react';
import type { Toast as ToastType } from '../../hooks/useToast';
import { cn } from './Badge';

// ─── Hazard icon map ──────────────────────────────────────────────────────────

const HAZARD_ICONS: Record<string, React.ReactNode> = {
  no_helmet:  <HardHat size={16} />,
  no_boots:   <Shield size={16} />,
  no_gloves:  <Shield size={16} />,
  no_goggles: <Shield size={16} />,
  no_vest:    <Shield size={16} />,
  smoke:      <Wind size={16} />,
  fire:       <Flame size={16} />,
};

const HAZARD_COLORS: Record<string, { border: string; icon: string; bg: string }> = {
  no_helmet:  { border: 'border-l-amber-500',  icon: 'text-amber-500',  bg: 'bg-amber-500/10' },
  no_boots:   { border: 'border-l-amber-500',  icon: 'text-amber-500',  bg: 'bg-amber-500/10' },
  no_gloves:  { border: 'border-l-amber-500',  icon: 'text-amber-500',  bg: 'bg-amber-500/10' },
  no_goggles: { border: 'border-l-amber-500',  icon: 'text-amber-500',  bg: 'bg-amber-500/10' },
  no_vest:    { border: 'border-l-orange-500', icon: 'text-orange-500', bg: 'bg-orange-500/10' },
  smoke:      { border: 'border-l-slate-400',  icon: 'text-slate-400',  bg: 'bg-slate-400/10' },
  fire:       { border: 'border-l-red-500',    icon: 'text-red-500',    bg: 'bg-red-500/10' },
};

// ─── Toast component ──────────────────────────────────────────────────────────

/**
 * ToastList — Glassmorphism toast notifications with warm accent borders.
 * Spring physics for entrance/exit, slide from bottom-right.
 */
export function ToastList({ toasts, onDismiss }: { toasts: ToastType[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-3 pointer-events-none w-[380px] max-w-[calc(100vw-48px)]">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const hazardKey = toast.hazardType;
          const hc = hazardKey ? HAZARD_COLORS[hazardKey] : null;
          const hIcon = hazardKey ? HAZARD_ICONS[hazardKey] : null;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 40, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, x: 20, filter: 'blur(2px)', transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-[var(--radius-md)] shadow-[var(--shadow-3)] glass border-l-[3px]',
                toast.type === 'error'   && !hc && 'border-l-status-danger',
                toast.type === 'success' && !hc && 'border-l-status-success',
                toast.type === 'info'    && !hc && 'border-l-brand-secondary',
                toast.type === 'warning' && !hc && 'border-l-amber-500',
                hc && hc.border,
              )}
            >
              {/* Hazard Icon Circle or standard icon */}
              {hc && hIcon ? (
                <div className={cn('shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5', hc.bg)}>
                  <span className={hc.icon}>{hIcon}</span>
                </div>
              ) : (
                <div className="shrink-0 mt-0.5">
                  {toast.type === 'error'   && <AlertCircle   className="text-status-danger"    size={18} />}
                  {toast.type === 'success' && <CheckCircle   className="text-status-success"   size={18} />}
                  {toast.type === 'info'    && <Info          className="text-brand-secondary"  size={18} />}
                  {toast.type === 'warning' && <AlertTriangle className="text-amber-500"        size={18} />}
                </div>
              )}

              {/* Message body */}
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="font-display text-[13px] font-bold text-primary leading-tight mb-0.5">{toast.title}</p>
                )}
                <p className={cn(
                  'font-body leading-snug text-secondary',
                  toast.title ? 'text-[12px]' : 'text-[13px] font-medium text-primary'
                )}>
                  {toast.message}
                </p>
                {toast.timestamp && (
                  <p className="font-mono text-[10px] text-muted mt-1 uppercase tracking-wide">{toast.timestamp}</p>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 text-muted hover:text-primary transition-colors p-1 -m-1 rounded-[var(--radius-xs)] hover:bg-surface-hover"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
