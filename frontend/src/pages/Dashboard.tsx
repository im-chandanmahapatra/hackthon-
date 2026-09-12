import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, ArrowUpRight, Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';
import { getIncidents, getCameras } from '../api/client';
import type { Incident, Camera } from '../api/types';
import { Card } from '../components/ui/Card';
import { Badge, incidentTypeLabel } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { ActivityChart } from '../components/ui/ActivityChart';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { SpatialVisionViewport } from '../components/dashboard/SpatialVisionViewport';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { MetricTileSkeleton, ViewportSkeleton, ChartSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { cn } from '../components/ui/Badge';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: incidents, error, loading, refresh } = usePolling<Incident[]>(() => getIncidents(), 3000);
  const { data: cameras } = usePolling<Camera[]>(() => getCameras(), 10000);

  const [filterZone, setFilterZone] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Derived Real API Metrics ──
  const stats = useMemo(() => {
    if (!incidents) return null;
    const total = incidents.length;
    const high = incidents.filter(i => i.severity === 'high').length;
    const open = incidents.filter(i => i.status === 'open').length;
    const acked = incidents.filter(i => i.status === 'acknowledged').length;
    const distinctZones = Array.from(new Set(incidents.map(i => i.zone))).length;
    return { total, high, open, acked, distinctZones };
  }, [incidents]);

  // ── Filtered Incident Stream ──
  const filtered = useMemo(() => {
    if (!incidents) return [];
    return incidents.filter(i => {
      if (filterZone !== 'all' && !i.zone.includes(filterZone)) return false;
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (searchQuery && !i.id.toLowerCase().includes(searchQuery.toLowerCase()) && !i.incident_type.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  }, [incidents, filterZone, filterStatus, searchQuery]);

  // ── Real Hourly Activity Distribution Derived from Actual Timestamps ──
  const chartData = useMemo(() => {
    if (!incidents || incidents.length === 0) {
      return [
        { time: '08:00', count: 0 },
        { time: '10:00', count: 0 },
        { time: '12:00', count: 0 },
        { time: '14:00', count: 0 },
        { time: '16:00', count: 0 },
      ];
    }

    // Group incidents by 2-hour slots based on their detected_at timestamps
    const buckets: Record<string, number> = {
      '08:00': 0,
      '10:00': 0,
      '12:00': 0,
      '14:00': 0,
      '16:00': 0,
      '18:00': 0,
    };

    incidents.forEach(inc => {
      const d = new Date(inc.detected_at);
      const hour = d.getHours();
      if (hour < 9) buckets['08:00']++;
      else if (hour < 11) buckets['10:00']++;
      else if (hour < 13) buckets['12:00']++;
      else if (hour < 15) buckets['14:00']++;
      else if (hour < 17) buckets['16:00']++;
      else buckets['18:00']++;
    });

    return Object.entries(buckets).map(([time, count]) => ({ time, count }));
  }, [incidents]);

  // ── Real Zone Compliance Health Derived from Incident Proportions ──
  const zoneHealth = useMemo(() => {
    if (!incidents) return [];
    const zones = ['Zone A', 'Zone B', 'Zone C'];
    return zones.map(zoneName => {
      const zoneIncidents = incidents.filter(i => i.zone.includes(zoneName.split(' ')[1]));
      const zoneHigh = zoneIncidents.filter(i => i.severity === 'high').length;
      const count = zoneIncidents.length;
      const score = count === 0 ? 100 : Math.max(70, Math.round(100 - (zoneHigh * 12 + (count - zoneHigh) * 4)));
      return {
        name: zoneName,
        score,
        incidentCount: count,
        highCount: zoneHigh,
      };
    });
  }, [incidents]);

  // ── Loading Skeleton State (In-place shimmer skeletons, zero full-page blocking spinners) ──
  if (loading && !incidents) {
    return (
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="flex justify-between items-end pb-5 border-b border-subtle">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-48 skeleton rounded-md" />
            <div className="h-4 w-72 skeleton rounded-md" />
          </div>
          <div className="h-7 w-36 skeleton rounded-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <MetricTileSkeleton />
          <MetricTileSkeleton />
          <MetricTileSkeleton />
          <MetricTileSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <ViewportSkeleton />
          </div>
          <div className="lg:col-span-5">
            <ChartSkeleton />
          </div>
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  // ── Error State ──
  if (error && !incidents) {
    return (
      <div className="mt-8">
        <ErrorState message={error.toString()} onRetry={refresh} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      
      {/* ── Focused Page Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-subtle">
        <div>
          <h1 className="font-display text-[28px] sm:text-[32px] font-bold tracking-[-0.035em] leading-tight text-primary">
            Overview
          </h1>
          <p className="font-body text-[13px] sm:text-[14px] text-secondary mt-1 leading-relaxed max-w-xl">
            Spatial safety compliance telemetry, live YOLO inference stream, and violation logs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px] font-semibold text-muted uppercase tracking-[0.08em] px-3 py-1.5 rounded-full bg-surface border border-border-subtle shadow-xs">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </div>
          Live Inference Active
        </div>
      </header>

      {/* ── Real Telemetry Metric Tiles ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[
            { 
              label: 'Total Incidents', 
              value: stats.total, 
              accent: undefined, 
              statusText: 'All detections',
              statusColor: 'bg-surface-alt text-muted',
              icon: Activity,
            },
            { 
              label: 'Open Violations', 
              value: stats.open, 
              accent: 'warning' as const, 
              statusText: stats.open > 0 ? `${stats.open} pending` : 'All clear',
              statusColor: stats.open > 0 ? 'bg-status-warning/10 text-status-warning font-bold' : 'bg-status-success/10 text-status-success',
              icon: ShieldAlert,
            },
            { 
              label: 'High Severity Hazards', 
              value: stats.high, 
              accent: 'danger' as const, 
              statusText: stats.high > 0 ? `${stats.high} critical` : 'Zero high',
              statusColor: stats.high > 0 ? 'bg-status-danger/10 text-status-danger font-bold' : 'bg-surface-alt text-muted',
              icon: ShieldAlert,
            },
            { 
              label: 'Active Monitored Zones', 
              value: stats.distinctZones || 3, 
              accent: undefined, 
              statusText: 'Physical zones',
              statusColor: 'bg-surface-alt text-muted',
              icon: MapPin,
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ 
                type: 'spring', 
                stiffness: 340, 
                damping: 28, 
                delay: i * 0.04 * Math.pow(0.85, i),
              }}
            >
              <Card hoverable accent={stat.accent} className="p-4 sm:p-5 flex flex-col justify-between h-full group relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">
                    {stat.label}
                  </span>
                  <stat.icon size={15} className="text-muted group-hover:text-primary transition-colors" />
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <div className="font-display text-[28px] sm:text-[32px] font-extrabold tracking-[-0.035em] text-primary tabular-nums">
                    <AnimatedNumber value={stat.value} />
                  </div>
                  <span className={cn(
                    "font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    stat.statusColor
                  )}>
                    {stat.statusText}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Balanced 2-Column Bento Matrix (No Clutter, Clean Spatial Focus) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (7 cols): Live Spatial Vision Viewport */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
          >
            <SpatialVisionViewport cameras={cameras} incidents={incidents} onRefresh={refresh} />
          </motion.div>
        </div>

        {/* Right Column (5 cols): Hourly Activity Velocity & Zone Risk Health */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Hourly Incident Velocity Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }} 
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} 
            transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.12 }}
          >
            <Card className="p-0 overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-subtle flex justify-between items-center bg-surface/60">
                <div className="flex items-center gap-2">
                  <Activity size={15} className="text-muted" />
                  <h3 className="font-display text-[14px] font-bold tracking-[-0.015em] text-primary">
                    Hourly Detection Density
                  </h3>
                </div>
                <span className="font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.08em]">
                  Timeline
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <ActivityChart data={chartData} />
              </div>
            </Card>
          </motion.div>

          {/* Real Zone Compliance Breakdown */}
          <motion.div 
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }} 
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} 
            transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.16 }}
          >
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-subtle">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-brand-accent" />
                  <h3 className="font-display text-[14px] font-bold text-primary">
                    Zone Safety Index
                  </h3>
                </div>
                <span className="font-mono text-[10px] font-semibold text-muted uppercase">
                  Connected
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {zoneHealth.map((z) => (
                  <div key={z.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-body text-secondary font-medium">{z.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted">
                          {z.incidentCount} {z.incidentCount === 1 ? 'incident' : 'incidents'}
                        </span>
                        <span className="font-mono font-bold text-primary tabular-nums">{z.score}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-surface-alt rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          z.score >= 95 ? "bg-emerald-500" : z.score >= 85 ? "bg-brand-accent" : "bg-status-warning"
                        )}
                        style={{ width: `${z.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

        </div>

      </div>

      {/* ── Active Incident Stream Feed (with Custom Segmented Controls) ── */}
      <motion.div 
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }} 
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} 
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.2 }}
        className="flex flex-col gap-4 mt-2"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-[20px] font-bold tracking-[-0.025em] text-primary">
              Telemetry Stream Log
            </h2>
            <p className="font-body text-[13px] text-muted mt-0.5">
              Filtered raw detection events across all physical camera nodes.
            </p>
          </div>
          
          {/* Custom Apple-style Segmented Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Zone Filter */}
            <SegmentedControl
              size="sm"
              layoutId="seg-zone"
              value={filterZone}
              onChange={setFilterZone}
              options={[
                { value: 'all', label: 'All Zones' },
                { value: 'Zone A', label: 'Zone A' },
                { value: 'Zone B', label: 'Zone B' },
                { value: 'Zone C', label: 'Zone C' },
              ]}
            />

            {/* Status Filter */}
            <SegmentedControl
              size="sm"
              layoutId="seg-status"
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'all', label: 'All' },
                { value: 'open', label: 'Open' },
                { value: 'acknowledged', label: 'Acked' },
              ]}
            />

            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={13} />
              <input 
                type="text" 
                placeholder="Filter stream..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 h-7.5 font-body text-[12px] bg-surface border border-default text-primary rounded-full focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent transition-shadow w-36 placeholder:text-muted"
              />
            </div>
          </div>
        </div>

        {/* Tabular Feed Card */}
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-14 text-center flex flex-col items-center justify-center gap-2">
              <CheckCircle2 size={32} className="text-muted/40 mb-1" />
              <p className="font-display text-[14px] font-bold text-primary">
                No detections matching filters
              </p>
              <p className="font-body text-[12px] text-muted max-w-xs leading-relaxed">
                Adjust zone or status filters above, or upload new video footage to run spatial inference.
              </p>
              <button
                type="button"
                onClick={() => { setFilterZone('all'); setFilterStatus('all'); setSearchQuery(''); }}
                className="mt-2 px-3 py-1 rounded-full font-body text-[11px] font-semibold bg-surface border border-default hover:bg-surface-hover transition-colors text-primary cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              <AnimatePresence initial={false}>
                {filtered.map((inc) => {
                  const isHigh = inc.severity === 'high';
                  const confPct = Math.round(inc.confidence * 100);
                  
                  return (
                    <motion.div
                      key={inc.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      onClick={() => navigate(`/incidents/${inc.id}`)}
                      className="group flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-surface-hover/80 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        {/* Severity Dot */}
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0", 
                          isHigh ? "bg-status-danger" : "bg-status-warning"
                        )} />
                        
                        <div className="w-[140px] sm:w-[160px] shrink-0">
                          <div className="font-display text-[13px] font-semibold text-primary truncate">
                            {incidentTypeLabel(inc.incident_type)}
                          </div>
                          <div className="font-mono text-[10px] font-medium text-muted uppercase mt-0.5">
                            {inc.id}
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-1.5 w-[140px] shrink-0 font-body text-[12px] text-secondary truncate">
                          <MapPin size={12} className="text-muted shrink-0" />
                          <span className="truncate">{inc.zone}</span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 w-[100px] sm:w-[120px] shrink-0">
                          <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all duration-700", isHigh ? "bg-brand-accent" : "bg-muted")} 
                              style={{ width: `${confPct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-muted">{confPct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-5 shrink-0 pl-2 sm:pl-4">
                        <Badge variant={inc.status} className="capitalize font-body text-[11px]">
                          {inc.status}
                        </Badge>
                        
                        <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-muted w-[70px] justify-end">
                          <Clock size={11} />
                          {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(inc.detected_at))}
                        </div>

                        <div className="w-4 flex justify-end text-muted group-hover:text-primary transition-colors">
                          <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
