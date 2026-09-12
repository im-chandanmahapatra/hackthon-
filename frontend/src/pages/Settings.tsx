import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  Eye, 
  Bell, 
  Server, 
  Download, 
  Check, 
  Sun, 
  Moon, 
  Laptop, 
  Flame,
  ShieldCheck,
  Play,
  Radio
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { audioEngine, SOUND_PROFILES, type SoundProfile } from '../utils/audio';
import { useTheme } from '../components/ThemeProvider';
import { useToast } from '../hooks/useToast';
import { cn } from '../components/ui/Badge';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [soundEnabled, setSoundEnabled] = useState(audioEngine.isEnabled());
  const [activeProfile, setActiveProfile] = useState<SoundProfile>(audioEngine.getProfile());
  const [volume, setVolume] = useState<number>(Math.round(audioEngine.getVolume() * 100));

  const [ppeRules, setPpeRules] = useState({
    hardHat: true,
    hiVisVest: true,
    boots: true,
    goggles: false,
    gloves: false,
  });
  const [fireSensitivity, setFireSensitivity] = useState(88);
  const [pollingRate, setPollingRate] = useState<'fast' | 'normal' | 'slow'>('normal');

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioEngine.setEnabled(next);
    if (next) {
      audioEngine.playAlertChime();
    }
    showToast(`Audio alerts ${next ? 'enabled' : 'muted'}`, 'info');
  };

  const handleSelectProfile = (profile: SoundProfile) => {
    setActiveProfile(profile);
    audioEngine.setProfile(profile);
    if (!soundEnabled) {
      setSoundEnabled(true);
      audioEngine.setEnabled(true);
    }
    audioEngine.playSound(profile);
    const meta = SOUND_PROFILES.find(p => p.id === profile);
    showToast(`Sound profile set to ${meta?.name || profile}`, 'success');
  };

  const testProfileSound = (e: React.MouseEvent, profile: SoundProfile) => {
    e.stopPropagation();
    if (!soundEnabled) {
      setSoundEnabled(true);
      audioEngine.setEnabled(true);
    }
    audioEngine.playSound(profile);
    const meta = SOUND_PROFILES.find(p => p.id === profile);
    showToast(`Previewing ${meta?.name}`, 'info');
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioEngine.setVolume(newVol / 100);
    if (newVol > 0 && !soundEnabled) {
      setSoundEnabled(true);
      audioEngine.setEnabled(true);
    }
  };

  const handleExportJson = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      node: 'EDGE-NODE-01',
      model: 'YOLOv8n-Spatial-v2.4',
      status: 'active',
      rules: ppeRules,
      soundSettings: {
        enabled: soundEnabled,
        profile: activeProfile,
        volume: volume / 100,
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-telemetry-export-${Date.now()}.json`;
    a.click();
    showToast('Telemetry export downloaded', 'success');
  };

  return (
    <div className="flex flex-col gap-8 max-w-[880px] mx-auto w-full">
      
      {/* ── Page Header ── */}
      <header className="pb-6 border-b border-subtle">
        <h1 className="font-display text-[32px] font-bold tracking-[-0.035em] text-primary">
          System Preferences
        </h1>
        <p className="font-body text-[14px] text-secondary mt-1.5 leading-relaxed">
          Configure spatial AI detection rules, synthesized acoustic telemetry profiles, and appearance.
        </p>
      </header>

      {/* ── Section: Detection Rules ── */}
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-4 border-b border-subtle">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-brand-accent" />
            <div>
              <h2 className="font-display text-[16px] font-bold text-primary">
                Spatial Detection Classes
              </h2>
              <p className="font-body text-[12px] text-muted">
                Active YOLOv8 spatial inference validation rules.
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-surface-alt border border-border-subtle text-muted">
            Model: YOLOv8n
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[
            { key: 'hardHat', label: 'Hard Hat Enforcement', desc: 'Alert if head protection is missing' },
            { key: 'hiVisVest', label: 'Hi-Vis Safety Vest', desc: 'Detect reflective class 2/3 garments' },
            { key: 'boots', label: 'Steel-Toe Footwear', desc: 'Monitor safety footwear requirements' },
            { key: 'goggles', label: 'Eye Protection / Goggles', desc: 'Chemical & grinding hazard zones' },
            { key: 'gloves', label: 'Protective Work Gloves', desc: 'Heavy machinery & electrical handling' },
          ].map((item) => {
            const isChecked = ppeRules[item.key as keyof typeof ppeRules];
            return (
              <div
                key={item.key}
                onClick={() => {
                  setPpeRules(prev => ({ ...prev, [item.key]: !isChecked }));
                  showToast(`${item.label} ${!isChecked ? 'activated' : 'deactivated'}`, 'info');
                }}
                className={cn(
                  "p-3.5 rounded-[var(--radius-sm)] border cursor-pointer transition-all flex items-start justify-between gap-3",
                  isChecked 
                    ? "bg-surface border-brand-accent/40 shadow-xs" 
                    : "bg-surface/40 border-border-subtle hover:bg-surface-hover/60"
                )}
              >
                <div>
                  <div className="font-display text-[13px] font-bold text-primary">{item.label}</div>
                  <div className="font-body text-[11px] text-muted mt-0.5">{item.desc}</div>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  isChecked ? "bg-brand-accent text-white" : "border border-border-default bg-surface"
                )}>
                  {isChecked && <Check size={12} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fire Sensitivity Slider */}
        <div className="pt-4 border-t border-subtle flex flex-col gap-2">
          <div className="flex justify-between items-center text-[13px]">
            <span className="font-display font-semibold text-primary flex items-center gap-1.5">
              <Flame size={15} className="text-status-danger" /> Fire & Smoke Confidence Threshold
            </span>
            <span className="font-mono font-bold text-brand-accent">{fireSensitivity}%</span>
          </div>
          <input
            type="range"
            min={60}
            max={99}
            value={fireSensitivity}
            onChange={e => setFireSensitivity(Number(e.target.value))}
            className="w-full h-1.5 bg-surface-alt rounded-lg appearance-none cursor-pointer accent-brand-accent"
          />
        </div>

        {/* Polling Rate Selector */}
        <div className="pt-4 border-t border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-display text-[13px] font-bold text-primary">Inference Telemetry Refresh Rate</div>
            <div className="font-body text-[11px] text-muted">Edge streaming poll frequency interval</div>
          </div>
          <SegmentedControl
            size="sm"
            layoutId="seg-polling"
            value={pollingRate}
            onChange={(val) => {
              setPollingRate(val as 'fast' | 'normal' | 'slow');
              showToast(`Polling interval set to ${val}`, 'info');
            }}
            options={[
              { value: 'fast', label: 'Fast (2s)' },
              { value: 'normal', label: 'Normal (5s)' },
              { value: 'slow', label: 'Eco (10s)' },
            ]}
          />
        </div>
      </Card>

      {/* ── Section: Synthesized Notification Sound Profiles ── */}
      <Card className="p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between pb-4 border-b border-subtle">
          <div className="flex items-center gap-2.5">
            <Bell size={18} className="text-brand-accent" />
            <div>
              <h2 className="font-display text-[16px] font-bold text-primary">
                Acoustic Alert & Sound Profiles
              </h2>
              <p className="font-body text-[12px] text-muted">
                Synthesized Web Audio API sound signatures with sub-2ms latency.
              </p>
            </div>
          </div>

          {/* Master Sound Switch */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] font-semibold text-muted uppercase">
              {soundEnabled ? 'ACTIVE' : 'MUTED'}
            </span>
            <button
              type="button"
              onClick={toggleSound}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none p-0.5",
                soundEnabled ? "bg-brand-accent" : "bg-stone-300 dark:bg-stone-700"
              )}
              title={soundEnabled ? 'Mute Sounds' : 'Enable Sounds'}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white shadow-xs"
                animate={{ x: soundEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        {/* Master Volume Slider */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-[var(--radius-sm)] bg-surface/50 border border-border-subtle">
          <div className="flex items-center gap-2.5">
            {volume === 0 || !soundEnabled ? (
              <VolumeX size={16} className="text-muted" />
            ) : (
              <Volume2 size={16} className="text-brand-accent" />
            )}
            <div>
              <div className="font-display text-[13px] font-bold text-primary">Master Alert Volume</div>
              <div className="font-body text-[11px] text-muted">Adjust synthesis gain level</div>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-56">
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full h-1.5 bg-surface-alt rounded-lg appearance-none cursor-pointer accent-brand-accent"
            />
            <span className="font-mono text-[11px] font-bold text-primary w-9 text-right tabular-nums">
              {volume}%
            </span>
          </div>
        </div>

        {/* 4 Sound Profile Cards Grid */}
        <div className="flex flex-col gap-2">
          <div className="text-[12px] font-display font-semibold text-primary">
            Select Active Notification Sound ({SOUND_PROFILES.length} Profiles Available)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {SOUND_PROFILES.map((prof) => {
              const isSelected = activeProfile === prof.id;
              return (
                <div
                  key={prof.id}
                  onClick={() => handleSelectProfile(prof.id)}
                  className={cn(
                    "p-4 rounded-[var(--radius-sm)] border cursor-pointer transition-all flex flex-col justify-between gap-3 relative group",
                    isSelected 
                      ? "bg-surface border-brand-accent shadow-xs ring-1 ring-brand-accent/30" 
                      : "bg-surface/40 border-border-subtle hover:bg-surface-hover/80 hover:border-hover"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Radio size={14} className={isSelected ? "text-brand-accent fill-brand-accent" : "text-muted"} />
                        <span className="font-display text-[14px] font-bold text-primary">
                          {prof.name}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-surface-alt border border-border-subtle text-muted">
                        {prof.tagline}
                      </span>
                    </div>

                    <p className="font-body text-[12px] text-secondary mt-1.5 leading-relaxed">
                      {prof.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-subtle">
                    <span className="font-mono text-[10px] text-muted">
                      FREQ: <strong className="text-primary">{prof.frequencies}</strong>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => testProfileSound(e, prof.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-body text-[11px] font-semibold transition-all cursor-pointer shadow-xs",
                        isSelected 
                          ? "bg-brand-accent text-white hover:bg-brand-accent-hover" 
                          : "bg-surface border border-default text-primary hover:bg-surface-hover"
                      )}
                      title={`Preview ${prof.name}`}
                    >
                      <Play size={10} fill="currentColor" /> Preview Sound
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ── Section: Appearance ── */}
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2.5 pb-4 border-b border-subtle">
          <Eye size={18} className="text-brand-accent" />
          <div>
            <h2 className="font-display text-[16px] font-bold text-primary">
              Interface Theme & Aesthetics
            </h2>
            <p className="font-body text-[12px] text-muted">
              Select between Apple Editorial Warm Alabaster and Obsidian Cinematic themes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light Alabaster', icon: Sun, desc: 'Warm stone paper' },
            { id: 'dark', label: 'Dark Obsidian', icon: Moon, desc: 'Cinematic HUD' },
            { id: 'system', label: 'System Sync', icon: Laptop, desc: 'Follow OS preferences' },
          ].map((item) => {
            const isSelected = theme === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTheme(item.id as 'light' | 'dark' | 'system');
                  showToast(`Switched theme to ${item.label}`, 'info');
                }}
                className={cn(
                  "p-4 rounded-[var(--radius-sm)] border text-left flex flex-col gap-2 transition-all cursor-pointer",
                  isSelected 
                    ? "bg-brand-primary text-inverse border-brand-primary shadow-xs" 
                    : "bg-surface border-default text-primary hover:bg-surface-hover"
                )}
              >
                <Icon size={18} className={isSelected ? "text-inverse" : "text-muted"} />
                <div>
                  <div className="font-display text-[13px] font-bold">{item.label}</div>
                  <div className={cn("font-body text-[11px]", isSelected ? "text-inverse/70" : "text-muted")}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Section: Edge Diagnostics & Export ── */}
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-4 border-b border-subtle">
          <div className="flex items-center gap-2.5">
            <Server size={18} className="text-brand-accent" />
            <div>
              <h2 className="font-display text-[16px] font-bold text-primary">
                Edge Node Telemetry Diagnostics
              </h2>
              <p className="font-body text-[12px] text-muted">
                Runtime metrics and export logs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-xs)] font-body text-[12px] font-semibold bg-brand-primary text-inverse hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
          >
            <Download size={13} /> Export JSON
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[12px]">
          <div className="p-3 rounded-[var(--radius-sm)] bg-surface border border-border-subtle">
            <div className="text-[10px] text-muted uppercase">Node Cluster</div>
            <div className="font-bold text-primary mt-1">US-EAST-01</div>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-surface border border-border-subtle">
            <div className="text-[10px] text-muted uppercase">Quantization</div>
            <div className="font-bold text-primary mt-1">FP16 CUDA</div>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-surface border border-border-subtle">
            <div className="text-[10px] text-muted uppercase">Mean Latency</div>
            <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-1">28.4 ms</div>
          </div>
          <div className="p-3 rounded-[var(--radius-sm)] bg-surface border border-border-subtle">
            <div className="text-[10px] text-muted uppercase">Engine Status</div>
            <div className="font-bold text-primary mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
}
