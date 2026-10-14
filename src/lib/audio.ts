/**
 * Mirari's shared audio system.
 *
 * One master level for the whole archive. Every experience still makes its
 * own sounds with the Web Audio API (Sound Garden, The Code, Bug Hotel, …),
 * but anything that reaches a context's speakers is routed through a single
 * master gain per context, so one mute switch and one volume slider govern
 * all of it — including experiences that were written before this existed.
 *
 * The archive itself also has a quiet "interface sound" layer (hover ticks,
 * selection, page transitions). That layer is opt-in and off by default.
 */

export interface AudioPrefs { muted: boolean; volume: number; ui: boolean }

const KEY = "mirari:audio";
const DEFAULTS: AudioPrefs = { muted: false, volume: 0.8, ui: false };

let prefs: AudioPrefs = load();
const listeners = new Set<(p: AudioPrefs) => void>();
const masters = new Set<GainNode>();
const masterOf = new WeakMap<BaseAudioContext, GainNode>();
let origConnect: AudioNode["connect"] | null = null;
let installed = false;
let uiCtx: AudioContext | null = null;

function load(): AudioPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && typeof p === "object") return { muted: !!p.muted, volume: Math.min(1, Math.max(0, Number(p.volume ?? 0.8))), ui: !!p.ui };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

const level = (p: AudioPrefs) => (p.muted ? 0 : p.volume * p.volume);

function applyLevel(m: GainNode) {
  if (m.context.state === "closed") { masters.delete(m); return; }
  m.gain.setTargetAtTime(level(prefs), m.context.currentTime, 0.03);
}

export function getAudioPrefs(): AudioPrefs { return prefs; }

export function setAudioPrefs(patch: Partial<AudioPrefs>) {
  prefs = { ...prefs, ...patch, volume: Math.min(1, Math.max(0, patch.volume ?? prefs.volume)) };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  for (const m of masters) applyLevel(m);
  for (const l of listeners) l(prefs);
}

export function subscribeAudio(fn: (p: AudioPrefs) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function masterFor(ctx: BaseAudioContext): GainNode {
  let m = masterOf.get(ctx);
  if (!m) {
    m = ctx.createGain();
    m.gain.value = level(prefs);
    // connect straight to the speakers, bypassing the redirect below
    ((origConnect ?? m.connect) as unknown as (this: AudioNode, d: AudioNode) => void).call(m, ctx.destination);
    masterOf.set(ctx, m);
    masters.add(m);
  }
  return m;
}

/**
 * Route every connection to a context's speakers through that context's master
 * gain. Safe to call more than once; does nothing without Web Audio.
 */
export function installAudioMaster() {
  if (installed || typeof AudioNode === "undefined" || typeof AudioDestinationNode === "undefined") return;
  installed = true;
  origConnect = AudioNode.prototype.connect;
  const orig = origConnect as unknown as (this: AudioNode, ...a: unknown[]) => unknown;
  AudioNode.prototype.connect = function (this: AudioNode, dest: unknown, ...rest: unknown[]) {
    if (dest instanceof AudioDestinationNode && masterOf.get(this.context) !== this) {
      return orig.call(this, masterFor(this.context), ...rest);
    }
    return orig.call(this, dest, ...rest);
  } as AudioNode["connect"];
}

/* ------------------------------------------------------------------ */
/* Interface sounds                                                    */
/* ------------------------------------------------------------------ */

function ctxForUi(): AudioContext | null {
  if (uiCtx) { if (uiCtx.state === "suspended") void uiCtx.resume(); return uiCtx; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  uiCtx = new AC();
  return uiCtx;
}

function tone(ctx: AudioContext, f: number, dur: number, vol: number, type: OscillatorType, delay = 0, slide = 0) {
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.04);
}

export type UiSound = "hover" | "select" | "open" | "back" | "toggle" | "whoosh";

export function playUi(kind: UiSound) {
  if (!prefs.ui || prefs.muted || typeof window === "undefined") return;
  const ctx = ctxForUi();
  if (!ctx) return;
  switch (kind) {
    case "hover": tone(ctx, 1100, 0.05, 0.025, "sine"); break;
    case "select": tone(ctx, 520, 0.12, 0.05, "triangle"); tone(ctx, 780, 0.18, 0.05, "triangle", 0.07); break;
    case "open": tone(ctx, 330, 0.5, 0.045, "sine", 0, 330); tone(ctx, 660, 0.4, 0.03, "sine", 0.08, 220); break;
    case "back": tone(ctx, 660, 0.35, 0.04, "sine", 0, -300); break;
    case "toggle": tone(ctx, 880, 0.08, 0.04, "square"); break;
    case "whoosh": {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8;
      f.frequency.setValueAtTime(400, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.5);
      const g = ctx.createGain(); g.gain.value = 0.07;
      s.connect(f); f.connect(g); g.connect(ctx.destination); s.start();
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* A shared context for new code that wants one                        */
/* ------------------------------------------------------------------ */

let shared: AudioContext | null = null;
/** A lazily-created, resumed AudioContext whose output obeys the master level. */
export function sharedContext(): AudioContext | null {
  if (!shared) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    shared = new AC();
  }
  if (shared.state === "suspended") void shared.resume();
  return shared;
}
