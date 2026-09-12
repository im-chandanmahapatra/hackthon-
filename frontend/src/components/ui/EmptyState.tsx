import React from 'react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)] bg-surface-alt border border-default text-muted mb-4">
        {icon}
      </div>
      <h3 className="text-primary text-[15px] font-semibold mb-1">{title}</h3>
      <p className="text-muted text-[13px] max-w-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
