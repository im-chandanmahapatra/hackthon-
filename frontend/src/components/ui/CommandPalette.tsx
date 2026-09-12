import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, LayoutDashboard, UploadCloud, Video, Settings, Sun, Moon, Volume2, ShieldAlert } from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { getIncidents } from '../../api/client';
import { useTheme } from '../ThemeProvider';
import { audioEngine } from '../../utils/audio';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: incidents } = usePolling(() => getIncidents(), 4000);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or custom event
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navigationItems = [
    { id: 'nav-overview', label: 'Go to Overview', icon: LayoutDashboard, category: 'Navigation', action: () => navigate('/') },
    { id: 'nav-upload', label: 'Go to Upload Footage', icon: UploadCloud, category: 'Navigation', action: () => navigate('/upload') },
    { id: 'nav-cameras', label: 'Go to Edge Cameras', icon: Video, category: 'Navigation', action: () => navigate('/cameras') },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, category: 'Navigation', action: () => navigate('/settings') },
    { 
      id: 'cmd-theme', 
      label: `Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`, 
      icon: resolvedTheme === 'dark' ? Sun : Moon, 
      category: 'Preferences', 
      action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark') 
    },
    { 
      id: 'cmd-audio', 
      label: 'Test Notification Audio Chime', 
      icon: Volume2, 
      category: 'Audio', 
      action: () => audioEngine.playAlertChime() 
    },
  ];

  const incidentItems = useMemo(() => {
    if (!incidents) return [];
    return incidents.map(inc => ({
      id: `inc-${inc.id}`,
      label: `${inc.incident_type.replace('_', ' ').toUpperCase()} in ${inc.zone}`,
      sublabel: `ID: ${inc.id} · ${Math.round(inc.confidence * 100)}% confidence`,
      icon: ShieldAlert,
      category: 'Recent Incidents',
      action: () => navigate(`/incidents/${inc.id}`),
    }));
  }, [incidents, navigate]);

  const allItems = useMemo(() => {
    const combined = [...navigationItems, ...incidentItems];
    if (!query.trim()) return combined;
    const q = query.toLowerCase();
    return combined.filter(item => 
      item.label.toLowerCase().includes(q) || 
      (item as { sublabel?: string }).sublabel?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [navigationItems, incidentItems, query]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="relative w-full max-w-[560px] glass rounded-[var(--radius-lg)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden border border-border-default z-10"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-subtle">
              <Search size={18} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search telemetry, switch cameras, or type a command..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-transparent font-body text-[14px] text-primary placeholder:text-muted focus:outline-none"
              />
              <span className="px-1.5 py-0.5 rounded font-mono text-[10px] text-muted border border-border-subtle bg-surface-hover">
                ESC
              </span>
            </div>

            {/* Results List */}
            <div className="max-h-[340px] overflow-y-auto p-2 divide-y divide-border-subtle/50">
              {allItems.length === 0 ? (
                <div className="py-12 text-center font-body text-[13px] text-muted">
                  No commands or incidents found for "{query}".
                </div>
              ) : (
                allItems.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        item.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-[var(--radius-sm)] cursor-pointer transition-colors duration-150 ${
                        isSelected 
                          ? 'bg-brand-primary text-inverse' 
                          : 'text-primary hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={16} className={isSelected ? 'text-inverse shrink-0' : 'text-muted shrink-0'} />
                        <div className="truncate">
                          <div className={`font-display text-[13px] font-semibold truncate ${isSelected ? 'text-inverse' : 'text-primary'}`}>
                            {item.label}
                          </div>
                          {(item as { sublabel?: string }).sublabel && (
                            <div className={`font-mono text-[11px] truncate ${isSelected ? 'text-inverse/75' : 'text-muted'}`}>
                              {(item as { sublabel?: string }).sublabel}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-inverse' : 'bg-surface-alt text-muted'
                      }`}>
                        {item.category}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-surface/50 border-t border-subtle flex items-center justify-between text-[11px] font-mono text-muted">
              <span>Use ↑↓ to navigate</span>
              <span>↵ to select</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
