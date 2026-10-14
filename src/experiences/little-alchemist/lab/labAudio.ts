/**
 * Little Alchemist — the lab's sounds. Procedural Web Audio on the archive's shared
 * context, so the master volume and mute apply. Silent until the player turns it on.
 */
import { sharedContext } from "../../../lib/audio";

export class LabAudio {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private noise!: AudioBuffer;
  private on = false;
  private stage = 0;
  private timers: number[] = [];
  private room: GainNode | null = null;
  private wind: GainNode | null = null;
  heat = 0;

  get enabled() { return this.on; }

  start(stage: number) {
    const ctx = sharedContext();
    if (!ctx) return;
    this.ctx = ctx;
    if (!this.out) {
      this.out = ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(ctx.destination);
      const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = n.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.03 * w) / 1.03; d[i] = w * 0.5 + last * 3; }
      this.noise = n;
      const src = ctx.createBufferSource(); src.buffer = n; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
      this.room = ctx.createGain(); this.room.gain.value = 0.05; src.connect(lp); lp.connect(this.room); this.room.connect(this.out); src.start();
      const src2 = ctx.createBufferSource(); src2.buffer = n; src2.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.4;
      this.wind = ctx.createGain(); this.wind.gain.value = 0; src2.connect(bp); bp.connect(this.wind); this.wind.connect(this.out); src2.start();
    }
    this.out.gain.setTargetAtTime(0.9, ctx.currentTime, 0.1);
    this.on = true;
    this.setStage(stage);
    this.loops();
  }

  stop() {
    this.on = false;
    this.timers.forEach((t) => window.clearInterval(t)); this.timers = [];
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  setStage(i: number) {
    this.stage = i;
    if (this.ctx && this.wind) this.wind.gain.setTargetAtTime(i >= 5 ? 0.025 : i >= 0 ? 0.008 : 0, this.ctx.currentTime, 0.8);
  }

  private burst(dur: number, vol: number, f: number, type: BiquadFilterType = "highpass", delay = 0) {
    const ctx = this.ctx; if (!ctx || !this.on) return;
    const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.02);
  }
  private tone(f: number, dur: number, vol: number, type: OscillatorType = "sine", delay = 0, slide = 0) {
    const ctx = this.ctx; if (!ctx || !this.on) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + dur + 0.03);
  }

  private loops() {
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [
      // the furnace: pops and crackles
      window.setInterval(() => { if (this.stage >= 1 && Math.random() < 0.55 + this.heat * 0.4) this.burst(0.03 + Math.random() * 0.05, 0.05 + this.heat * 0.05, 2500 + Math.random() * 3000); }, 140),
      // the apparatus: slow bubbling
      window.setInterval(() => { if (this.stage >= 4 && Math.random() < 0.6) this.tone(260 + Math.random() * 260, 0.09, 0.03, "sine", 0, 260); }, 420),
      // the odd creak
      window.setInterval(() => { if (Math.random() < 0.15) this.tone(110 + Math.random() * 40, 0.4, 0.015, "triangle", 0, -30); }, 3000),
    ];
  }

  clink() { this.tone(1800, 0.25, 0.05, "sine"); this.tone(2700, 0.18, 0.025, "sine", 0.01); this.burst(0.05, 0.05, 4000); }
  discover(isNew: boolean) { (isNew ? [0, 4, 7, 12, 16] : [0, 7]).forEach((n, i) => this.tone(523 * 2 ** (n / 12), 0.7, 0.045, "sine", i * 0.09)); this.clink(); }
  fizzle() { this.tone(300, 0.4, 0.05, "triangle", 0, -200); this.burst(0.3, 0.05, 3000); }
  flare() { this.burst(0.5, 0.12, 700, "bandpass"); this.tone(120, 0.5, 0.06, "sawtooth", 0, 120); }
  chill() { this.burst(0.6, 0.06, 6000); this.tone(2400, 0.5, 0.012, "sine", 0, -600); }
  grind() { for (let i = 0; i < 5; i++) this.burst(0.12, 0.09, 500, "bandpass", i * 0.13); }
  wait() { this.tone(900, 0.08, 0.03, "square"); this.tone(900, 0.08, 0.03, "square", 0.5); }
  stageUp() { [0, 7, 12].forEach((n, i) => this.tone(110 * 2 ** (n / 12), 1.6, 0.06, "sine", i * 0.2)); this.burst(1.2, 0.1, 300, "lowpass"); }
}
