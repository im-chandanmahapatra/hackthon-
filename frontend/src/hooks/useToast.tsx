import { useState, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Optional bold title rendered above message */
  title?: string;
  /** Hazard key for icon/color lookup (e.g. 'no_helmet', 'fire') */
  hazardType?: string;
  /** Displayed timestamp string (auto-set when not provided) */
  timestamp?: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, opts?: Partial<Pick<Toast, 'title' | 'hazardType' | 'timestamp'>>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    opts?: Partial<Pick<Toast, 'title' | 'hazardType' | 'timestamp'>>,
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const timestamp = opts?.timestamp ?? new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
    setToasts((prev) => [...prev.slice(-4), { id, message, type, timestamp, ...opts }]);
    // Fire alerts persist longer
    const duration = (type === 'error' || opts?.hazardType === 'fire' || opts?.hazardType === 'smoke') ? 7000 : 5000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
