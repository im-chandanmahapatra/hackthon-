import { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Monitor, Video, Settings } from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { getIncidents } from '../../api/client';
import { MorphingThemeToggle } from '../ui/MorphingThemeToggle';
import { ArgusMark } from '../brand/ArgusLogo';
import { cn } from '../ui/Badge';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/video-intelligence', label: 'Video Intel', icon: Monitor },
  { path: '/cameras', label: 'Cameras', icon: Video },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const;

function DockItem({
  item,
  isActive,
  badge,
}: {
  item: typeof NAV_ITEMS[number];
  isActive: boolean;
  badge?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className="relative focus:outline-none select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={item.label}
    >
      <motion.div
        whileHover={{ y: -2, scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 26,
          mass: 0.8,
        }}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-full transition-colors duration-200",
          isActive
            ? "text-inverse"
            : "text-muted hover:text-primary hover:bg-surface-hover/80"
        )}
      >
        {/* Gliding active pill background with soft glow */}
        {isActive && (
          <motion.div
            layoutId="dock-active-pill"
            className="absolute inset-0 rounded-full bg-brand-primary shadow-[0_2px_12px_rgba(0,0,0,0.18)] dark:shadow-[0_0_16px_rgba(234,88,12,0.22)]"
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 28,
            }}
          />
        )}

        {/* Icon */}
        <span className="relative z-10 flex items-center justify-center">
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            className="transition-transform duration-200"
          />
        </span>

        {/* Badge overlay for open incidents */}
        {badge !== undefined && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="absolute -top-0.5 -right-0.5 z-20 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-status-danger text-white text-[9px] font-bold leading-none shadow-sm"
          >
            {badge > 99 ? '99+' : badge}
          </motion.span>
        )}
      </motion.div>

      {/* Floating tooltip label */}
      <AnimatePresence>
        {isHovered && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.94 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-tight whitespace-nowrap pointer-events-none
              bg-brand-primary text-inverse shadow-[0_4px_16px_rgba(0,0,0,0.18)] z-50 border border-border-subtle"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export function FloatingDock() {
  const location = useLocation();
  const { data: incidents } = usePolling(() => getIncidents(), 3000);
  const openCount = incidents?.filter(i => i.status === 'open').length ?? 0;

  // Track scroll for subtle dock opacity reduction while scrolling fast
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(true);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => setIsScrolled(false), 1200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{
        y: 0,
        opacity: isScrolled ? 0.6 : 1,
      }}
      whileHover={{ opacity: 1 }}
      transition={{
        y: { type: 'spring', stiffness: 320, damping: 28 },
        opacity: { duration: 0.25 },
      }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 select-none"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 glass rounded-full">
        {/* Brand Mark with subtle hover */}
        <Link
          to="/"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-hover/80 transition-colors duration-200 group focus:outline-none"
          title="Argus — Safety Intelligence"
        >
          <motion.div
            whileHover={{ scale: 1.1, rotate: -3 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-accent/10 text-brand-accent"
          >
            <ArgusMark size={18} variant="accent" />
          </motion.div>
        </Link>

        {/* Separator */}
        <div className="w-px h-5 bg-border-subtle mx-0.5" />

        {/* Navigation Items with Equal Spacing */}
        <div className="flex items-center gap-1.5">
          {NAV_ITEMS.map((item) => (
            <DockItem
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              badge={item.path === '/' ? openCount : undefined}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border-subtle mx-0.5" />

        {/* Live Telemetry Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-muted hover:text-primary transition-colors duration-200 cursor-default"
          title="Real-time inference stream connected"
        >
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </div>
          <span className="text-[10px] font-mono font-semibold tracking-wider uppercase hidden sm:inline">
            Live
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border-subtle mx-0.5" />

        {/* Theme Toggle Button */}
        <div className="flex items-center justify-center pl-0.5">
          <MorphingThemeToggle />
        </div>
      </div>
    </motion.nav>
  );
}
