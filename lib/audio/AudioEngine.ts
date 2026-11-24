import type { SfxKind } from "@/lib/engine/types";

export type SoundProfile = "marimba" | "soft" | "bubble" | "tick" | "glass";

export const SOUND_PROFILES: { id: SoundProfile; label: string }[] = [
  { id: "marimba", label: "Marimba" },
  { id: "soft", label: "Soft Synth" },
  { id: "bubble", label: "Bubble Pop" },
  { id: "tick", label: "Tick / Click" },
  { id: "glass", label: "Glass Bell" },
];

// major pentatonic, 3 octaves from A3
const PENTA = [0, 2, 4, 7, 9];
const BASE = 220;
function noteFreq(i: number): number {
  const oct = Math.floor(i / 5);
  const st = oct * 12 + PENTA[((i % 5) + 5) % 5];
  return BASE * Math.pow(2, st / 12);
}

/**
 * Procedural ASMR sound engine built on the Web Audio API.
 * No audio files: every hit is synthesized. The master bus is routed both to
 * the speakers and to a MediaStream so recordings include the audio.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private out: GainNode | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices: number[] = [];
  private lastHit = 0;
  private lastSpecial: Record<string, number> = {};

  enabled = true;
  volume = 0.7;
  /** "auto" follows the simulation's preferred profile */
  profile: SoundProfile | "auto" = "auto";
  simProfile: SoundProfile = "marimba";
  maxVoices = 32;

  ensure(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor({ latencyHint: "interactive" });
      this.ctx = ctx;
      const master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;
      const out = ctx.createGain();
      out.gain.value = this.enabled ? this.volume : 0;
      master.connect(comp);
      comp.connect(out);
      out.connect(ctx.destination);
      try {
        this.dest = ctx.createMediaStreamDestination();
        out.connect(this.dest);
      } catch {
        this.dest = null;
      }
      this.master = master;
      this.out = out;
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  get stream(): MediaStream | null {
    return this.dest ? this.dest.stream : null;
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyGain();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyGain();
  }

  private applyGain(): void {
    if (this.out && this.ctx) {
      this.out.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02);
    }
  }

  private get activeProfile(): SoundProfile {
    return this.profile === "auto" ? this.simProfile : this.profile;
  }

  private canPlay(now: number): boolean {
    const v = this.voices;
    let j = 0;
    for (let i = 0; i < v.length; i++) if (v[i] > now) v[j++] = v[i];
    v.length = j;
    return v.length < this.maxVoices;
  }

  play(kind: SfxKind, intensity: number, r: number, x = 540): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (!this.canPlay(now)) return;
    if (kind === "hit" || kind === "tap") {
      if (now - this.lastHit < (kind === "tap" ? 0.03 : 0.016)) return;
      this.lastHit = now;
    } else {
      const minGap = kind === "win" ? 0.8 : kind === "boom" ? 0.12 : 0.035;
      if (now - (this.lastSpecial[kind] ?? 0) < minGap) return;
      this.lastSpecial[kind] = now;
    }
    intensity = Math.max(0.05, Math.min(1, intensity));
    const pan = Math.max(-0.7, Math.min(0.7, (x / 1080) * 2 - 1));
    // smaller balls -> higher notes
    const base = Math.round(Math.max(0, Math.min(12, (34 - r) / 2.4)));
    const idx = base + Math.floor(Math.random() * 3);
    const f = noteFreq(idx);

    switch (kind) {
      case "hit":
        this.voice(this.activeProfile, f, 0.06 + intensity * 0.3, pan, now);
        break;
      case "tap":
        this.voice(this.activeProfile, f * 2, 0.03 + intensity * 0.12, pan, now);
        break;
      case "split":
        this.voice(this.activeProfile, f * 2, 0.12 + intensity * 0.18, pan, now);
        this.voice("glass", f * 3, 0.05, pan, now + 0.035);
        break;
      case "pop":
        this.voice("bubble", f * 1.5, 0.22, pan, now);
        break;
      case "bump":
        this.voice("soft", f * 2, 0.2 + intensity * 0.2, pan, now, 0.18);
        this.voice("tick", f, 0.12, pan, now);
        break;
      case "break":
        this.noiseHit(900, 0.35, 0.25, pan, now, "lowpass");
        this.tone("sine", 140, 70, 0.3, 0.22, pan, now);
        break;
      case "boom":
        this.tone("sine", 130, 38, 0.55, 0.6, pan, now);
        this.noiseHit(500, 0.25, 0.35, pan, now, "lowpass");
        break;
      case "whoosh":
        this.noiseSweep(pan, now);
        break;
      case "win": {
        const notes = [0, 2, 4, 5, 7];
        notes.forEach((n, i) => this.voice("glass", noteFreq(5 + n), 0.18, 0, now + i * 0.09));
        break;
      }
    }
  }

  private connectVoice(node: AudioNode, pan: number): AudioNode {
    const ctx = this.ctx!;
    if (typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      p.connect(this.master!);
      return p;
    }
    node.connect(this.master!);
    return node;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, pan: number, t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, peak, 0.005, dur);
    o.connect(g);
    this.connectVoice(g, pan);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.voices.push(t + dur);
  }

  private noiseHit(freq: number, dur: number, peak: number, pan: number, t: number, type: BiquadFilterType): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = type === "bandpass" ? 6 : 0.7;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.002, dur);
    src.connect(filt);
    filt.connect(g);
    this.connectVoice(g, pan);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.05);
    this.voices.push(t + dur);
  }

  private noiseSweep(pan: number, t: number): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 2;
    filt.frequency.setValueAtTime(300, t);
    filt.frequency.exponentialRampToValueAtTime(2400, t + 0.4);
    const g = ctx.createGain();
    this.env(g, t, 0.18, 0.12, 0.35);
    src.connect(filt);
    filt.connect(g);
    this.connectVoice(g, pan);
    src.start(t);
    src.stop(t + 0.55);
    this.voices.push(t + 0.5);
  }

  private voice(p: SoundProfile, f: number, peak: number, pan: number, t: number, decayOverride?: number): void {
    const ctx = this.ctx!;
    switch (p) {
      case "marimba": {
        const g = ctx.createGain();
        const o1 = ctx.createOscillator();
        o1.type = "sine";
        o1.frequency.value = f;
        const o2 = ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = f * 4;
        const g2 = ctx.createGain();
        this.env(g2, t, peak * 0.35, 0.002, 0.07);
        const d = decayOverride ?? 0.45;
        this.env(g, t, peak, 0.003, d);
        o1.connect(g);
        o2.connect(g2);
        g2.connect(g);
        this.connectVoice(g, pan);
        o1.start(t);
        o2.start(t);
        o1.stop(t + d + 0.05);
        o2.stop(t + 0.12);
        this.voices.push(t + d);
        break;
      }
      case "soft": {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = f;
        const filt = ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = 900 + peak * 4000;
        const g = ctx.createGain();
        const d = decayOverride ?? 0.6;
        this.env(g, t, peak * 0.9, 0.01, d);
        o.connect(filt);
        filt.connect(g);
        this.connectVoice(g, pan);
        o.start(t);
        o.stop(t + d + 0.05);
        this.voices.push(t + d);
        break;
      }
      case "bubble": {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(f * 0.7, t);
        o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.07);
        const g = ctx.createGain();
        const d = decayOverride ?? 0.12;
        this.env(g, t, peak * 1.1, 0.004, d);
        o.connect(g);
        this.connectVoice(g, pan);
        o.start(t);
        o.stop(t + d + 0.05);
        this.voices.push(t + d);
        break;
      }
      case "tick": {
        if (!this.noise) return;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const filt = ctx.createBiquadFilter();
        filt.type = "bandpass";
        filt.frequency.value = Math.min(9000, f * 6);
        filt.Q.value = 7;
        const g = ctx.createGain();
        const d = decayOverride ?? 0.045;
        this.env(g, t, peak * 2.2, 0.001, d);
        src.connect(filt);
        filt.connect(g);
        this.connectVoice(g, pan);
        src.start(t, Math.random() * 0.4);
        src.stop(t + d + 0.03);
        this.voices.push(t + d);
        break;
      }
      case "glass": {
        const g = ctx.createGain();
        const o1 = ctx.createOscillator();
        o1.type = "sine";
        o1.frequency.value = f * 2;
        const o2 = ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = f * 2 * 2.76;
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        const d = decayOverride ?? 1.0;
        this.env(g, t, peak * 0.7, 0.002, d);
        o1.connect(g);
        o2.connect(g2);
        g2.connect(g);
        this.connectVoice(g, pan);
        o1.start(t);
        o2.start(t);
        o1.stop(t + d + 0.05);
        o2.stop(t + d + 0.05);
        this.voices.push(t + d * 0.6);
        break;
      }
    }
  }
}
