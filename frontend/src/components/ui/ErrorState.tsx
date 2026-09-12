import { motion } from 'motion/react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex flex-col items-center justify-center p-8 bg-red-50/50 dark:bg-red-500/5 border border-red-200/40 dark:border-red-500/10 rounded-[var(--radius-md)] text-center max-w-md mx-auto"
    >
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
        <AlertOctagon size={22} className="text-status-danger" />
      </div>
      <h3 className="text-primary font-semibold mb-1 text-[15px]">{title}</h3>
      <p className="text-muted text-[13px] mb-5 leading-relaxed">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface border border-default text-primary rounded-[var(--radius-sm)] text-[13px] font-medium hover:bg-surface-hover hover:border-hover transition-all shadow-[var(--shadow-1)]"
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </motion.div>
  );
}
