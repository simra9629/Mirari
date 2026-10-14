/**
 * Bug Hotel — audio. Subtle, procedural (Web Audio API, no samples).
 * Leaves, wind, water, rain, insect hum, distant birds, tiny sounds —
 * and it gets richer as the hotel fills up.
 */
import type { Phase, Weather } from "./data";

export interface AudioState {
  phase: Phase; weather: Weather; rain: number; wind: number;
  creatures: number; water: number; sun: number; selectedMoving: boolean;
}

function noiseBuffer(ctx: AudioContext, seconds = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const wn = Math.random() * 2 - 1; last = (last + 0.02 * wn) / 1.02; d[i] = wn * 0.5 + last * 3; }
  return b;
}

export class HotelAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private wind!: GainNode; private rain!: GainNode; private hum!: GainNode; private leaves!: GainNode;
  private lastEvent = 0;
  private enabled = false;

  get on() { return this.enabled; }

  start() {
    if (this.ctx) { void this.ctx.resume(); this.enabled = true; this.master.gain.value = 0.9; return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    const buf = noiseBuffer(ctx, 3);
    const layer = (type: BiquadFilterType, freq: number, q: number) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return g;
    };
    this.wind = layer("lowpass", 420, 0.6);
    this.rain = layer("highpass", 2600, 0.4);
    this.hum = layer("bandpass", 3600, 6);
    this.leaves = layer("bandpass", 1800, 1.4);
    this.enabled = true;
  }

  stop() {
    this.enabled = false;
    if (this.ctx) this.master.gain.value = 0;
  }

  private blip(freq: number, dur: number, vol: number, type: OscillatorType = "sine", slide = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  update(s: AudioState, nowSec: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const night = s.phase === "night" || s.phase === "evening";
    const fill = Math.min(1, s.creatures / 60);
    this.wind.gain.linearRampToValueAtTime(0.02 + s.wind * 0.12, t + 0.8);
    this.rain.gain.linearRampToValueAtTime(s.rain * 0.09, t + 0.8);
    this.hum.gain.linearRampToValueAtTime((night ? 0.02 : 0.008) * (0.2 + fill) , t + 0.8);
    this.leaves.gain.linearRampToValueAtTime(0.006 + s.wind * 0.05 + (s.selectedMoving ? 0.01 : 0), t + 0.4);
    if (nowSec - this.lastEvent > 1.2 + Math.random() * 2.5) {
      this.lastEvent = nowSec;
      const r = Math.random();
      if (!night && s.rain < 0.2 && s.weather !== "storm" && r < 0.35) this.blip(2400 + Math.random() * 900, 0.35, 0.012 + fill * 0.006, "sine", 600); // distant bird
      else if (night && r < 0.5 + fill * 0.2) { const f = 4200 + Math.random() * 400; for (let i = 0; i < 3; i++) setTimeout(() => this.blip(f, 0.05, 0.008 + fill * 0.006, "square"), i * 70); } // crickets
      else if (s.water > 0 && r < 0.7) this.blip(900 + Math.random() * 500, 0.12, 0.012, "sine", -300); // droplet
      else if (r < 0.9) this.blip(180 + Math.random() * 60, 0.05, 0.006 * (0.5 + fill), "triangle"); // tiny footstep
    }
  }

  dispose() {
    this.enabled = false;
    void this.ctx?.close();
    this.ctx = null;
  }
}
