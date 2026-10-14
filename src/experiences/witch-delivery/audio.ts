/**
 * The Witch's Delivery Service — audio. Procedural (Web Audio API).
 * Lively and whimsical: wind, broom hum, rain, bells, birds — and every
 * unusual package has its own recognisable sound.
 */
export interface AudioState {
  speed: number; wind: number; rain: number; storm: number; boosting: boolean; night: boolean; magic: number;
  pkg: string; sing: boolean; awake: boolean; stolen: boolean; glow: number;
}

function noise(ctx: AudioContext, sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.03 * w) / 1.03; d[i] = w * 0.5 + last * 3; }
  return b;
}
const PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];

export class WitchAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private layers: Record<string, GainNode> = {};
  private hum!: OscillatorNode; private humGain!: GainNode;
  private nextEvent = 0; private nextNote = 0; private noteI = 0; private nextZap = 0;
  private enabled = false;
  get on() { return this.enabled; }

  start() {
    if (this.ctx) { void this.ctx.resume(); this.enabled = true; this.master.gain.value = 0.9; return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    const buf = noise(ctx, 3);
    const layer = (name: string, type: BiquadFilterType, freq: number, q: number) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start();
      this.layers[name] = g;
    };
    layer("wind", "lowpass", 600, 0.7); layer("rain", "highpass", 2400, 0.4); layer("rush", "bandpass", 1400, 0.9); layer("rumble", "lowpass", 140, 1);
    this.hum = ctx.createOscillator(); this.hum.type = "sawtooth"; this.hum.frequency.value = 80;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 340;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    this.hum.connect(lp); lp.connect(this.humGain); this.humGain.connect(this.master); this.hum.start();
    this.enabled = true;
  }
  stop() { this.enabled = false; if (this.ctx) this.master.gain.value = 0; }

  private tone(f: number, dur: number, vol: number, type: OscillatorType = "sine", slide = 0, delay = 0) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  private burst(dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass", delay = 0) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noise(ctx, 1);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + dur + 0.05);
  }

  play(name: string, v = 1) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case "chime": [0, 4, 7].forEach((n, i) => this.tone(660 * 2 ** (n / 12), 0.5, 0.05 * v, "sine", 0, i * 0.07)); break;
      case "bonk": this.tone(150, 0.18, 0.12 * v, "triangle", -70); this.burst(0.1, 0.06 * v, 600); break;
      case "splash": this.burst(0.35, 0.08 * v, 1800, "bandpass"); break;
      case "ring": [0, 5, 9, 12].forEach((n, i) => this.tone(520 * 2 ** (n / 12), 0.4, 0.05, "triangle", 0, i * 0.05)); break;
      case "discover": [0, 4, 7, 11, 14].forEach((n, i) => this.tone(440 * 2 ** (n / 12), 0.7, 0.045, "sine", 0, i * 0.1)); break;
      case "pickup": this.tone(520, 0.12, 0.06, "square"); this.tone(780, 0.2, 0.06, "square", 0, 0.1); break;
      case "deliver": [0, 4, 7, 12].forEach((n, i) => this.tone(392 * 2 ** (n / 12), 0.6, 0.06, "triangle", 0, i * 0.11)); break;
      case "oops": this.tone(330, 0.3, 0.07, "triangle", -140); this.tone(260, 0.4, 0.07, "triangle", -120, 0.2); break;
      case "zap": this.burst(0.25, 0.14, 3000, "highpass"); this.tone(900, 0.2, 0.06, "sawtooth", -700); break;
      case "thunder": this.burst(1.6, 0.35, 220); break;
      case "whoosh": this.burst(0.6, 0.12, 900, "bandpass"); this.tone(220, 0.5, 0.05, "sawtooth", 500); break;
      case "ribbit": this.tone(180, 0.09, 0.07, "square", 90); this.tone(220, 0.09, 0.07, "square", 60, 0.1); break;
      case "birds": for (let i = 0; i < 5; i++) this.tone(2400 + Math.random() * 1200, 0.1, 0.04, "sine", 500, i * 0.06); break;
      case "fizz": this.burst(0.5, 0.1, 5000, "highpass"); break;
      case "rumble": this.tone(70, 0.9, 0.12, "sine", -20); break;
      case "hiccup": this.tone(300, 0.15, 0.06, "square", 300); this.tone(600, 0.2, 0.05, "square", -300, 0.15); break;
      case "weather": this.tone(220, 1.2, 0.03, "sine", 40); break;
      case "chirp": this.tone(1800, 0.08, 0.06, "square", 700); this.tone(2200, 0.1, 0.06, "square", 500, 0.1); break;
      case "thump": this.tone(90, 0.15, 0.1, "sine", -30); break;
      default: break;
    }
  }

  update(s: AudioState, now: number) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    const t = ctx.currentTime;
    const sp = Math.min(1, s.speed / 600);
    this.layers.wind.gain.linearRampToValueAtTime(0.015 + s.wind / 400 * 0.1 + sp * 0.06, t + 0.2);
    this.layers.rain.gain.linearRampToValueAtTime(s.rain * 0.07, t + 0.4);
    this.layers.rush.gain.linearRampToValueAtTime((s.boosting ? 0.14 : 0) + sp * 0.02, t + 0.1);
    this.layers.rumble.gain.linearRampToValueAtTime(s.awake ? 0.22 : s.pkg === "sleepcloud" ? 0.03 : 0, t + 0.4);
    this.humGain.gain.linearRampToValueAtTime(0.012 + sp * 0.02, t + 0.2);
    this.hum.frequency.linearRampToValueAtTime(70 + sp * 70 + (s.boosting ? 40 : 0), t + 0.2);
    // package voices
    if (s.pkg === "teapot" && s.sing && !s.stolen && now > this.nextNote) {
      this.nextNote = now + 0.34 + (this.noteI % 4 === 3 ? 0.25 : 0);
      const seq = [0, 2, 4, 2, 5, 4, 2, 1, 3, 2, 4, 6];
      this.tone(PENTA[seq[this.noteI++ % seq.length]], 0.3, 0.05, "triangle");
    }
    if (s.pkg === "storm" && now > this.nextZap) { this.nextZap = now + 0.25 + Math.random() * 1.2; this.burst(0.06, 0.05, 3500, "highpass"); }
    if (s.pkg === "moonlight" && s.glow > 0.3 && now > this.nextZap) { this.nextZap = now + 1.6; this.tone(1568, 0.9, 0.012 * s.glow, "sine"); }
    // town life
    if (now > this.nextEvent) {
      this.nextEvent = now + 2 + Math.random() * 5;
      const r = Math.random();
      if (!s.night && s.rain < 0.2 && r < 0.4) this.tone(2400 + Math.random() * 800, 0.3, 0.012, "sine", 500);
      else if (s.night && r < 0.5) { const f = 4300 + Math.random() * 300; for (let i = 0; i < 3; i++) this.tone(f, 0.05, 0.006, "square", 0, i * 0.07); }
      else if (!s.night && r < 0.6) { const f = 523 * (r < 0.5 ? 1 : 1.25); this.tone(f, 1.6, 0.012, "sine"); this.tone(f * 2.76, 1.0, 0.004, "sine"); }
    }
  }
  dispose() { this.enabled = false; void this.ctx?.close(); this.ctx = null; }
}
