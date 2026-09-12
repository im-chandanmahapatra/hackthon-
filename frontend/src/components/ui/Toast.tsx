import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import type { Toast as ToastType } from '../../hooks/useToast';
import { cn } from './Badge';

/**
 * ToastList — Glassmorphism toast notifications with warm accent borders.
 * Spring physics for entrance/exit, slide from bottom-right.
 */
export function ToastList({ toasts, onDismiss }: { toasts: ToastType[], onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-3 pointer-events-none w-[360px] max-w-[calc(100vw-48px)]">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 40, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, x: 20, filter: 'blur(2px)', transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-4 rounded-[var(--radius-md)] shadow-[var(--shadow-3)] glass",
              toast.type === 'error' && "border-l-[3px] border-l-status-danger",
              toast.type === 'success' && "border-l-[3px] border-l-status-success",
              toast.type === 'info' && "border-l-[3px] border-l-brand-secondary",
            )}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error' && <AlertCircle className="text-status-danger" size={18} />}
              {toast.type === 'success' && <CheckCircle className="text-status-success" size={18} />}
              {toast.type === 'info' && <Info className="text-brand-secondary" size={18} />}
            </div>

            {/* Message */}
            <div className="flex-1 text-[13px] font-medium text-primary leading-snug">
              {toast.message}
            </div>

            {/* Close button */}
            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 text-muted hover:text-primary transition-colors p-1 -m-1 rounded-[var(--radius-xs)] hover:bg-surface-hover"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
