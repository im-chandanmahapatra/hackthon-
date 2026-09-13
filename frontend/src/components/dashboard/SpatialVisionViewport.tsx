import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Video,
  UploadCloud,
  ShieldCheck,
  RefreshCw,
  PowerOff,
  Volume2,
  VolumeX,
  Crosshair,
  AlertTriangle,
  Flame,
  Wind,
  HardHat,
  Shield,
  CheckCircle2,
  Users,
  Cpu,
} from 'lucide-react';
import type { Camera, Incident } from '../../api/types';
import { Card } from '../ui/Card';
import { cn } from '../ui/Badge';
import { audioEngine } from '../../utils/audio';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpatialVisionViewportProps {
  cameras?: Camera[] | null;
  incidents?: Incident[] | null;
  onRefresh?: () => void;
}

type VideoSourceType = 'none' | 'webcam' | 'file' | 'camera';

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

// ─── Detection config ─────────────────────────────────────────────────────────

const HAZARD_CLASSES = new Set(['fire', 'smoke', 'no_helmet', 'no_vest', 'no_gloves', 'no_boots', 'no_goggles']);

function getBboxStyle(det: RealDetection) {
  const { class_name, is_violation } = det;
  if (class_name === 'fire')     return { border: '#ef4444', glow: 'rgba(239,68,68,0.7)',   badge: '#ef4444' };
  if (class_name === 'smoke')    return { border: '#94a3b8', glow: 'rgba(148,163,184,0.5)', badge: '#64748b' };
  if (is_violation)              return { border: '#ef4444', glow: 'rgba(239,68,68,0.5)',   badge: '#ef4444' };
  if (class_name === 'worker')   return { border: 'rgba(255,255,255,0.45)', glow: 'none',    badge: '#334155' };
  return                                { border: '#10b981', glow: 'rgba(16,185,129,0.45)', badge: '#059669' };
}

// ─── Scan line ────────────────────────────────────────────────────────────────

function ScanLine({ fps }: { fps: number }) {
  // Duration inversely proportional to FPS — faster scan at higher FPS
  const dur = Math.max(1.2, 4.0 - fps * 0.05);
  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none z-10"
      style={{ height: 3 }}
      animate={{ top: ['0%', '100%', '0%'] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'linear' }}
    >
      {/* Main glow beam */}
      <div className="w-full h-full bg-gradient-to-r from-transparent via-[rgba(255,115,0,0.85)] to-transparent" />
      {/* Soft ambient below */}
      <div className="w-full h-8 bg-gradient-to-b from-[rgba(255,115,0,0.15)] to-transparent -mt-0.5" />
    </motion.div>
  );
}

// ─── Compliance bar ───────────────────────────────────────────────────────────

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
        {/* Workers */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 border border-white/15 font-mono text-[10px] text-white/70">
          <Users size={10} /><span>{workerCount} workers</span>
        </div>
        {/* Violations */}
        {violationCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/80 border border-red-400/40 font-mono text-[10px] text-white font-bold">
            <AlertTriangle size={10} /><span>{violationCount} violations</span>
          </div>
        )}
        {/* Fire/smoke hazard indicator */}
        {hazardDetected ? (
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-600/90 border border-red-400 font-mono text-[10px] text-white font-bold">
            <Flame size={10} /><span>HAZARD DETECTED</span>
          </motion.div>
        ) : noFireConfirmed && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-600/70 border border-green-400/40 font-mono text-[10px] text-green-100">
            <CheckCircle2 size={10} /><span>No Fire / No Smoke</span>
          </div>
        )}
        {/* Compliance meter */}
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

// ─── Detection class legend ───────────────────────────────────────────────────

function DetectionLegend({ detections, noFireConfirmed }: { detections: RealDetection[]; noFireConfirmed: boolean }) {
  // Count unique violations
  const counts: Record<string, number> = {};
  for (const d of detections) {
    if (HAZARD_CLASSES.has(d.class_name)) counts[d.class_name] = (counts[d.class_name] || 0) + 1;
  }

  const legend = [
    { key: 'no_helmet',  label: 'No Helmet',  icon: <HardHat size={10} />, color: '#ef4444' },
    { key: 'no_vest',    label: 'No Vest',    icon: <Shield size={10} />,  color: '#f97316' },
    { key: 'fire',       label: 'Fire',       icon: <Flame size={10} />,   color: '#ef4444' },
    { key: 'smoke',      label: 'Smoke',      icon: <Wind size={10} />,    color: '#94a3b8' },
  ];

  const active = legend.filter(l => counts[l.key]);

  if (active.length === 0 && !noFireConfirmed) return null;

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end">
      <AnimatePresence>
        {active.map(item => (
          <motion.div key={item.key}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm border font-mono text-[10px] font-bold"
            style={{ backgroundColor: `${item.color}22`, borderColor: `${item.color}55`, color: item.color }}>
            {item.icon}
            <span>{item.label}</span>
            <span className="ml-0.5 opacity-80">×{counts[item.key]}</span>
          </motion.div>
        ))}
        {noFireConfirmed && active.filter(i => i.key === 'fire' || i.key === 'smoke').length === 0 && (
          <motion.div key="no-fire"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm border border-green-500/30 bg-green-500/15 font-mono text-[10px] text-green-300">
            <CheckCircle2 size={10} />
            <span>Fire Sensor: Clear</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SpatialVisionViewport({
  cameras = [],
  incidents: _incidents = [],
  onRefresh,
}: SpatialVisionViewportProps) {
  const [videoSource, setVideoSource] = useState<VideoSourceType>('none');
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState(new Date());
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [realDetections, setRealDetections] = useState<RealDetection[]>([]);
  const [frameDims, setFrameDims] = useState<{ width: number; height: number }>({ width: 640, height: 480 });
  const [inferStats, setInferStats] = useState<{ workers: number; violations: number; compliance: number; hazard: boolean } | null>(null);
  const [noFireConfirmed, setNoFireConfirmed] = useState(false);
  const [inferFrameCount, setInferFrameCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAlertRef = useRef<Record<string, number>>({});
  const inferCountRef = useRef(0);

  // ── Clock tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const clockTimer = setInterval(() => setTimestamp(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanupMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (activeVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(activeVideoUrl);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
  }, [activeVideoUrl]);

  const disconnectFeed = useCallback(() => {
    cleanupMedia();
    setVideoSource('none');
    setActiveVideoUrl(null);
    setActiveFileName(null);
    setIsPlaying(false);
    setErrorMessage(null);
    setRealDetections([]);
    setInferStats(null);
    setNoFireConfirmed(false);
    setFps(0);
    setLatencyMs(null);
    setInferFrameCount(0);
  }, [cleanupMedia]);

  // ── Real-time AI Inference Loop ───────────────────────────────────────────
  // Polls at ~250ms (4 Hz) for responsive detection without overwhelming the server
  useEffect(() => {
    if (videoSource === 'none' || !isPlaying) {
      setRealDetections([]);
      setFps(0);
      return;
    }

    let isMounted = true;
    let isInflight = false; // prevents concurrent requests
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

            // After 3+ frames with no fire/smoke, confirm clear status
            if (!data.hazard_detected && inferCountRef.current > 3) {
              setNoFireConfirmed(true);
            } else if (data.hazard_detected) {
              setNoFireConfirmed(false);
            }

            // Per-class audio alerts (debounced 8s each)
            const now2 = Date.now();
            for (const det of data.detections) {
              if (!det.is_violation && det.class_name !== 'fire' && det.class_name !== 'smoke') continue;
              if (det.class_name === 'worker') continue;
              const lastFired = lastAlertRef.current[det.class_name] ?? 0;
              if (now2 - lastFired > 8000) {
                lastAlertRef.current[det.class_name] = now2;
                audioEngine.playDetectionAlert(det.class_name);
              }
            }
          }
        }
      } catch {
        // Silently maintain last known state on network error
      } finally {
        isInflight = false;
      }
    };

    // 250ms polling = ~4 frames/sec to the inference server
    const timer = setInterval(runInference, 250);
    return () => { isMounted = false; clearInterval(timer); };
  }, [videoSource, isPlaying]);

  // ── WebCam connect ────────────────────────────────────────────────────────
  const handleConnectWebcam = async () => {
    cleanupMedia();
    setErrorMessage(null);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        setVideoSource('webcam');
        setActiveFileName('Live Device Camera');
        setIsPlaying(true);
        inferCountRef.current = 0;
        setNoFireConfirmed(false);
      } else {
        setErrorMessage('WebCam access is not supported in this browser.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Camera permission denied.');
      setVideoSource('none');
    }
  };

  useEffect(() => {
    if (videoSource === 'webcam' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [videoSource]);

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (MP4, WebM, MOV).');
      return;
    }
    cleanupMedia();
    setErrorMessage(null);
    const objectUrl = URL.createObjectURL(file);
    setActiveVideoUrl(objectUrl);
    setActiveFileName(file.name);
    setVideoSource('file');
    setIsPlaying(true);
    inferCountRef.current = 0;
    setNoFireConfirmed(false);
  };

  // ── Edge camera ───────────────────────────────────────────────────────────
  const handleConnectCameraFeed = (targetCam?: Camera) => {
    cleanupMedia();
    setErrorMessage(null);
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
    const chosenCam = targetCam || cameras?.find(c => c.stream_url) || cameras?.[0];
    const streamUrl = chosenCam?.stream_url
      ? (chosenCam.stream_url.startsWith('http') ? chosenCam.stream_url : `${apiBase}${chosenCam.stream_url}`)
      : `${apiBase}/uploads/3fcef4ee-a632-429a-85e3-f8a14e289a35.mp4`;
    const label = chosenCam
      ? `${chosenCam.label} (${chosenCam.id.toUpperCase()})`
      : 'Assembly Conveyor 01 (CAM-01)';
    setActiveVideoUrl(streamUrl);
    setActiveFileName(label);
    setVideoSource('camera');
    setIsPlaying(true);
    inferCountRef.current = 0;
    setNoFireConfirmed(false);
    setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 100);
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play().catch(() => {}); setIsPlaying(true); }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  useEffect(() => { return () => { cleanupMedia(); }; }, []);

  const isConnected = videoSource !== 'none';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="p-0 overflow-hidden flex flex-col relative group border border-default">

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileChange} />

      {/* ── Top HUD bar ── */}
      <div className="px-4 sm:px-5 py-3 border-b border-subtle flex flex-wrap items-center justify-between gap-2 bg-surface/80">
        <div className="flex items-center gap-2.5">
          {/* Live status dot */}
          <div className="relative flex h-2 w-2">
            {isConnected && isPlaying && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              !isConnected ? 'bg-stone-400' : isPlaying ? 'bg-emerald-500' : 'bg-amber-500'
            )} />
          </div>

          <span className="font-display text-[14px] font-bold text-primary">
            {videoSource === 'webcam' ? 'Device WebCam Stream'
              : videoSource === 'file' ? `Video File: ${activeFileName}`
              : videoSource === 'camera' ? (activeFileName || 'Edge Surveillance Stream')
              : 'Spatial Vision Viewport'}
          </span>

          <span className={cn(
            'font-mono text-[10px] uppercase px-2 py-0.5 rounded-full border',
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'bg-surface-alt border-border-subtle text-muted'
          )}>
            {isConnected ? (isPlaying ? 'LIVE INFERENCE' : 'PAUSED') : 'STANDBY'}
          </span>

          {/* Model status pill */}
          {isConnected && isPlaying && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-alt border border-default">
              <Cpu size={9} className="text-brand-accent" />
              <span className="font-mono text-[9px] text-muted">YOLOv8</span>
            </div>
          )}
        </div>

        {/* FPS / Latency / Clock */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
          <span className="hidden sm:inline">
            FPS: <strong className="text-primary tabular-nums font-semibold">{fps.toFixed(1)}</strong>
          </span>
          <span className="hidden sm:inline text-border-default">/</span>
          <span className="hidden sm:inline">
            LATENCY: <strong className="text-primary tabular-nums font-semibold">
              {latencyMs !== null ? `${latencyMs}ms` : isConnected ? '—' : '--'}
            </strong>
          </span>
          <span className="text-border-default">/</span>
          <span className="tabular-nums">{timestamp.toLocaleTimeString('en-GB')}</span>
          {isConnected && (
            <>
              <span className="text-border-default">/</span>
              <span title="Inference frames processed">
                ƒ<strong className="text-primary"> {inferFrameCount}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Main Viewport ── */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[16/8.8] bg-[#0A0908] overflow-hidden select-none flex items-center justify-center">

        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none z-0"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '24px 24px, 48px 48px, 48px 48px',
          }}
        />

        {/* ── STANDBY ── */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center p-8 text-center z-10 max-w-md mx-auto">
            <div className="relative mb-5 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-stone-900 border border-stone-700/80 flex items-center justify-center text-stone-300 shadow-lg">
                <Crosshair size={28} className="text-stone-400" />
              </div>
              <span className="absolute w-20 h-20 rounded-full border border-stone-600/30 animate-ping opacity-30" />
            </div>

            <div className="font-mono text-[10px] uppercase font-bold tracking-[0.16em] text-brand-accent mb-1.5">
              SENSOR READY // AWAITING VIDEO FEED
            </div>

            <h3 className="font-display text-[18px] font-bold text-stone-100">
              No Video Stream Connected
            </h3>

            <p className="font-body text-[13px] text-stone-400 mt-1.5 leading-relaxed max-w-md">
              Connect your device webcam, select an edge surveillance camera feed, or upload footage to run real-time YOLOv8 spatial inference.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
              <button type="button" onClick={handleConnectWebcam}
                className="px-4 py-2 rounded-full font-body text-[12px] font-semibold bg-brand-accent hover:bg-brand-accent-hover text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-[0.97]">
                <Video size={14} /> Connect WebCam
              </button>
              <button type="button" onClick={() => handleConnectCameraFeed()}
                className="px-4 py-2 rounded-full font-body text-[12px] font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 transition-all flex items-center gap-2 cursor-pointer active:scale-[0.97]">
                <Crosshair size={14} className="text-emerald-400" /> Edge Camera 01
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-full font-body text-[12px] font-semibold bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.97]">
                <UploadCloud size={14} /> Select Video File
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIVE VIDEO ── */}
        {isConnected && (
          <div className="relative w-full h-full">

            {/* The real video element */}
            {videoSource === 'webcam' ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} src={activeVideoUrl || undefined} autoPlay loop playsInline muted={isMuted} className="w-full h-full object-cover" />
            )}

            {/* ── Smooth fast scan line ── */}
            {isPlaying && <ScanLine fps={fps} />}

            {/* ── Real-time bounding boxes ── */}
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              <AnimatePresence>
                {realDetections.map((det, idx) => {
                  const [x1, y1, x2, y2] = det.bbox;
                  const leftPct  = Math.max(0, Math.min(98, (x1 / frameDims.width) * 100));
                  const topPct   = Math.max(0, Math.min(95, (y1 / frameDims.height) * 100));
                  const widthPct = Math.min(100 - leftPct, Math.max(3, ((x2 - x1) / frameDims.width) * 100));
                  const heightPct = Math.min(100 - topPct, Math.max(3, ((y2 - y1) / frameDims.height) * 100));

                  const style = getBboxStyle(det);
                  const isWorker = det.class_name === 'worker';
                  const isFire   = det.class_name === 'fire' || det.class_name === 'smoke';

                  return (
                    <motion.div
                      key={`${det.class_name}-${idx}-${inferFrameCount}`}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
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
                      {/* Corner brackets */}
                      {!isWorker && (
                        <>
                          <div className="absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2" style={{ borderColor: style.border }} />
                          <div className="absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2" style={{ borderColor: style.border }} />
                          <div className="absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2" style={{ borderColor: style.border }} />
                          <div className="absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2" style={{ borderColor: style.border }} />
                        </>
                      )}

                      {/* Top label badge */}
                      <div className="absolute -top-5 left-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-t font-mono text-[9px] font-bold uppercase whitespace-nowrap"
                        style={{ backgroundColor: style.badge, color: '#fff' }}>
                        {isFire
                          ? <Flame size={9} className="mr-0.5 flex-shrink-0" />
                          : det.is_violation
                          ? <AlertTriangle size={9} className="mr-0.5 flex-shrink-0" />
                          : <ShieldCheck size={9} className="mr-0.5 flex-shrink-0" />}
                        <span>{det.label} {Math.round(det.confidence * 100)}%</span>
                      </div>

                      {/* Bottom TRACK_ID (non-worker violations only) */}
                      {!isWorker && (
                        <div className="absolute -bottom-5 right-0 font-mono text-[9px] bg-black/80 px-1.5 rounded border border-white/20 text-stone-300">
                          TRACK_ID: #{String(idx + 101).padStart(3, '0')}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Neural inference scanning HUD (no detections yet) */}
              {realDetections.length === 0 && isPlaying && (
                <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-stone-300 font-mono text-[10px] flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-ping" />
                  <span>NEURAL INFERENCE ACTIVE • SCANNING WORKSPACE</span>
                </div>
              )}
            </div>

            {/* ── Detection Legend (top-right) ── */}
            <DetectionLegend detections={realDetections} noFireConfirmed={noFireConfirmed} />

            {/* ── Compliance bar (bottom overlay) ── */}
            {inferStats && (
              <ComplianceBar
                pct={inferStats.compliance}
                workerCount={inferStats.workers}
                violationCount={inferStats.violations}
                hazardDetected={inferStats.hazard}
                noFireConfirmed={noFireConfirmed}
              />
            )}

          </div>
        )}

        {/* ── Controls capsule ── */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-30">

          {/* Source controls */}
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10">
            {isConnected ? (
              <>
                <button type="button" onClick={disconnectFeed}
                  className="px-3 py-1 rounded-full font-body text-[11px] font-semibold bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 transition-all flex items-center gap-1.5 cursor-pointer">
                  <PowerOff size={11} /> Disconnect
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded-full font-body text-[11px] font-semibold text-stone-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer">
                  <UploadCloud size={11} /> Switch File
                </button>
                {videoSource !== 'webcam' && (
                  <button type="button" onClick={handleConnectWebcam}
                    className="px-3 py-1 rounded-full font-body text-[11px] font-semibold text-stone-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer">
                    <Video size={11} /> WebCam
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" onClick={handleConnectWebcam}
                  className="px-3 py-1 rounded-full font-body text-[11px] font-semibold text-stone-200 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer">
                  <Video size={12} /> WebCam
                </button>
                <button type="button" onClick={() => handleConnectCameraFeed()}
                  className="px-3 py-1 rounded-full font-body text-[11px] font-semibold text-stone-200 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer">
                  <Crosshair size={12} className="text-emerald-400" /> Edge Cam 01
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded-full font-body text-[11px] font-semibold text-stone-200 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer">
                  <UploadCloud size={12} /> Select Video
                </button>
              </>
            )}
          </div>

          {/* Playback controls */}
          {isConnected && (
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10">
              <button type="button" onClick={togglePlayPause}
                className="p-1.5 rounded-full text-white hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
                title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              </button>
              {videoSource !== 'webcam' && (
                <button type="button" onClick={toggleMute}
                  className="p-1.5 rounded-full text-white hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
                  title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              )}
              <button type="button" onClick={() => { onRefresh?.(); }}
                className="p-1.5 rounded-full text-white hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
                title="Refresh">
                <RefreshCw size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="absolute top-3 left-3 right-3 px-3 py-2 rounded bg-red-500/90 text-white text-[12px] font-body flex items-center justify-between z-30 shadow-md">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold underline ml-2 cursor-pointer">Dismiss</button>
          </div>
        )}

      </div>
    </Card>
  );
}
