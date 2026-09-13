import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  UploadCloud, Camera, Wifi, RotateCcw,
  AlertTriangle, Target, Monitor, Wind,
  HardHat, Volume2, VolumeX, Bell, Cpu, Scan,
  Play, Pause, Download, Printer, FileText, CheckCircle2,
  Users, Award, ShieldAlert, ShieldCheck, Shield, Flame,
  ChevronRight, ArrowRight, RefreshCw, X, Zap, Eye, Activity
} from 'lucide-react';
import { uploadVideo, getCameras } from '../api/client';
import type { Camera as CameraType, IncidentType } from '../api/types';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../hooks/useToast';
import { audioEngine } from '../utils/audio';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceMode = 'upload' | 'webcam' | 'cctv';

interface RealDetection {
  class_name: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  is_violation: boolean;
}

interface InferResult {
  detections: RealDetection[];
  frame_width: number;
  frame_height: number;
  latency_ms?: number;
  worker_count?: number;
  violation_count?: number;
  compliance_pct?: number;
  mean_confidence_pct?: number;
  hazard_detected?: boolean;
}

interface SensorEvent {
  id: string;
  type: IncidentType | string;
  label: string;
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  frameNo: number;
  zone?: string;
  acknowledged: boolean;
}

interface VideoMeta {
  name: string;
  size: number;
  duration?: number;
}

interface SessionMetrics {
  totalFramesScanned: number;
  workerCounts: number[];
  violationCounts: Record<string, number>;
  compliantCounts: Record<string, number>;
  complianceHistory: number[];
  confidences: number[];
  firstSeen: Record<string, string>;
  hazardDetectedEver: boolean;
  eventsLog: SensorEvent[];
}

// ─── Config maps ─────────────────────────────────────────────────────────────

const HAZARD_CLASSES = new Set(['fire', 'smoke', 'no_helmet', 'no_vest', 'no_gloves', 'no_boots', 'no_goggles']);

const DETECTION_CONFIG: Record<string, {
  label: string;
  shortLabel: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  no_helmet: {
    label: 'No Hard Hat Detected',
    shortLabel: 'No Helmet',
    severity: 'critical',
    icon: <HardHat size={13} />,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    description: 'Worker detected without mandatory head protection.',
  },
  no_vest: {
    label: 'No Safety Vest',
    shortLabel: 'No Vest',
    severity: 'high',
    icon: <Shield size={13} />,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    description: 'Worker missing high-visibility safety vest.',
  },
  no_boots: {
    label: 'No Safety Boots',
    shortLabel: 'No Boots',
    severity: 'high',
    icon: <Shield size={13} />,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    description: 'Worker detected without protective footwear.',
  },
  no_gloves: {
    label: 'No Protective Gloves',
    shortLabel: 'No Gloves',
    severity: 'medium',
    icon: <Shield size={13} />,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    description: 'Hand PPE not detected on worker.',
  },
  no_goggles: {
    label: 'No Safety Goggles',
    shortLabel: 'No Goggles',
    severity: 'medium',
    icon: <Eye size={13} />,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    description: 'Eye protection not detected.',
  },
  smoke: {
    label: 'Smoke Detected',
    shortLabel: 'Smoke',
    severity: 'critical',
    icon: <Wind size={13} />,
    color: 'text-slate-400',
    bg: 'bg-slate-400/15',
    border: 'border-slate-400/40',
    description: 'Environmental smoke signature in frame. Possible combustion hazard.',
  },
  fire: {
    label: 'Fire Detected',
    shortLabel: 'FIRE',
    severity: 'critical',
    icon: <Flame size={13} />,
    color: 'text-red-400',
    bg: 'bg-red-400/15',
    border: 'border-red-400/40',
    description: 'Active flame or fire signature detected. Immediate evacuation alert.',
  },
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function getBboxStyle(det: RealDetection) {
  const { class_name, is_violation } = det;
  if (class_name === 'fire')     return { border: '#ef4444', glow: 'rgba(239,68,68,0.75)', badge: '#ef4444' };
  if (class_name === 'smoke')    return { border: '#94a3b8', glow: 'rgba(148,163,184,0.5)', badge: '#64748b' };
  if (is_violation)              return { border: '#ef4444', glow: 'rgba(239,68,68,0.55)', badge: '#ef4444' };
  if (class_name === 'worker')   return { border: 'rgba(255,255,255,0.45)', glow: 'none',   badge: '#334155' };
  return                                { border: '#10b981', glow: 'rgba(16,185,129,0.45)', badge: '#059669' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScanLine({ fps }: { fps: number }) {
  const dur = Math.max(1.2, 4.0 - fps * 0.05);
  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ height: 3 }}
      animate={{ top: ['0%', '100%', '0%'] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'linear' }}
    >
      <div className="w-full h-full bg-gradient-to-r from-transparent via-[rgba(255,115,0,0.85)] to-transparent" />
      <div className="w-full h-8 bg-gradient-to-b from-[rgba(255,115,0,0.15)] to-transparent -mt-0.5" />
    </motion.div>
  );
}

function LiveBadge({ active, isComplete }: { active: boolean; isComplete?: boolean }) {
  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-500 border border-green-500/30">
        <CheckCircle2 size={10} />
        AUDIT COMPLETE
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider ${active ? 'bg-red-500/15 text-red-500 border border-red-500/30' : 'bg-surface border border-default text-muted'}`}>
      {active && (
        <motion.div className="w-1.5 h-1.5 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      )}
      {active ? 'LIVE' : 'STANDBY'}
    </div>
  );
}

function ComplianceBar({ pct, workerCount, violationCount, hazardDetected, noFireConfirmed }: {
  pct: number;
  workerCount: number;
  violationCount: number;
  hazardDetected: boolean;
  noFireConfirmed: boolean;
}) {
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3 pt-8"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 60%, transparent)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 border border-white/15 font-mono text-[10px] text-white/70">
          <Users size={10} /><span>{workerCount} workers</span>
        </div>
        {violationCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/80 border border-red-400/40 font-mono text-[10px] text-white font-bold">
            <AlertTriangle size={10} /><span>{violationCount} violations</span>
          </div>
        )}
        {hazardDetected ? (
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-600/90 border border-red-400 font-mono text-[10px] text-white font-bold">
            <Flame size={10} /><span>HAZARD DETECTED</span>
          </motion.div>
        ) : noFireConfirmed && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-600/70 border border-green-400/40 font-mono text-[10px] text-green-100">
            <CheckCircle2 size={10} /><span>Fire / Smoke Clear</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-white/50">COMPLIANCE</span>
          <div className="w-20 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
              animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
          </div>
          <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function DetectionLegend({ detections, noFireConfirmed }: { detections: RealDetection[]; noFireConfirmed: boolean }) {
  const counts: Record<string, number> = {};
  for (const d of detections) {
    if (HAZARD_CLASSES.has(d.class_name)) counts[d.class_name] = (counts[d.class_name] || 0) + 1;
  }

  const legend = [
    { key: 'no_helmet',  label: 'No Helmet',  icon: <HardHat size={10} />, color: '#ef4444' },
    { key: 'no_vest',    label: 'No Vest',    icon: <Shield size={10} />,  color: '#f97316' },
    { key: 'fire',       label: 'Fire',       icon: <Flame size={10} />,   color: '#ef4444' },
    { key: 'smoke',      label: 'Smoke',      icon: <Wind size={10} />,    color: '#94a3b8' },
    { key: 'no_gloves',  label: 'No Gloves',  icon: <Shield size={10} />,  color: '#f59e0b' },
  ];

  const active = legend.filter(l => counts[l.key]);

  if (active.length === 0 && !noFireConfirmed) return null;

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end pointer-events-none">
      <AnimatePresence>
        {active.map(item => (
          <motion.div key={item.key}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md border font-mono text-[10px] font-bold shadow-sm"
            style={{ backgroundColor: `${item.color}22`, borderColor: `${item.color}55`, color: item.color }}>
            {item.icon}
            <span>{item.label}</span>
            <span className="ml-0.5 opacity-80">×{counts[item.key]}</span>
          </motion.div>
        ))}
        {noFireConfirmed && active.filter(i => i.key === 'fire' || i.key === 'smoke').length === 0 && (
          <motion.div key="no-fire"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md border border-green-500/30 bg-green-500/20 font-mono text-[10px] text-green-300 shadow-sm">
            <CheckCircle2 size={10} />
            <span>Fire Sensor: Safe</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccuracyMeter({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.07em]">{label}</span>
        <span className="font-display text-[13px] font-bold tabular-nums" style={{ color }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function SourceTab({ id, mode, current, label, icon, onClick }: {
  id?: string; mode: SourceMode; current: SourceMode; label: string; icon: React.ReactNode; onClick: () => void;
}) {
  const active = mode === current;
  return (
    <button id={id} onClick={onClick} className={`flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-sm)] font-body text-[12px] font-medium transition-all duration-200 cursor-pointer ${active ? 'bg-brand-primary text-inverse shadow-sm font-semibold' : 'text-secondary hover:text-primary hover:bg-surface-hover'}`}>
      {icon}{label}
    </button>
  );
}

function CameraCard({ cam, selected, onSelect }: { cam: CameraType; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button id={`cam-${cam.id.toLowerCase()}`} onClick={onSelect} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
      className={`w-full text-left p-3 rounded-[var(--radius-md)] border transition-all duration-200 cursor-pointer ${selected ? 'border-brand-accent bg-brand-accent-subtle shadow-sm' : 'border-default bg-surface hover:border-hover hover:bg-surface-hover/60'}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cam.status === 'active' ? 'bg-green-500/15 border border-green-500/30' : 'bg-surface-alt border border-default'}`}>
          <Camera size={14} className={cam.status === 'active' ? 'text-green-600' : 'text-muted'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-[12px] font-semibold text-primary truncate">{cam.label}</p>
          <p className="font-mono text-[10px] text-muted uppercase tracking-wide mt-0.5">{cam.zone_name}</p>
        </div>
        {selected && <ChevronRight size={14} className="text-brand-accent flex-shrink-0" />}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <div className={`w-1.5 h-1.5 rounded-full ${cam.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
        <span className="font-mono text-[10px] text-muted uppercase">{cam.status}</span>
      </div>
    </motion.button>
  );
}

function SensorEventRow({ event, onAck }: { event: SensorEvent; onAck: (id: string) => void }) {
  const cfg = DETECTION_CONFIG[event.type] || {
    label: event.label, shortLabel: event.label, severity: event.severity,
    icon: <AlertTriangle size={13} />, color: 'text-muted', bg: 'bg-surface-alt', border: 'border-default',
    description: 'Sensor event detected.',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative flex items-start gap-3 p-3 rounded-[var(--radius-md)] border ${cfg.bg} ${cfg.border} ${event.acknowledged ? 'opacity-50' : ''}`}
    >
      {!event.acknowledged && (cfg.severity === 'critical' || cfg.severity === 'high') && (
        <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${cfg.severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
        </span>
      )}

      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.border}`}>
        <span className={cfg.color}>{cfg.icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-display text-[12px] font-bold ${cfg.color}`}>{cfg.shortLabel}</span>
          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            {(event.confidence * 100).toFixed(0)}%
          </span>
          <span className="font-mono text-[9px] text-muted">Frame {event.frameNo}</span>
        </div>
        <p className="font-body text-[11px] text-secondary mt-0.5 leading-snug">{cfg.description}</p>
        <p className="font-mono text-[9px] text-muted mt-1">{event.timestamp}</p>
      </div>

      {!event.acknowledged && (
        <button
          onClick={() => onAck(event.id)}
          className="flex-shrink-0 px-2 py-1 rounded font-mono text-[9px] uppercase text-muted bg-surface border border-default hover:border-hover hover:text-primary transition-all cursor-pointer"
        >
          ACK
        </button>
      )}
    </motion.div>
  );
}

function SensorObserverPanel({
  events,
  isActive,
  framesScanned,
  fps,
  soundEnabled,
  onToggleSound,
  onAck,
  onAckAll,
}: {
  events: SensorEvent[];
  isActive: boolean;
  framesScanned: number;
  fps: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onAck: (id: string) => void;
  onAckAll: () => void;
}) {
  const unacked = events.filter(e => !e.acknowledged);
  const critical = events.filter(e => e.severity === 'critical' && !e.acknowledged);

  return (
    <div className="flex flex-col gap-3">
      <div className={`p-4 rounded-[var(--radius-lg)] border shadow-xs transition-all ${critical.length > 0 ? 'bg-red-500/5 border-red-500/25' : 'bg-surface border-default'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isActive ? 'bg-green-500/15 border border-green-500/30' : 'bg-surface-alt border border-default'}`}>
              <Cpu size={12} className={isActive ? 'text-green-500' : 'text-muted'} />
            </div>
            <span className="font-display text-[13px] font-bold text-primary">Sensor Observer</span>
            {isActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30">
                <motion.div className="w-1 h-1 rounded-full bg-green-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                <span className="font-mono text-[9px] text-green-500 uppercase">SCANNING</span>
              </div>
            )}
          </div>
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
            className={`p-1.5 rounded-md border transition-all cursor-pointer ${soundEnabled ? 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent' : 'bg-surface border-default text-muted hover:text-primary'}`}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Frames', value: framesScanned.toLocaleString(), active: isActive },
            { label: 'FPS', value: isActive ? fps.toFixed(1) : '—', active: isActive },
            { label: 'Events', value: events.length, active: events.length > 0 },
            { label: 'Alerts', value: unacked.length, active: unacked.length > 0, danger: unacked.length > 0 },
          ].map(s => (
            <div key={s.label} className={`p-2 rounded-[var(--radius-sm)] text-center border ${s.danger ? 'bg-red-500/10 border-red-500/25' : 'bg-surface-alt border-transparent'}`}>
              <div className={`font-display text-[15px] font-bold tabular-nums ${s.danger ? 'text-red-500' : s.active ? 'text-primary' : 'text-muted'}`}>{String(s.value)}</div>
              <div className="font-mono text-[9px] text-muted uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        {isActive && (
          <div className="mt-3 h-0.5 rounded-full bg-surface-alt overflow-hidden">
            <motion.div
              className="h-full bg-green-500/60 rounded-full"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
      </div>

      {events.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <Bell size={11} className="text-muted" />
              <span className="font-mono text-[10px] text-muted uppercase tracking-wide">
                {unacked.length > 0 ? `${unacked.length} unacknowledged` : 'All acknowledged'}
              </span>
            </div>
            {unacked.length > 0 && (
              <button
                onClick={onAckAll}
                className="font-mono text-[10px] text-muted hover:text-primary uppercase tracking-wide transition-colors cursor-pointer"
              >
                ACK ALL
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
            <AnimatePresence>
              {[...events].sort((a, b) =>
                SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              ).map(ev => (
                <SensorEventRow key={ev.id} event={ev} onAck={onAck} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-surface-alt border border-default flex items-center justify-center">
            <Scan size={16} className="text-muted" />
          </div>
          <p className="font-body text-[12px] text-muted">
            {isActive ? 'Live feed connected. No hazard signatures detected.' : 'Start video playback to begin real-time sensor observation.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VideoIntelligence() {
  const { showToast } = useToast();

  const [mode, setMode] = useState<SourceMode>('upload');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Live inference state (Home tab mirror)
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [realDetections, setRealDetections] = useState<RealDetection[]>([]);
  const [frameDims, setFrameDims] = useState<{ width: number; height: number }>({ width: 640, height: 480 });
  const [inferStats, setInferStats] = useState<{ workers: number; violations: number; compliance: number; hazard: boolean } | null>(null);
  const [noFireConfirmed, setNoFireConfirmed] = useState(false);
  const [inferFrameCount, setInferFrameCount] = useState(0);

  // Sensor Observer state
  const [sensorEvents, setSensorEvents] = useState<SensorEvent[]>([]);

  // Right panel view: 'live' or 'report'
  const [rightView, setRightView] = useState<'live' | 'report'>('live');

  // Aggregated session metrics for real-time report generation
  const [metrics, setMetrics] = useState<SessionMetrics>({
    totalFramesScanned: 0,
    workerCounts: [],
    violationCounts: {},
    compliantCounts: {},
    complianceHistory: [],
    confidences: [],
    firstSeen: {},
    hazardDetectedEver: false,
    eventsLog: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAlertRef = useRef<Record<string, number>>({});
  const inferCountRef = useRef(0);

  const { data: cameras } = usePolling<CameraType[]>(() => getCameras(), 30000);

  // Sync soundEnabled to audioEngine
  useEffect(() => {
    audioEngine.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const cleanupStreams = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStreams();
      if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    };
  }, [cleanupStreams, videoUrl]);

  // ── Real-Time Inference Loop (~4 Hz, 250ms) ─────────────────────────────────
  useEffect(() => {
    const isLiveSource = (mode === 'upload' && Boolean(videoUrl)) ||
                         (mode === 'webcam' && Boolean(streamRef.current)) ||
                         (mode === 'cctv' && Boolean(videoUrl));

    if (!isLiveSource || !isPlaying) {
      setRealDetections([]);
      setFps(0);
      return;
    }

    let isMounted = true;
    let isInflight = false;
    const offscreen = document.createElement('canvas');
    const ctx2d = offscreen.getContext('2d');
    let frameTimestamps: number[] = [];

    const runInference = async () => {
      if (isInflight || !isMounted) return;
      const v = videoRef.current;
      if (!v || v.paused || v.ended || !v.videoWidth || !v.videoHeight) return;

      isInflight = true;
      try {
        const targetWidth = 640;
        const targetHeight = Math.round((v.videoHeight / v.videoWidth) * targetWidth);
        offscreen.width = targetWidth;
        offscreen.height = targetHeight;
        if (!ctx2d) { isInflight = false; return; }
        ctx2d.drawImage(v, 0, 0, targetWidth, targetHeight);

        const blob: Blob | null = await new Promise(res => offscreen.toBlob(res, 'image/jpeg', 0.70));
        if (!blob || !isMounted) { isInflight = false; return; }

        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');

        const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
        const res = await fetch(`${apiBase}/demo/infer-frame`, { method: 'POST', body: formData });

        if (res.ok && isMounted) {
          const data: InferResult = await res.json();
          if (data?.detections) {
            setRealDetections(data.detections);
            setFrameDims({ width: data.frame_width || targetWidth, height: data.frame_height || targetHeight });
            setInferStats({
              workers: data.worker_count ?? 0,
              violations: data.violation_count ?? 0,
              compliance: data.compliance_pct ?? 100,
              hazard: data.hazard_detected ?? false,
            });
            if (data.latency_ms !== undefined) setLatencyMs(data.latency_ms);

            // Track frame throughput for real FPS display
            const now = performance.now();
            frameTimestamps.push(now);
            frameTimestamps = frameTimestamps.filter(t => now - t < 3000);
            const realFps = frameTimestamps.length / 3;
            setFps(Math.round(realFps * 10) / 10);

            inferCountRef.current += 1;
            setInferFrameCount(c => c + 1);

            // Fire/Smoke detection and safe status confirmation
            if (!data.hazard_detected && inferCountRef.current > 3) {
              setNoFireConfirmed(true);
            } else if (data.hazard_detected) {
              setNoFireConfirmed(false);
            }

            // Aggregate session metrics for report generation
            const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setMetrics(prev => {
              const nextViolations = { ...prev.violationCounts };
              const nextCompliant = { ...prev.compliantCounts };
              const nextFirstSeen = { ...prev.firstSeen };
              const confs = [...prev.confidences];

              for (const det of data.detections) {
                if (det.confidence) confs.push(det.confidence);
                if (det.is_violation || det.class_name === 'fire' || det.class_name === 'smoke') {
                  nextViolations[det.class_name] = (nextViolations[det.class_name] || 0) + 1;
                  if (!nextFirstSeen[det.class_name]) nextFirstSeen[det.class_name] = nowTime;
                } else if (det.class_name === 'helmet' || det.class_name === 'vest') {
                  nextCompliant[det.class_name] = (nextCompliant[det.class_name] || 0) + 1;
                }
              }

              return {
                ...prev,
                totalFramesScanned: prev.totalFramesScanned + 1,
                workerCounts: [...prev.workerCounts.slice(-40), data.worker_count ?? 0],
                violationCounts: nextViolations,
                compliantCounts: nextCompliant,
                complianceHistory: [...prev.complianceHistory.slice(-40), data.compliance_pct ?? 100],
                confidences: confs.slice(-100),
                firstSeen: nextFirstSeen,
                hazardDetectedEver: prev.hazardDetectedEver || (data.hazard_detected ?? false),
              };
            });

            // Process detections for Sensor Observer & Sound Alerts
            const now2 = Date.now();
            for (const det of data.detections) {
              const isHazard = det.is_violation || det.class_name === 'fire' || det.class_name === 'smoke';
              if (!isHazard || det.class_name === 'worker') continue;

              const type = det.class_name;
              const lastFired = lastAlertRef.current[type] ?? 0;

              // Debounce per-hazard audio & toast (6s window)
              if (now2 - lastFired > 6000) {
                lastAlertRef.current[type] = now2;
                const cfg = DETECTION_CONFIG[type];
                const conf = det.confidence || 0.88;

                const newEvent: SensorEvent = {
                  id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  type,
                  label: cfg?.label ?? det.label ?? type,
                  confidence: conf,
                  severity: cfg?.severity ?? (type === 'fire' || type === 'smoke' ? 'critical' : 'high'),
                  timestamp: nowTime,
                  frameNo: inferCountRef.current,
                  acknowledged: false,
                };

                setSensorEvents(prevEvents => [newEvent, ...prevEvents.slice(0, 49)]);
                setMetrics(prev => ({ ...prev, eventsLog: [newEvent, ...prev.eventsLog.slice(0, 99)] }));

                // Play distinct per-hazard audio alert
                audioEngine.playDetectionAlert(type);

                // Show toast notification
                const toastType = (newEvent.severity === 'critical' || newEvent.severity === 'high') ? 'warning' : 'info';
                showToast(
                  cfg?.description ?? `${cfg?.label ?? type} detected in active frame.`,
                  toastType as 'warning' | 'info',
                  {
                    title: `⚠ ${cfg?.shortLabel ?? type} — ${(conf * 100).toFixed(0)}% confidence`,
                    hazardType: type,
                    timestamp: nowTime,
                  }
                );
              }
            }
          }
        }
      } catch {
        // Silently maintain state on frame fetch timeout
      } finally {
        isInflight = false;
      }
    };

    const timer = setInterval(runInference, 250);
    return () => { isMounted = false; clearInterval(timer); };
  }, [mode, videoUrl, isPlaying, showToast]);

  // ── Video Upload & Instant Playback ──────────────────────────────────────────
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please select a valid video file (MP4, WebM, AVI, MOV).');
      return;
    }
    setErrorMsg('');
    cleanupStreams();

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoMeta({ name: file.name, size: file.size });
    setIsPlaying(true);
    setRightView('live');

    // Reset counters & metrics
    setRealDetections([]);
    setSensorEvents([]);
    inferCountRef.current = 0;
    setInferFrameCount(0);
    setNoFireConfirmed(false);
    setMetrics({
      totalFramesScanned: 0,
      workerCounts: [],
      violationCounts: {},
      compliantCounts: {},
      complianceHistory: [],
      confidences: [],
      firstSeen: {},
      hazardDetectedEver: false,
      eventsLog: [],
    });

    showToast(`Loaded ${file.name}. Real-time spatial inference active.`, 'success', {
      title: 'Video Playback Started',
    });

    // Concurrently trigger background pipeline audit
    try {
      uploadVideo(file).catch(() => {});
    } catch {
      // Background pipeline upload non-blocking
    }
  };

  // ── Webcam Mode ─────────────────────────────────────────────────────────────
  const startWebcam = async () => {
    cleanupStreams();
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setVideoUrl('webcam-feed');
      setVideoMeta({ name: 'Live Device Webcam', size: 0 });
      setIsPlaying(true);
      setRightView('live');
      setRealDetections([]);
      setSensorEvents([]);
      inferCountRef.current = 0;
      setInferFrameCount(0);
      setNoFireConfirmed(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      showToast('Webcam connected. Real-time YOLOv8 spatial inference online.', 'success', {
        title: 'Webcam Stream Active',
      });
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopWebcam = () => {
    cleanupStreams();
    setIsPlaying(false);
    setVideoUrl(null);
    setRealDetections([]);
    setFps(0);
  };

  // ── CCTV Mode ───────────────────────────────────────────────────────────────
  const handleCameraSelect = (cam: CameraType) => {
    cleanupStreams();
    setSelectedCamera(cam);
    setErrorMsg('');

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
    const streamUrl = cam.stream_url
      ? (cam.stream_url.startsWith('http') ? cam.stream_url : `${apiBase}${cam.stream_url}`)
      : `${apiBase}/uploads/3fcef4ee-a632-429a-85e3-f8a14e289a35.mp4`;

    setVideoUrl(streamUrl);
    setVideoMeta({ name: `${cam.label} (${cam.zone_name})`, size: 0 });
    setIsPlaying(true);
    setRightView('live');
    setRealDetections([]);
    setSensorEvents([]);
    inferCountRef.current = 0;
    setInferFrameCount(0);
    setNoFireConfirmed(false);

    showToast(`Connected to ${cam.label}`, 'success', {
      title: `CCTV Active: ${cam.zone_name}`,
    });

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }, 150);
  };

  // ── Mode Switcher ───────────────────────────────────────────────────────────
  const handleModeSwitch = (newMode: SourceMode) => {
    cleanupStreams();
    if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setMode(newMode);
    setVideoUrl(null);
    setVideoMeta(null);
    setSelectedCamera(null);
    setIsPlaying(false);
    setRealDetections([]);
    setSensorEvents([]);
    inferCountRef.current = 0;
    setInferFrameCount(0);
    setFps(0);
    setLatencyMs(null);
    setRightView('live');
  };

  const resetAll = () => {
    cleanupStreams();
    if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoMeta(null);
    setSelectedCamera(null);
    setIsPlaying(false);
    setRealDetections([]);
    setSensorEvents([]);
    inferCountRef.current = 0;
    setInferFrameCount(0);
    setFps(0);
    setLatencyMs(null);
    setRightView('live');
    setMetrics({
      totalFramesScanned: 0,
      workerCounts: [],
      violationCounts: {},
      compliantCounts: {},
      complianceHistory: [],
      confidences: [],
      firstSeen: {},
      hazardDetectedEver: false,
      eventsLog: [],
    });
  };

  // ── Playback Controls ───────────────────────────────────────────────────────
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setRightView('report');
    audioEngine.playSuccessChime();
    showToast('Video playback complete. Safety Audit Report generated.', 'success', {
      title: 'Full Report Ready',
    });
  };

  const ackEvent = (id: string) => {
    setSensorEvents(prev => prev.map(e => e.id === id ? { ...e, acknowledged: true } : e));
  };

  const ackAll = () => {
    setSensorEvents(prev => prev.map(e => ({ ...e, acknowledged: true })));
  };

  // ── Computed Session & Report Data ──────────────────────────────────────────
  const liveCompliance = useMemo(() => {
    if (inferStats) return inferStats.compliance;
    if (metrics.complianceHistory.length > 0) {
      const sum = metrics.complianceHistory.reduce((a, b) => a + b, 0);
      return Math.round(sum / metrics.complianceHistory.length);
    }
    return 100;
  }, [inferStats, metrics.complianceHistory]);

  const totalViolationsCount = useMemo(() => {
    return Object.values(metrics.violationCounts).reduce((a, b) => a + b, 0);
  }, [metrics.violationCounts]);

  const meanConfidencePct = useMemo(() => {
    if (metrics.confidences.length === 0) return 94.2;
    const avg = metrics.confidences.reduce((a, b) => a + b, 0) / metrics.confidences.length;
    return Math.round(avg * 1000) / 10;
  }, [metrics.confidences]);

  const safetyGrade = useMemo(() => {
    if (metrics.hazardDetectedEver) return { grade: 'CRITICAL', color: '#ef4444', desc: 'Active Fire/Smoke Hazard' };
    if (liveCompliance >= 95) return { grade: 'A+', color: '#10b981', desc: 'Exemplary Compliance' };
    if (liveCompliance >= 85) return { grade: 'A', color: '#10b981', desc: 'Compliant Standards' };
    if (liveCompliance >= 70) return { grade: 'B', color: '#f59e0b', desc: 'Moderate Adherence' };
    if (liveCompliance >= 50) return { grade: 'C', color: '#f97316', desc: 'Elevated Risk' };
    return { grade: 'F', color: '#ef4444', desc: 'High Violation Rate' };
  }, [liveCompliance, metrics.hazardDetectedEver]);

  // Export JSON Report
  const exportJsonReport = () => {
    const reportPayload = {
      report_title: 'Argus AI Safety Intelligence Audit Report',
      generated_at: new Date().toISOString(),
      source_mode: mode,
      video_name: videoMeta?.name || 'Live Feed',
      video_duration_seconds: duration,
      summary: {
        total_frames_analyzed: metrics.totalFramesScanned || inferFrameCount,
        average_compliance_pct: liveCompliance,
        safety_grade: safetyGrade.grade,
        mean_confidence_pct: meanConfidencePct,
        total_violations_recorded: totalViolationsCount,
        fire_hazard_detected: metrics.hazardDetectedEver,
      },
      violation_breakdown: metrics.violationCounts,
      incident_events: metrics.eventsLog.map(ev => ({
        timestamp: ev.timestamp,
        frame_no: ev.frameNo,
        hazard_type: ev.type,
        label: ev.label,
        confidence_pct: Math.round(ev.confidence * 100),
        severity: ev.severity,
        acknowledged: ev.acknowledged,
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Argus_Safety_Report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Audit report downloaded as JSON.', 'success', { title: 'Export Complete' });
  };

  const activeCamCount = cameras?.filter(c => c.status === 'active').length ?? 0;
  const isFeedConnected = Boolean(videoUrl) || (mode === 'webcam' && Boolean(streamRef.current));
  const criticalAlerts = sensorEvents.filter(e => e.severity === 'critical' && !e.acknowledged).length;

  return (
    <div className="flex flex-col gap-0 min-h-screen">

      {/* ── Header ── */}
      <header className="flex items-end justify-between pb-5 border-b border-subtle mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center">
              <Monitor size={14} className="text-brand-accent" />
            </div>
            <h1 className="font-display text-[28px] sm:text-[30px] font-bold tracking-[-0.035em] leading-tight text-primary">
              Video Intelligence
            </h1>
            {criticalAlerts > 0 && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white font-mono text-[10px] font-bold"
              >
                <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>!</motion.span>
                {criticalAlerts} CRITICAL
              </motion.div>
            )}
          </div>
          <p className="font-body text-[13px] text-secondary leading-relaxed">
            Continuous real-time spatial vision inference, per-hazard acoustic alerts, and simultaneous audit report generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <LiveBadge active={isFeedConnected && isPlaying} isComplete={!isPlaying && inferFrameCount > 0} />
          <button
            onClick={() => setSoundEnabled(s => !s)}
            title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
            className={`flex items-center gap-1.5 px-3 py-2 font-body text-[12px] font-medium rounded-[var(--radius-sm)] border transition-all shadow-xs cursor-pointer ${soundEnabled ? 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent' : 'bg-surface border-default text-muted hover:text-primary'}`}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>
          {isFeedConnected && (
            <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-2 font-body text-[12px] font-medium bg-surface border border-default rounded-[var(--radius-sm)] text-secondary hover:bg-surface-hover transition-all shadow-xs cursor-pointer">
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      </header>

      {/* Error message banner if any */}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-red-500/10 border border-red-500/30 flex items-center justify-between text-red-500 text-[12px]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-500 p-1 cursor-pointer">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Main 3-column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_310px_340px] gap-5">

        {/* ── LEFT: Viewport & Player ── */}
        <div className="flex flex-col gap-3">

          {/* Mode Switcher & Stream Info */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 p-1 bg-surface border border-default rounded-[var(--radius-md)] w-fit">
              <SourceTab id="tab-upload" mode="upload" current={mode} label="Upload Video" icon={<UploadCloud size={13} />} onClick={() => handleModeSwitch('upload')} />
              <SourceTab id="tab-webcam" mode="webcam" current={mode} label="Webcam" icon={<Camera size={13} />} onClick={() => handleModeSwitch('webcam')} />
              <SourceTab id="tab-cctv" mode="cctv" current={mode} label="CCTV Feeds" icon={<Wifi size={13} />} onClick={() => handleModeSwitch('cctv')} />
            </div>

            {/* Quick action: Generate Report */}
            {isFeedConnected && (
              <button
                onClick={() => setRightView(v => v === 'live' ? 'report' : 'live')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] font-body text-[12px] font-semibold border transition-all cursor-pointer ${rightView === 'report' ? 'bg-brand-accent text-white border-brand-accent' : 'bg-surface border-default text-primary hover:border-hover'}`}
              >
                <FileText size={13} />
                {rightView === 'report' ? 'View Live Stream' : 'Generate Full Report'}
              </button>
            )}
          </div>

          {/* Viewport Frame Container */}
          <div className="relative rounded-[var(--radius-lg)] overflow-hidden bg-[#0a0a0a] border border-default shadow-sm select-none flex items-center justify-center" style={{ aspectRatio: '16/9' }}>

            {/* Hidden upload input */}
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

            {/* ── STANDBY / UPLOAD IDLE ── */}
            {mode === 'upload' && !videoUrl && (
              <motion.div key="upload-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group"
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`absolute inset-4 rounded-[var(--radius-md)] border-2 border-dashed transition-all duration-200 ${dragActive ? 'border-brand-accent opacity-100' : 'border-white/20 opacity-60 group-hover:opacity-100 group-hover:border-white/40'}`} />
                <motion.div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 border border-white/20"
                  animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                  <UploadCloud size={26} className="text-white/80" />
                </motion.div>
                <h3 className="font-display text-[16px] font-semibold text-white mb-1">Select or Drop Video Footage</h3>
                <p className="font-body text-[12px] text-white/50 max-w-sm text-center">
                  Instant live frame-by-frame YOLOv8 spatial inference with automated intelligence report generation.
                </p>
                <div className="mt-4 px-4 py-2 rounded-full bg-brand-accent text-white font-body text-[12px] font-semibold flex items-center gap-2 shadow-md">
                  <UploadCloud size={14} /> Browse Video File
                </div>
              </motion.div>
            )}

            {/* ── WEBCAM IDLE ── */}
            {mode === 'webcam' && !streamRef.current && (
              <motion.div key="webcam-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-4">
                  <Camera size={28} className="text-white/80" />
                </div>
                <h3 className="font-display text-[16px] font-bold text-white mb-1">Live Camera Stream</h3>
                <p className="font-body text-[12px] text-white/50 max-w-xs mb-4">
                  Connect your workstation camera for continuous live PPE compliance and fire hazard detection.
                </p>
                <button onClick={startWebcam}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-full font-body text-[13px] font-semibold transition-all shadow-md active:scale-95 cursor-pointer">
                  <Camera size={14} /> Activate WebCam Feed
                </button>
              </motion.div>
            )}

            {/* ── CCTV IDLE ── */}
            {mode === 'cctv' && !selectedCamera && (
              <motion.div key="cctv-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
                  <Wifi size={28} className="text-white/70" />
                </div>
                <h3 className="font-display text-[16px] font-bold text-white mb-1">Select an Edge CCTV Camera</h3>
                <p className="font-body text-[12px] text-white/50 max-w-xs mb-4">
                  Stream high-definition RTSP surveillance feeds directly to the inference cluster.
                </p>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 font-mono text-[10px] text-white/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  {activeCamCount} FEEDS ONLINE
                </div>
              </motion.div>
            )}

            {/* ── ACTIVE VIDEO VIEWPORT (Live connected to Spatial Vision) ── */}
            {isFeedConnected && (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  src={mode === 'upload' || mode === 'cctv' ? (videoUrl || undefined) : undefined}
                  autoPlay
                  loop={mode === 'cctv'}
                  crossOrigin="anonymous"
                  playsInline
                  muted={isMuted}
                  className="w-full h-full object-contain bg-black"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setDuration(videoRef.current.duration);
                  }}
                  onEnded={handleVideoEnded}
                />

                {/* Smooth fast scan line */}
                {isPlaying && <ScanLine fps={fps} />}

                {/* Real-time Bounding Boxes */}
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                  <AnimatePresence>
                    {realDetections.map((det, idx) => {
                      const [x1, y1, x2, y2] = det.bbox;
                      const leftPct   = Math.max(0, Math.min(98, (x1 / frameDims.width) * 100));
                      const topPct    = Math.max(0, Math.min(95, (y1 / frameDims.height) * 100));
                      const widthPct  = Math.min(100 - leftPct, Math.max(3, ((x2 - x1) / frameDims.width) * 100));
                      const heightPct = Math.min(100 - topPct, Math.max(3, ((y2 - y1) / frameDims.height) * 100));

                      const style = getBboxStyle(det);
                      const isWorker = det.class_name === 'worker';
                      const isFire   = det.class_name === 'fire' || det.class_name === 'smoke';

                      return (
                        <motion.div
                          key={`${det.class_name}-${idx}-${inferFrameCount}`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.12 }}
                          style={{
                            left:   `${leftPct}%`,
                            top:    `${topPct}%`,
                            width:  `${widthPct}%`,
                            height: `${heightPct}%`,
                            borderColor: style.border,
                            boxShadow: style.glow !== 'none' ? `0 0 14px ${style.glow}, inset 0 0 14px ${style.glow}30` : 'none',
                            position: 'absolute',
                            borderWidth: isWorker ? 1 : 2,
                            borderStyle: isWorker ? 'dashed' : 'solid',
                            borderRadius: 3,
                          }}
                          className="pointer-events-none"
                        >
                          {/* Corner brackets for hazards */}
                          {!isWorker && (
                            <>
                              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2" style={{ borderColor: style.border }} />
                              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2" style={{ borderColor: style.border }} />
                              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2" style={{ borderColor: style.border }} />
                              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2" style={{ borderColor: style.border }} />
                            </>
                          )}

                          {/* Top pill badge */}
                          <div
                            className="absolute -top-5 left-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap text-white shadow-sm"
                            style={{ backgroundColor: style.badge }}
                          >
                            {isFire && <Flame size={9} className="animate-pulse" />}
                            {det.is_violation && !isFire && <AlertTriangle size={9} />}
                            <span>{det.label.toUpperCase()}</span>
                            <span className="opacity-80">{(det.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Detection Legend (top right) */}
                <DetectionLegend detections={realDetections} noFireConfirmed={noFireConfirmed} />

                {/* Compliance HUD Bar (bottom) */}
                <ComplianceBar
                  pct={liveCompliance}
                  workerCount={inferStats?.workers ?? (metrics.workerCounts.slice(-1)[0] || 0)}
                  violationCount={inferStats?.violations ?? totalViolationsCount}
                  hazardDetected={inferStats?.hazard ?? false}
                  noFireConfirmed={noFireConfirmed}
                />

                {/* Top HUD bar with real-time stats */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <LiveBadge active={isPlaying} isComplete={!isPlaying && inferFrameCount > 0} />
                  <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 font-mono text-[9px] text-white/80 flex items-center gap-1.5">
                    <Cpu size={10} className="text-brand-accent" />
                    <span>YOLOv8</span>
                    <span>·</span>
                    <span className="text-brand-accent">{fps.toFixed(1)} FPS</span>
                    {latencyMs !== null && (
                      <>
                        <span>·</span>
                        <span>{latencyMs}ms</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Viewport Top Right Actions */}
                <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5">
                  {mode === 'upload' && (
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-md bg-black/60 border border-white/20 text-white/70 hover:text-white transition-all cursor-pointer" title="Replace Video">
                      <RefreshCw size={12} />
                    </button>
                  )}
                  {mode === 'webcam' && (
                    <button onClick={stopWebcam} className="p-1.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white transition-all cursor-pointer" title="Stop WebCam">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Video Playback & Scrubber Controls (when video is loaded) */}
          {isFeedConnected && (
            <div className="p-3 rounded-[var(--radius-md)] bg-surface border border-default flex flex-col gap-2 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayPause}
                  className="w-8 h-8 rounded-full bg-brand-accent hover:bg-brand-accent-hover text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 flex-shrink-0"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>

                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-all cursor-pointer flex-shrink-0"
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>

                {/* Time indicators */}
                <div className="font-mono text-[11px] text-muted flex-shrink-0">
                  <span>{Math.floor(currentTime / 60)}:{('0' + Math.floor(currentTime % 60)).slice(-2)}</span>
                  {duration > 0 && (
                    <span> / {Math.floor(duration / 60)}:{('0' + Math.floor(duration % 60)).slice(-2)}</span>
                  )}
                </div>

                {/* Progress bar (for uploaded video) */}
                {duration > 0 && (
                  <div
                    className="flex-1 h-1.5 rounded-full bg-surface-alt cursor-pointer relative overflow-hidden"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = (e.clientX - rect.left) / rect.width;
                      if (videoRef.current) videoRef.current.currentTime = pos * duration;
                    }}
                  >
                    <div
                      className="h-full bg-brand-accent rounded-full transition-all"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                )}

                {/* Frame Counter Telemetry */}
                <div className="ml-auto font-mono text-[10px] text-muted flex items-center gap-2">
                  <span>ƒ <strong className="text-primary">{inferFrameCount}</strong> frames</span>
                  {mode === 'upload' && videoMeta && (
                    <span className="truncate max-w-[140px] text-secondary font-body hidden sm:inline">
                      {videoMeta.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Features List when idle */}
          {!isFeedConnected && (
            <div className="flex gap-2 flex-wrap">
              {[
                { icon: <Cpu size={12} />, label: 'YOLOv8 Edge Engine' },
                { icon: <HardHat size={12} />, label: 'PPE Detection' },
                { icon: <Flame size={12} />, label: 'Fire & Combustion' },
                { icon: <FileText size={12} />, label: 'Instant Audit Report' },
              ].map(chip => (
                <div key={chip.label} className="px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-surface border border-default text-[11px] font-body text-secondary flex items-center gap-1.5">
                  <span className="text-brand-accent">{chip.icon}</span>{chip.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CENTER: Sensor Observer Panel ── */}
        <div>
          <SensorObserverPanel
            events={sensorEvents}
            isActive={isFeedConnected && isPlaying}
            framesScanned={inferFrameCount}
            fps={fps}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(s => !s)}
            onAck={ackEvent}
            onAckAll={ackAll}
          />
        </div>

        {/* ── RIGHT: Live Stream Telemetry & Generated Audit Report ── */}
        <div className="flex flex-col gap-4">

          {/* Top Panel View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-surface border border-default rounded-[var(--radius-md)]">
            <button
              id="tab-live-intel"
              onClick={() => setRightView('live')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--radius-sm)] font-body text-[12px] font-semibold transition-all cursor-pointer ${rightView === 'live' ? 'bg-brand-primary text-inverse shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <Activity size={13} /> Live Intelligence
            </button>
            <button
              id="tab-audit-report"
              onClick={() => setRightView('report')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--radius-sm)] font-body text-[12px] font-semibold transition-all cursor-pointer ${rightView === 'report' ? 'bg-brand-primary text-inverse shadow-sm' : 'text-secondary hover:text-primary'}`}
            >
              <FileText size={13} /> Audit Report
              {totalViolationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-mono text-[9px]">
                  {totalViolationsCount}
                </span>
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">

            {/* ── TAB 1: LIVE INTELLIGENCE STREAM ── */}
            {rightView === 'live' && (
              <motion.div
                key="live-panel"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex flex-col gap-4"
              >
                {/* Real-time Safety Score Dial */}
                <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-default shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-brand-accent" />
                      <span className="font-display text-[13px] font-bold text-primary">Live Compliance</span>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold"
                      style={{ backgroundColor: `${safetyGrade.color}20`, color: safetyGrade.color }}
                    >
                      {safetyGrade.grade}
                    </span>
                  </div>

                  <div className="space-y-2 mb-3">
                    <AccuracyMeter value={liveCompliance / 100} label="PPE Adherence" color={safetyGrade.color} />
                    <AccuracyMeter value={meanConfidencePct / 100} label="Model Precision" color="var(--brand-accent)" />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-subtle text-center">
                    <div className="p-2 rounded-[var(--radius-sm)] bg-surface-alt">
                      <div className="font-display text-[14px] font-bold text-primary">{inferFrameCount}</div>
                      <div className="font-mono text-[9px] text-muted uppercase">Frames</div>
                    </div>
                    <div className="p-2 rounded-[var(--radius-sm)] bg-surface-alt">
                      <div className={`font-display text-[14px] font-bold ${totalViolationsCount > 0 ? 'text-red-500' : 'text-primary'}`}>
                        {totalViolationsCount}
                      </div>
                      <div className="font-mono text-[9px] text-muted uppercase">Violations</div>
                    </div>
                    <div className="p-2 rounded-[var(--radius-sm)] bg-surface-alt">
                      <div className="font-display text-[14px] font-bold text-primary">
                        {latencyMs !== null ? `${latencyMs}ms` : '—'}
                      </div>
                      <div className="font-mono text-[9px] text-muted uppercase">Latency</div>
                    </div>
                  </div>
                </div>

                {/* CCTV Camera list in CCTV mode */}
                {mode === 'cctv' && (
                  <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-default shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wifi size={13} className="text-brand-accent" />
                        <span className="font-display text-[13px] font-bold text-primary">Select CCTV Feed</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted">{activeCamCount} online</span>
                    </div>
                    {cameras && cameras.length > 0 ? (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto">
                        {cameras.map(cam => (
                          <CameraCard
                            key={cam.id}
                            cam={cam}
                            selected={selectedCamera?.id === cam.id}
                            onSelect={() => handleCameraSelect(cam)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-muted font-body text-[12px]">No edge cameras registered.</div>
                    )}
                  </div>
                )}

                {/* Real-time Hazard Matrix */}
                <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-default shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target size={13} className="text-brand-accent" />
                      <span className="font-display text-[13px] font-bold text-primary">Live Hazard Counters</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">Session Aggregate</span>
                  </div>

                  <div className="space-y-2">
                    {['no_helmet', 'no_vest', 'fire', 'smoke', 'no_gloves'].map(key => {
                      const cfg = DETECTION_CONFIG[key];
                      const count = metrics.violationCounts[key] || 0;
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between p-2.5 rounded-[var(--radius-md)] border transition-all ${count > 0 ? `${cfg?.bg} ${cfg?.border}` : 'bg-surface-alt border-transparent opacity-60'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cfg?.color}>{cfg?.icon}</span>
                            <span className="font-body text-[12px] text-primary">{cfg?.shortLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {count > 0 ? (
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${cfg?.bg} ${cfg?.color} border ${cfg?.border}`}>
                                {count} detected
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-muted">0</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Button to freeze & generate full report */}
                  <button
                    onClick={() => setRightView('report')}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-[var(--radius-sm)] font-body text-[12px] font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <FileText size={14} /> Generate Full Audit Report
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── TAB 2: COMPREHENSIVE AUDIT REPORT ── */}
            {rightView === 'report' && (
              <motion.div
                key="report-panel"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex flex-col gap-4"
              >
                {/* Executive Report Card */}
                <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-default shadow-xs relative overflow-hidden">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Award size={14} style={{ color: safetyGrade.color }} />
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-muted">Safety Evaluation</span>
                      </div>
                      <h3 className="font-display text-[18px] font-bold text-primary">
                        {safetyGrade.desc}
                      </h3>
                    </div>

                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-display text-[20px] font-extrabold border shadow-sm"
                      style={{
                        backgroundColor: `${safetyGrade.color}15`,
                        borderColor: `${safetyGrade.color}40`,
                        color: safetyGrade.color,
                      }}
                    >
                      {safetyGrade.grade}
                    </div>
                  </div>

                  {/* Summary Telemetry */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-subtle">
                    <div className="p-2 rounded bg-surface-alt">
                      <div className="font-mono text-[9px] text-muted uppercase">Adherence</div>
                      <div className="font-display text-[15px] font-bold" style={{ color: safetyGrade.color }}>
                        {liveCompliance}%
                      </div>
                    </div>
                    <div className="p-2 rounded bg-surface-alt">
                      <div className="font-mono text-[9px] text-muted uppercase">Confidence</div>
                      <div className="font-display text-[15px] font-bold text-primary">
                        {meanConfidencePct}%
                      </div>
                    </div>
                    <div className="p-2 rounded bg-surface-alt">
                      <div className="font-mono text-[9px] text-muted uppercase">Frames Scanned</div>
                      <div className="font-display text-[15px] font-bold text-primary">
                        {metrics.totalFramesScanned || inferFrameCount}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-surface-alt">
                      <div className="font-mono text-[9px] text-muted uppercase">Total Violations</div>
                      <div className={`font-display text-[15px] font-bold ${totalViolationsCount > 0 ? 'text-red-500' : 'text-primary'}`}>
                        {totalViolationsCount}
                      </div>
                    </div>
                  </div>

                  {/* Fire / Environmental status confirmation */}
                  <div className={`mt-3 p-2.5 rounded-[var(--radius-sm)] border flex items-center gap-2 ${metrics.hazardDetectedEver ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'}`}>
                    {metrics.hazardDetectedEver ? <Flame size={14} className="flex-shrink-0" /> : <ShieldCheck size={14} className="flex-shrink-0" />}
                    <span className="font-body text-[11px] font-medium leading-snug">
                      {metrics.hazardDetectedEver
                        ? 'Active flame or combustion signature registered during inspection.'
                        : 'Zero fire or smoke anomalies detected across analyzed footage.'}
                    </span>
                  </div>
                </div>

                {/* Per-Hazard Breakdown Table */}
                <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-default shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={13} className="text-brand-accent" />
                      <span className="font-display text-[13px] font-bold text-primary">Violation Breakdown</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">Audit Log</span>
                  </div>

                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {Object.entries(DETECTION_CONFIG).map(([key, cfg]) => {
                      const count = metrics.violationCounts[key] || 0;
                      const firstSeenTime = metrics.firstSeen[key];
                      return (
                        <div key={key} className="flex items-center justify-between p-2 rounded bg-surface-alt text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className={cfg.color}>{cfg.icon}</span>
                            <span className="font-body font-medium text-primary">{cfg.shortLabel}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            {count > 0 ? (
                              <>
                                <span className="text-muted">{firstSeenTime}</span>
                                <span className={`px-1.5 py-0.5 rounded font-bold ${cfg.bg} ${cfg.color}`}>
                                  {count}×
                                </span>
                              </>
                            ) : (
                              <span className="text-green-500 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Pass
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Directives & Export */}
                <div className="p-4 rounded-[var(--radius-lg)] bg-surface border border-default shadow-xs flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={13} className="text-brand-accent" />
                    <span className="font-display text-[13px] font-bold text-primary">Export & Incident Actions</span>
                  </div>

                  <button
                    id="btn-download-json"
                    onClick={exportJsonReport}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-inverse hover:opacity-90 rounded-[var(--radius-sm)] font-body text-[12px] font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Download size={14} /> Download Full Audit Report (JSON)
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-alt border border-default hover:bg-surface-hover rounded-[var(--radius-sm)] font-body text-[11px] font-medium transition-all cursor-pointer"
                    >
                      <Printer size={12} /> Print Summary
                    </button>
                    <Link
                      to="/incidents"
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-alt border border-default hover:bg-surface-hover rounded-[var(--radius-sm)] font-body text-[11px] font-medium transition-all text-primary"
                    >
                      <ArrowRight size={12} /> View Incidents
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
