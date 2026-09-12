/**
 * Argus Spatial Audio Engine
 * Pure Web Audio API synthesized harmonic notification chimes.
 * Zero external audio assets required. Ultra-low latency (<2ms).
 */

export type SoundProfile = 'harmonic' | 'sonar' | 'beacon' | 'tactical';

export interface SoundProfileMeta {
  id: SoundProfile;
  name: string;
  tagline: string;
  category: string;
  description: string;
  frequencies: string;
}

export const SOUND_PROFILES: SoundProfileMeta[] = [
  {
    id: 'harmonic',
    name: 'Harmonic Chime',
    tagline: 'Linear / Apple Style',
    category: 'Balanced',
    description: 'Dual-tone ascending acoustic ping (D5 → A5). Clean, modern, and non-fatiguing.',
    frequencies: '587Hz / 880Hz',
  },
  {
    id: 'sonar',
    name: 'Sonar Radar Ping',
    tagline: 'Subtle Industrial',
    category: 'Subtle',
    description: 'Low-frequency resonant acoustic pulse with warm bandpass decay. Minimal distraction.',
    frequencies: '440Hz → 220Hz',
  },
  {
    id: 'beacon',
    name: 'Polyphonic Triad',
    tagline: 'Melodic Marimba',
    category: 'Melodic',
    description: 'Ascending 3-tone chord (C5 → E5 → G5) with sparkling shimmer decay.',
    frequencies: '523Hz / 659Hz / 784Hz',
  },
  {
    id: 'tactical',
    name: 'Tactical Siren Sweep',
    tagline: 'Critical Hazard Alert',
    category: 'Urgent',
    description: 'High-contrast alternating dual-frequency sweep for critical safety & fire alerts.',
    frequencies: '880Hz ⇄ 660Hz',
  },
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private activeProfile: SoundProfile = 'harmonic';
  private volume: number = 0.8;

  constructor() {
    try {
      const savedMute = localStorage.getItem('argus_sound_enabled');
      this.isMuted = savedMute !== null ? savedMute === 'false' : false;

      const savedProfile = localStorage.getItem('argus_sound_profile') as SoundProfile | null;
      if (savedProfile && SOUND_PROFILES.some(p => p.id === savedProfile)) {
        this.activeProfile = savedProfile;
      }

      const savedVol = localStorage.getItem('argus_sound_volume');
      if (savedVol !== null) {
        this.volume = Math.max(0, Math.min(1, parseFloat(savedVol) || 0.8));
      }
    } catch {
      this.isMuted = false;
      this.activeProfile = 'harmonic';
      this.volume = 0.8;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return !this.isMuted;
  }

  public setEnabled(enabled: boolean) {
    this.isMuted = !enabled;
    try {
      localStorage.setItem('argus_sound_enabled', String(enabled));
    } catch {}
  }

  public getProfile(): SoundProfile {
    return this.activeProfile;
  }

  public setProfile(profile: SoundProfile) {
    this.activeProfile = profile;
    try {
      localStorage.setItem('argus_sound_profile', profile);
    } catch {}
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('argus_sound_volume', String(this.volume));
    } catch {}
  }

  /**
   * Play any of the 4 synthesized sound profiles on demand
   */
  public playSound(profile?: SoundProfile) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const target = profile || this.activeProfile;
    const masterVol = this.volume;

    switch (target) {
      case 'sonar':
        this.synthesizeSonar(ctx, masterVol);
        break;
      case 'beacon':
        this.synthesizeBeacon(ctx, masterVol);
        break;
      case 'tactical':
        this.synthesizeTactical(ctx, masterVol);
        break;
      case 'harmonic':
      default:
        this.synthesizeHarmonic(ctx, masterVol);
        break;
    }
  }

  /**
   * Sound 1: Harmonic Dual-Tone (D5 -> A5)
   */
  private synthesizeHarmonic(ctx: AudioContext, masterVol: number) {
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.14 * masterVol, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: 880.00 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.075);

    gain2.gain.setValueAtTime(0, now + 0.075);
    gain2.gain.linearRampToValueAtTime(0.18 * masterVol, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.075);
    osc2.stop(now + 0.5);
  }

  /**
   * Sound 2: Sonar Radar Ping (Subtle warm 440Hz -> 220Hz decay with resonant filter)
   */
  private synthesizeSonar(ctx: AudioContext, masterVol: number) {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.4);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(880, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22 * masterVol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * Sound 3: Polyphonic Triad (C5 -> E5 -> G5)
   */
  private synthesizeBeacon(ctx: AudioContext, masterVol: number) {
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0, dur: 0.35, vol: 0.12 },     // C5
      { freq: 659.25, time: 0.06, dur: 0.38, vol: 0.14 },  // E5
      { freq: 783.99, time: 0.12, dur: 0.5, vol: 0.16 },   // G5
    ];

    notes.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(vol * masterVol, now + time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur + 0.05);
    });
  }

  /**
   * Sound 4: Tactical Siren Sweep (Rapid dual pulse 880Hz / 660Hz)
   */
  private synthesizeTactical(ctx: AudioContext, masterVol: number) {
    const now = ctx.currentTime;

    const pulses = [
      { freq: 880, time: 0, dur: 0.1 },
      { freq: 660, time: 0.09, dur: 0.1 },
      { freq: 880, time: 0.18, dur: 0.12 },
      { freq: 660, time: 0.28, dur: 0.15 },
    ];

    pulses.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.18 * masterVol, now + time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur + 0.02);
    });
  }

  /**
   * Play active user selected alert chime
   */
  public playAlertChime() {
    this.playSound(this.activeProfile);
  }

  /**
   * Sweet harmonic confirmation chime (G5 -> C6)
   */
  public playSuccessChime() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(783.99, now);
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.12);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15 * this.volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }
}

export const audioEngine = new AudioEngine();
