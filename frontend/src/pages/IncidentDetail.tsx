import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, MapPin, Camera, Clock, ImageOff, Check } from 'lucide-react';
import { getIncident, ackIncident } from '../api/client';
import type { Incident } from '../api/types';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../hooks/useToast';
import { Badge, incidentTypeLabel, cn } from '../components/ui/Badge';
import { PageSpinner } from '../components/ui/Spinner';
import { ErrorState } from '../components/ui/ErrorState';
import { Card } from '../components/ui/Card';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Spinner } from '../components/ui/Spinner';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [optimisticAcked, setOptimisticAcked] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  const { data: incident, error, loading, refresh } = usePolling<Incident>(
    useCallback(() => getIncident(id!), [id]), 
    5000, 
    !optimisticAcked
  );

  const effectiveAcked = optimisticAcked || incident?.status === 'acknowledged';

  async function handleAck() {
    if (!incident || effectiveAcked || ackLoading) return;
    setAckLoading(true);
    setOptimisticAcked(true);

    try {
      await ackIncident(incident.id);
      showToast('Incident acknowledged successfully', 'success');
      refresh();
    } catch (err) {
      setOptimisticAcked(false);
      showToast(err instanceof Error ? err.message : 'Failed to acknowledge.', 'error');
    } finally {
      setAckLoading(false);
    }
  }

  if (loading) return <PageSpinner label="Loading incident details…" />;
  if (error && !incident) return <div className="mt-10"><ErrorState message={error.toString()} onRetry={refresh} /></div>;
  if (!incident) return null;

  const confPct = Math.round(incident.confidence * 100);
  const isHigh = incident.severity === 'high';

  return (
    <div className="flex flex-col gap-6 max-w-[980px] w-full mx-auto">
      
      {/* Breadcrumb */}
      <motion.div 
        initial={{ opacity: 0, x: -5 }} 
        animate={{ opacity: 1, x: 0 }} 
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="mt-1"
      >
        <Link 
          to="/" 
          className="inline-flex items-center gap-1 font-body text-[13px] font-medium text-muted hover:text-primary transition-colors"
        >
          <ChevronLeft size={16} /> Overview
          <span className="mx-1.5 text-border-default">/</span>
          <span className="font-mono font-semibold text-primary uppercase">{incident.id}</span>
        </Link>
      </motion.div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] sm:text-[32px] font-bold tracking-[-0.035em] text-primary mb-2">
            {incidentTypeLabel(incident.incident_type)}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant={incident.status} className="capitalize font-body">{incident.status}</Badge>
            <Badge variant={incident.severity} dot className="capitalize font-body">{incident.severity}</Badge>
          </div>
        </div>
        
        {/* Acknowledge Button */}
        <motion.button
          onClick={handleAck}
          disabled={effectiveAcked || ackLoading}
          whileTap={!effectiveAcked ? { scale: 0.97 } : undefined}
          className={cn(
            "relative flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-sm)] font-body text-[13px] font-medium transition-all overflow-hidden shadow-xs",
            effectiveAcked 
              ? "bg-status-success/10 border border-status-success/20 text-status-success cursor-default" 
              : "bg-brand-primary text-inverse hover:opacity-90 active:scale-[0.98]"
          )}
        >
          {effectiveAcked && (
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <Check size={16} />
            </motion.span>
          )}
          {ackLoading && !effectiveAcked && <Spinner size="sm" className="text-inverse" />}
          {effectiveAcked ? 'Acknowledged' : ackLoading ? 'Processing…' : 'Acknowledge Incident'}
        </motion.button>
      </header>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-1">
        
        {/* Left Column: Properties */}
        <div className="md:col-span-1 flex flex-col gap-6">
          <Card className="p-6 flex flex-col gap-6">
            <div>
              <h3 className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.08em] mb-5">
                Telemetry Metadata
              </h3>
              <div className="flex flex-col gap-5">
                
                <div className="flex items-start gap-3">
                  <MapPin size={15} className="text-muted mt-0.5" />
                  <div>
                    <div className="font-display text-[14px] font-semibold text-primary">{incident.zone}</div>
                    <div className="font-body text-[12px] text-muted">Monitored Zone</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Camera size={15} className="text-muted mt-0.5" />
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-primary uppercase">{incident.camera_id}</div>
                    <div className="font-body text-[12px] text-muted">Origin Camera Stream</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock size={15} className="text-muted mt-0.5" />
                  <div>
                    <div className="font-mono text-[13px] font-medium text-primary">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(incident.detected_at))}
                    </div>
                    <div className="font-body text-[12px] text-muted">Detected At</div>
                  </div>
                </div>

              </div>
            </div>

            <div className="pt-5 border-t border-subtle">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">
                  Inference Confidence
                </h3>
                <span className="font-mono text-[13px] font-bold text-primary tabular-nums">
                  <AnimatedNumber value={confPct} className="font-mono text-[13px] font-bold text-primary tabular-nums" />
                  <span className="text-muted">%</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <motion.div 
                  className={cn("h-full rounded-full", isHigh ? "bg-brand-accent" : "bg-muted")} 
                  initial={{ width: 0 }}
                  animate={{ width: `${confPct}%` }}
                  transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: 0.3 }}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Evidence */}
        <div className="md:col-span-2">
          <Card className="p-2 flex flex-col h-full">
            {incident.evidence_url ? (
              <div className="w-full h-full min-h-[340px] bg-surface-alt rounded-[calc(var(--radius-md)-4px)] overflow-hidden relative border border-subtle">
                <img 
                  src={incident.evidence_url} 
                  alt="Evidence snapshot" 
                  className="w-full h-full object-cover"
                />
                {/* REC overlay */}
                <div className="absolute bottom-3 right-3 glass px-3 py-1 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-primary tracking-wider">REC-FEED</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[340px] bg-surface-alt rounded-[calc(var(--radius-md)-4px)] flex flex-col items-center justify-center text-muted p-8 text-center">
                <ImageOff size={28} className="mb-3 text-disabled" />
                <span className="font-body text-[14px] font-medium text-secondary">No raw frame snapshot recorded</span>
                <span className="font-body text-[12px] text-muted mt-1">Live telemetry bounding coordinates were logged.</span>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
