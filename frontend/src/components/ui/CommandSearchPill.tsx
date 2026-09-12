import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import { cn } from './Badge';

interface CommandSearchPillProps {
  onClick: () => void;
  className?: string;
}

/**
 * CommandSearchPill — Raycast / Linear style floating capsule search button.
 */
export function CommandSearchPill({ onClick, className }: CommandSearchPillProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.015, y: -0.5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      className={cn(
        "relative flex items-center justify-between h-11 w-[260px] sm:w-[320px] px-3.5 rounded-full",
        "bg-surface border border-default shadow-[0_2px_12px_rgba(30,26,22,0.06)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]",
        "hover:border-brand-accent/40 hover:shadow-[0_4px_20px_rgba(30,26,22,0.1)] dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.45)]",
        "text-muted hover:text-primary transition-colors cursor-pointer select-none focus:outline-none",
        className
      )}
      aria-label="Search telemetry and commands"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Search size={15} className="text-muted shrink-0" />
        <span className="font-body text-[13px] text-muted truncate">
          Search telemetry, cameras...
        </span>
      </div>

      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-surface-alt border border-border-subtle text-muted shrink-0">
        ⌘K
      </kbd>
    </motion.button>
  );
}
