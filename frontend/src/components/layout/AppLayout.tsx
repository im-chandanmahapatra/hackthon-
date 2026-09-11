import { Outlet, useOutletContext } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastList } from '../ui/Toast';
import { useToast } from '../../hooks/useToast';

interface AppContext {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/** Access the app-level toast from any child page via useOutletContext<AppContext>() */
export function useAppContext() {
  return useOutletContext<AppContext>();
}

interface AppLayoutProps {
  incidentCount?: number;
  isPollingActive?: boolean;
}

export function AppLayout({ incidentCount = 0, isPollingActive = false }: AppLayoutProps) {
  const { toasts, showToast, dismissToast } = useToast();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <Sidebar incidentCount={incidentCount} isPollingActive={isPollingActive} />

      {/* Main content area */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
        }}
        id="main-content"
      >
        <Outlet context={{ showToast } satisfies AppContext} />
      </main>

      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
