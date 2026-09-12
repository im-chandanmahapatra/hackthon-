import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ShieldAlert, ChevronRight, Activity, Zap } from 'lucide-react';
import type { Incident } from '../../api/types';
import { ackIncident } from '../../api/client';
import { Card } from '../ui/Card';
import { audioEngine } from '../../utils/audio';
import { useToast } from '../../hooks/useToast';
import { cn } from '../ui/Badge';

interface ActionCenterProps {
  incidents: Incident[] | null;
  onRefresh: () => void;
}

export function ActionCenter({ incidents, onRefresh }: ActionCenterProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loadingAckId, setLoadingAckId] = useState<string | null>(null);

  const openIncidents = (incidents || [])
    .filter(i => i.status === 'open')
    .sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0))
    .slice(0, 3);

  const handleQuickAck = async (e: React.MouseEvent, inc: Incident) => {
    e.stopPropagation();
    if (loadingAckId) return;

    setLoadingAckId(inc.id);
    try {
      await ackIncident(inc.id);
      audioEngine.playSuccessChime();
      showToast(`Incident #${inc.id} acknowledged`, 'success');
      onRefresh();
    } catch {
      showToast('Failed to acknowledge incident', 'error');
    } finally {
      setLoadingAckId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      
      {/* ── Section: Urgent Triage Queue ── */}
      <Card className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between pb-3 border-b border-subtle mb-3.5">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-brand-accent" />
            <h3 className="font-display text-[15px] font-bold tracking-[-0.015em] text-primary">
              Immediate Triage
            </h3>
          </div>
          <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger font-bold">
            {openIncidents.length} Pending
          </span>
        </div>

        {openIncidents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-status-success/10 text-status-success flex items-center justify-center mb-2">
              <Check size={18} />
            </div>
            <p className="font-display text-[13px] font-semibold text-primary">All Clear</p>
            <p className="font-body text-[12px] text-muted mt-0.5">No unacknowledged safety hazards.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 flex-1">
            <AnimatePresence>
              {openIncidents.map((inc) => {
                const isHigh = inc.severity === 'high';
                const isAcking = loadingAckId === inc.id;

                return (
                  <motion.div
                    key={inc.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className={cn(
                      "p-3 rounded-[var(--radius-sm)] border transition-all cursor-pointer group flex flex-col gap-2",
                      isHigh 
                        ? "bg-red-500/5 border-red-500/25 hover:border-red-500/40" 
                        : "bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isHigh ? (
                          <ShieldAlert size={14} className="text-status-danger shrink-0" />
                        ) : (
                          <AlertTriangle size={14} className="text-status-warning shrink-0" />
                        )}
                        <span className="font-display text-[13px] font-semibold text-primary truncate">
                          {inc.incident_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-semibold text-muted uppercase">
                        {inc.zone}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-subtle/40">
                      <span className="font-mono text-[11px] text-muted">
                        Conf: <strong className="text-primary">{Math.round(inc.confidence * 100)}%</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleQuickAck(e, inc)}
                          disabled={isAcking}
                          className="px-2.5 py-1 rounded-[var(--radius-xs)] font-body text-[11px] font-semibold bg-brand-primary text-inverse hover:opacity-90 active:scale-[0.96] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {isAcking ? 'Saving…' : 'Acknowledge'}
                        </button>
                        <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* ── Section: Zone Compliance Radar ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-muted" />
            <h3 className="font-display text-[14px] font-bold text-primary">
              Zone Safety Health
            </h3>
          </div>
          <span className="font-mono text-[10px] font-semibold text-muted uppercase">
            Real-time
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {[
            { zone: 'Zone A (Main Yard)', score: 92, status: 'normal' },
            { zone: 'Zone B (Logistics Bay)', score: 98, status: 'optimal' },
            { zone: 'Zone C (Chemical Storage)', score: 84, status: 'warning' },
          ].map((z) => (
            <div key={z.zone} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[12px]">
                <span className="font-body text-secondary font-medium">{z.zone}</span>
                <span className="font-mono font-bold text-primary">{z.score}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    z.score >= 95 ? "bg-emerald-500" : z.score >= 90 ? "bg-brand-accent" : "bg-status-warning"
                  )}
                  style={{ width: `${z.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
