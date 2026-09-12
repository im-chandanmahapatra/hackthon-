import { useEffect, useState, useRef } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Lenis from 'lenis';
import { FloatingDock } from './FloatingDock';
import { ArgusLogo } from '../brand/ArgusLogo';
import { ToastList } from '../ui/Toast';
import { CommandPalette } from '../ui/CommandPalette';
import { CommandSearchPill } from '../ui/CommandSearchPill';
import { useToast } from '../../hooks/useToast';
import { usePolling } from '../../hooks/usePolling';
import { getIncidents } from '../../api/client';
import { audioEngine } from '../../utils/audio';

/**
 * AppLayout — Full-width layout with master top header, Raycast-style command search pill,
 * live connection telemetry state, and floating bottom dock.
 */
export function AppLayout() {
  const { toasts, dismissToast } = useToast();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');

  // Smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Monitor incident updates for audio chimes on new high-severity incidents & update lastSynced
  const prevCountRef = useRef<number | null>(null);
  const { data: incidents, error } = usePolling(() => getIncidents(), 3500);

  useEffect(() => {
    if (incidents) {
      setLastSyncedTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const highOpenCount = incidents.filter(i => i.severity === 'high' && i.status === 'open').length;
      if (prevCountRef.current !== null && highOpenCount > prevCountRef.current) {
        audioEngine.playAlertChime();
      }
      prevCountRef.current = highOpenCount;
    }
  }, [incidents]);

  return (
    <div className="min-h-screen bg-background text-primary">
      {/* Main content — full width, generous padding, dock clearance at bottom */}
      <main className="min-h-screen">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 pt-6 pb-28 min-h-full flex flex-col">
          
          {/* Master Top Header with Centered Command Search Pill */}
          <header className="flex items-center justify-between gap-4 pb-4 mb-6 sm:mb-8 border-b border-subtle select-none">
            <Link
              to="/"
              className="flex items-center gap-3 group focus:outline-none transition-transform duration-150 active:scale-[0.99] shrink-0"
            >
              <ArgusLogo size="md" variant="accent" showWordmark={true} showTagline={true} />
            </Link>

            {/* Centered Raycast / Linear Command Search Pill */}
            <div className="flex-1 flex justify-center max-w-md mx-2">
              <CommandSearchPill onClick={() => setIsSearchOpen(true)} />
            </div>

            {/* Right: Live Connection & Node Telemetry */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border-subtle shadow-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-status-danger' : 'bg-emerald-500 animate-pulse'}`} />
                  {error ? 'RECONNECTING' : 'US-EAST-01'}
                </span>
                {lastSyncedTime && (
                  <>
                    <span className="hidden lg:inline text-border-default">/</span>
                    <span className="hidden lg:inline font-mono text-[10px] text-muted">
                      SYNC: <strong className="text-primary font-semibold">{lastSyncedTime}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="flex-1 flex flex-col"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating dock — capsule navigation */}
      <FloatingDock />

      {/* Command Palette Modal */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Toasts — positioned above the dock */}
      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
