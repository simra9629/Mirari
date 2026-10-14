/**
 * The Witch's Delivery Service — simulation layer.
 *
 * Pure TypeScript. The component feeds it input and reads state; the renderer
 * draws state. Systems: flight, weather, delivery, package behaviour,
 * navigation (routes & shortcuts), characters, world objects, save state.
 */
import {
  CONSTRAINT_TEXT, CUSTOMER, DAY_LEN, DISTRICTS, GENERIC_LINES, GROUND, LANDMARKS, LOC, OBJECTIVE_TEXT, PACKAGES, PKG, SECRETS,
  TIER_LABEL, TIER_UNLOCK, WEATHER, WEATHERS, WORLD_H, WORLD_W, districtAt,
  type ConstraintKind, type CustomerId, type DistrictId, type LocId, type ObjectiveKind, type PackageDef, type PkgId, type UpgradeId, type Weather,
} from "./data";
import { inTunnelX, isWaterX, solidsNear, terrainY, type World } from "./world";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Input { x: number; y: number; boost: boolean; flourish: boolean }
export interface Save {
  v: 1; coins: number; delivered: number; stars: number;
  upgrades: Record<UpgradeId, number>;
  secrets: Record<string, boolean>; met: Record<string, number>; seen: Record<string, number>;
  routes: Record<string, { t: number; route: string }>; weatherSeen: Record<string, boolean>;
  shortcuts: Record<string, boolean>; intro: boolean;
}
export const defaultSave = (): Save => ({
  v: 1, coins: 0, delivered: 0, stars: 0,
  upgrades: { speed: 0, accel: 0, stability: 0, glide: 0, boost: 0, compass: 0 },
  secrets: {}, met: {}, seen: {}, routes: {}, weatherSeen: { clear: true }, shortcuts: {}, intro: false,
});
export function normalizeSave(o: unknown): Save {
  const d = defaultSave();
  if (!o || typeof o !== "object") return d;
  const s = o as Partial<Save>;
  return { ...d, ...s, v: 1, upgrades: { ...d.upgrades, ...(s.upgrades ?? {}) }, secrets: s.secrets ?? {}, met: s.met ?? {}, seen: s.seen ?? {}, routes: s.routes ?? {}, weatherSeen: { ...d.weatherSeen, ...(s.weatherSeen ?? {}) }, shortcuts: s.shortcuts ?? {} };
}

export interface Constraint { kind: ConstraintKind; text: string; limit: number }
export interface Offer {
  id: number; pkg: PkgId; from: LocId; to: LocId; customer: CustomerId; constraint: Constraint;
  objective: { kind: ObjectiveKind; text: string } | null; par: number; dist: number; reward: number; tier: 0 | 1 | 2;
}

export interface Player {
  x: number; y: number; vx: number; vy: number; ang: number; face: number;
  boost: number; boostLock: boolean; boostIdle: number; flourishCd: number; flourishT: number;
  stun: number; invuln: number; tumble: number; onGround: boolean; inWater: boolean; rad: number; windV: number; speed: number;
  ax: number; ay: number; shake: number; hat: string; hatT: number; hover: number;
}

export interface Pkg {
  def: PackageDef; s: Record<string, number>; stolen: number; x: number; y: number;
}
export interface Flock { i: number; x: number; y: number; vx: number; vy: number; cool: number; scare: number; hasPkg: boolean }
export interface Frog { x: number; y: number; vx: number; vy: number; life: number }
export interface Bolt { x: number; y: number; warn: number; life: number; hostile: boolean; hit: boolean; seed: number }
export interface Part {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: string; color: string; rot: number;
}

export type Phase = "idle" | "pickup" | "carry" | "result";
export interface Quest {
  offer: Offer; phase: Phase; t0: number; elapsed: number; dwell: number; leaveT: number;
  routeT: Record<string, number>; routeSeq: string[]; lastRoute: string; routeHold: number;
  rings: number; groundTouches: number; shortcut: boolean; thefts: number; bumps: number; highest: number; lowestUp: number;
}
export interface Result {
  offer: Offer; time: number; par: number; stars: number; quality: number;
  parts: { time: number; cond: number; acc: number; obj: boolean | null };
  title: string; line: string; customerLine: string; reward: number; route: string; newBest: boolean; bestTime: number;
  unlocks: string[]; customer: CustomerId; bucket: "great" | "ok" | "bad"; tipNote: string;
}
export interface GameEvent { type: "toast" | "sfx" | "ann"; text?: string; name?: string; tone?: string; x?: number; v?: number }

export interface WeatherState {
  kind: Weather; next: Weather | null; left: number;
  rain: number; snow: number; fog: number; storm: number; magic: number; vis: number; wind: number; dir: 1 | -1;
}

export interface Game {
  w: World; save: Save; rng: number; t: number; clock: number;
  p: Player; input: Input; flourishPrev: boolean; queue: { t: number; x: number; y: number; boost: boolean }[];
  weather: WeatherState; lockWeather: boolean;
  quest: Quest | null; pkg: Pkg | null; offers: Offer[]; result: Result | null; nextId: number;
  flocks: Flock[]; frogs: Frog[]; bolts: Bolt[]; parts: Part[]; levity: { x: number; y: number; r: number; life: number }[];
  boltT: number; invertT: number; invertWarn: number; pulseT: number;
  cam: { x: number; y: number }; shake: number; hint: string; ev: GameEvent[];
  ringCool: Record<number, number>; portalCool: number; fountainCool: number; splashCool: number; zoneFlags: Record<string, number>;
  prevV: { x: number; y: number }; ghost: { x: number; y: number }[]; ghostT: number; reflect: { x: number; y: number };
  musicT: number; paused: boolean; startRoofSet: boolean; secretT?: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function rnd(g: Game): number {
  g.rng = (g.rng + 0x6d2b79f5) | 0;
  let t = g.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (g: Game, a: number, b: number) => a + rnd(g) * (b - a);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pickOf = <T,>(g: Game, a: T[]): T => a[Math.floor(rnd(g) * a.length)];

export function timeOfDay(clock: number) { return (clock % DAY_LEN) / DAY_LEN; }
export function lightLevel(f: number) { return clamp(0.5 + Math.sin((f - 0.25) * Math.PI * 2) * 0.9, 0.06, 1); }
export function dayName(f: number) {
  const l = Math.sin((f - 0.25) * Math.PI * 2);
  if (f > 0.95 || f < 0.05) return "Midnight";
  if (l < -0.2) return "Night";
  if (f < 0.35 && l < 0.45) return "Dawn";
  if (f > 0.65 && f < 0.78) return "Dusk";
  if (l > 0.75) return "Midday";
  return f < 0.5 ? "Morning" : "Afternoon";
}
export const isMidnight = (f: number) => f > 0.945 || f < 0.055;
const isDark = (f: number) => lightLevel(f) < 0.3;

export const unlockedTier = (delivered: number) => (delivered >= TIER_UNLOCK[2] ? 2 : delivered >= TIER_UNLOCK[1] ? 1 : 0);
export const districtOpen = (delivered: number, id: DistrictId) => delivered >= (DISTRICTS.find((d) => d.id === id)?.unlock ?? 99);
export const weatherOpen = (delivered: number, id: Weather) => delivered >= WEATHER[id].unlock;

function push(g: Game, e: GameEvent) { g.ev.push(e); if (g.ev.length > 40) g.ev.shift(); }
const toast = (g: Game, text: string, tone = "info") => push(g, { type: "toast", text, tone });
const sfx = (g: Game, name: string, x = g.p.x, v = 1) => push(g, { type: "sfx", name, x, v });

export function spawnPart(g: Game, p: Partial<Part> & { x: number; y: number }) {
  if (g.parts.length > 700) g.parts.shift();
  g.parts.push({ vx: 0, vy: 0, life: 1, size: 3, kind: "spark", color: "#fff", rot: 0, ...p, max: p.max ?? p.life ?? 1 });
}
function burst(g: Game, x: number, y: number, n: number, kind: string, color: string, sp = 120, life = 0.7, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = rnd(g) * 6.283, s = rr(g, 0.3, 1) * sp;
    spawnPart(g, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(g, 0.5, 1) * life, size: size * rr(g, 0.6, 1.3), kind, color });
  }
}

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */

export function createGame(w: World, save: Save, seed = 1): Game {
  const pad = w.pads.post;
  const g: Game = {
    w, save, rng: seed | 0 || 1, t: 0, clock: DAY_LEN * 0.3,
    p: { x: pad.x, y: pad.y + 8, vx: 0, vy: 0, ang: 0, face: 1, boost: 100, boostLock: false, boostIdle: 0, flourishCd: 0, flourishT: 0, stun: 0, invuln: 0, tumble: 0, onGround: false, inWater: false, rad: 15, windV: 0, speed: 0, ax: 0, ay: 0, shake: 0, hat: "", hatT: 0, hover: 0 },
    input: { x: 0, y: 0, boost: false, flourish: false }, flourishPrev: false, queue: [],
    weather: { kind: "clear", next: null, left: 80, rain: 0, snow: 0, fog: 0, storm: 0, magic: 0, vis: 1, wind: 20, dir: 1 }, lockWeather: false,
    quest: null, pkg: null, offers: [], result: null, nextId: 1,
    flocks: w.flocks.map((f, i) => ({ i, x: f.cx, y: f.cy, vx: 0, vy: 0, cool: 0, scare: 0, hasPkg: false })),
    frogs: [], bolts: [], parts: [], levity: [], boltT: 4, invertT: 0, invertWarn: 0, pulseT: 15,
    cam: { x: pad.x, y: pad.y }, shake: 0, hint: "", ev: [],
    ringCool: {}, portalCool: 0, fountainCool: 0, splashCool: 0, zoneFlags: {},
    prevV: { x: 0, y: 0 }, ghost: [], ghostT: 0, reflect: { x: 0, y: 0 }, musicT: 0, paused: false, startRoofSet: false,
  };
  g.offers = makeOffers(g);
  return g;
}

export function upgradeLv(g: Game, id: UpgradeId) { return g.save.upgrades[id] ?? 0; }

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

export function unlockedLocs(g: Game): LocId[] {
  return LANDMARKS.filter((l) => districtOpen(g.save.delivered, l.district)).map((l) => l.id);
}

export function makeOffers(g: Game): Offer[] {
  const out: Offer[] = [];
  const d = g.save.delivered;
  const tierMax = unlockedTier(d);
  const locs = unlockedLocs(g);
  const used = new Set<PkgId>();
  const f = timeOfDay(g.clock);
  for (let n = 0; n < 3; n++) {
    // tier: the first slot is always something gentle
    let tier = 0;
    if (n > 0 && tierMax >= 1 && rnd(g) < 0.6) tier = 1;
    if (n > 1 && tierMax >= 2 && rnd(g) < 0.55) tier = 2;
    if (n === 0 && tierMax >= 1 && rnd(g) < 0.25) tier = 1;
    const pool = PACKAGES.filter((p) => p.tier === tier && !used.has(p.id));
    const def = pickOf(g, pool.length ? pool : PACKAGES.filter((p) => p.tier === 0));
    used.add(def.id);
    // sender: prefer thematic places, otherwise somewhere near the witch
    const near = [...locs].sort((a, b) => Math.abs(g.w.pads[a].x - g.p.x) - Math.abs(g.w.pads[b].x - g.p.x));
    const thematic = def.from?.filter((l) => locs.includes(l));
    const from: LocId = thematic?.length ? pickOf(g, thematic) : pickOf(g, near.slice(0, Math.min(4, near.length)));
    const far = locs.filter((l) => l !== from && Math.abs(g.w.pads[l].x - g.w.pads[from].x) > 900);
    const to: LocId = far.length ? pickOf(g, far) : pickOf(g, locs.filter((l) => l !== from));
    let customer = LOC[to].customer;
    if (to === "warehouse" && g.save.secrets.midnight && rnd(g) < 0.5) customer = "hollow";
    const dist = Math.hypot(g.w.pads[from].x - g.w.pads[to].x, g.w.pads[from].y - g.w.pads[to].y);
    const maxS = 330 + 38 * upgradeLv(g, "speed");
    const par = Math.round(dist * 1.25 / (maxS * 0.8) + 9);
    let kind = pickOf(g, def.constraints);
    if (kind === "night" && isDark(f) === false && rnd(g) < 0.5) kind = "time";
    if (customer === "hollow") kind = "night";
    const limit = kind === "melt" ? Math.round(par * 1.35 + 8) : par;
    const constraint: Constraint = { kind, text: customer === "hollow" ? "Midnight only" : CONSTRAINT_TEXT[kind], limit };
    const objKinds: ObjectiveKind[] = ["rings", "noground", "shortcut", "low", "nobirds"];
    const objective = rnd(g) < 0.45 ? (() => { const k = pickOf(g, objKinds); return { kind: k, text: OBJECTIVE_TEXT[k] }; })() : null;
    const reward = Math.round(28 + def.tier * 22 + dist / 70);
    out.push({ id: g.nextId++, pkg: def.id, from, to, customer, constraint, objective, par, dist, reward, tier: def.tier });
  }
  return out;
}

export function acceptOffer(g: Game, id: number) {
  const o = g.offers.find((x) => x.id === id);
  if (!o || (g.quest && g.quest.phase !== "result")) return;
  g.quest = {
    offer: o, phase: "pickup", t0: 0, elapsed: 0, dwell: 0, leaveT: 0, routeT: {}, routeSeq: [], lastRoute: "", routeHold: 0,
    rings: 0, groundTouches: 0, shortcut: false, thefts: 0, bumps: 0, highest: 9999, lowestUp: 0,
  };
  g.pkg = null;
  g.save.seen[o.pkg] = g.save.seen[o.pkg] ?? 0;
  toast(g, `Job accepted: collect the ${PKG[o.pkg].name} from ${LOC[o.from].name}`, "info");
  sfx(g, "chime");
}

export function abandonQuest(g: Game) {
  if (!g.quest) return;
  toast(g, "The parcel was quietly returned to sender.", "info");
  g.quest = null; g.pkg = null; g.frogs = [];
  g.offers = makeOffers(g);
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

function pickWeather(g: Game): Weather {
  const opts = WEATHERS.filter((w) => weatherOpen(g.save.delivered, w.id) && w.id !== g.weather.kind);
  const total = opts.reduce((s, w) => s + w.weight, 0);
  let r = rnd(g) * total;
  for (const w of opts) { r -= w.weight; if (r <= 0) return w.id; }
  return "clear";
}

export function setWeather(g: Game, kind: Weather, lock = false) {
  g.weather.kind = kind; g.weather.next = null; g.weather.left = rr(g, 70, 130);
  g.weather.dir = rnd(g) < 0.5 ? 1 : -1;
  g.lockWeather = lock;
  g.save.weatherSeen[kind] = true;
}

function updateWeather(g: Game, dt: number) {
  const W = g.weather;
  if (!g.lockWeather) {
    W.left -= dt;
    if (W.left < 14 && !W.next) {
      W.next = pickWeather(g);
      const hint: Record<Weather, string> = { clear: "The sky is clearing…", rain: "Clouds are gathering…", wind: "The wind is picking up…", fog: "A grey bank is rolling in…", snow: "It smells like snow…", thunder: "Distant thunder…", magic: "The air feels… fizzy." };
      toast(g, hint[W.next], "weather");
    }
    if (W.left <= 0 && W.next) { setWeather(g, W.next); sfx(g, "weather"); }
  }
  const d = WEATHER[W.kind];
  const k = Math.min(1, dt * 0.5);
  W.rain = lerp(W.rain, d.rain, k); W.snow = lerp(W.snow, d.snow, k); W.fog = lerp(W.fog, d.fog, k);
  W.storm = lerp(W.storm, d.storm, k); W.magic = lerp(W.magic, d.magic, k); W.vis = lerp(W.vis, d.vis, k);
  W.wind = lerp(W.wind, d.wind, k);
  g.save.weatherSeen[W.kind] = true;

  // lightning
  if (W.storm > 0.5) {
    g.boltT -= dt;
    if (g.boltT <= 0) {
      g.boltT = rr(g, 3.2, 6);
      const x = g.p.x + rr(g, -520, 520);
      g.bolts.push({ x, y: terrainY(x) - rr(g, 0, 80), warn: 1.1, life: 0, hostile: true, hit: false, seed: rnd(g) });
      if (rnd(g) < 0.3) g.bolts.push({ x: g.p.x + rr(g, -90, 90), y: GROUND - 20, warn: 1.1, life: 0, hostile: true, hit: false, seed: rnd(g) });
    }
  }
  // magical storm: hiccups & levity
  if (W.magic > 0.5) {
    g.pulseT -= dt;
    if (g.pulseT <= 0 && g.invertT <= 0 && g.invertWarn <= 0) { g.invertWarn = 1.3; g.pulseT = rr(g, 14, 20); toast(g, "The air hiccups…", "weather"); sfx(g, "hiccup"); }
    if (g.levity.length < 3 && rnd(g) < dt * 0.25) g.levity.push({ x: g.p.x + rr(g, -600, 600), y: rr(g, 400, GROUND - 100), r: 90, life: 11 });
  }
  if (g.invertWarn > 0) { g.invertWarn -= dt; if (g.invertWarn <= 0) g.invertT = 3; }
  if (g.invertT > 0) g.invertT -= dt;
  for (const l of g.levity) l.life -= dt;
  g.levity = g.levity.filter((l) => l.life > 0);
}

/* ------------------------------------------------------------------ */
/* Moving hazards (positions are functions of time)                    */
/* ------------------------------------------------------------------ */

export function hazards(g: Game) {
  const t = g.t, w = g.w;
  const books = w.books.map((b) => ({ x: b.cx + Math.sin(t * b.sp + b.ph) * b.ax, y: b.cy + Math.cos(t * b.sp * 0.8 + b.ph) * b.ay, r: 15, ang: t * b.sp + b.ph }));
  const cells = w.cells.map((c) => ({ x: c.cx + Math.sin(t * c.sp + c.ph) * c.ax * 3, y: c.cy + Math.sin(t * 0.7 + c.ph) * 18, r: 56 }));
  const hookA = Math.sin(t * 0.8) * 0.5;
  const hook = { x: w.crane.x - 70 + Math.sin(hookA) * 100, y: w.crane.y + 40 + Math.cos(hookA) * 100, r: 16, ax: w.crane.x - 70, ay: w.crane.y + 6 };
  return { books, cells, hook };
}
export function flockPos(g: Game, f: Flock) {
  const d = g.w.flocks[f.i];
  return { x: d.cx + Math.sin(g.t * d.sp + d.ph) * d.ax, y: d.cy + Math.sin(g.t * d.sp * 1.7 + d.ph) * d.ay };
}

/* ------------------------------------------------------------------ */
/* Flight                                                              */
/* ------------------------------------------------------------------ */

function pkgMass(g: Game): number {
  const pk = g.pkg;
  if (!pk || pk.stolen > 0) return 0;
  let m = pk.def.mass;
  if (pk.def.id === "bigbox") m += (pk.s.size ?? 1) * 1.5;
  if (pk.def.id === "ocean") m += 1;
  return m;
}
export function playerRadius(g: Game) {
  const pk = g.pkg;
  return pk && pk.def.id === "bigbox" && pk.stolen <= 0 ? 15 + ((pk.s.size ?? 1) - 1) * 8 : 15;
}

function doFlourish(g: Game) {
  const p = g.p;
  p.flourishCd = 3.2; p.flourishT = 0.55; p.vy -= 110;
  sfx(g, "chime");
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * 6.283;
    spawnPart(g, { x: p.x, y: p.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 0.6, size: 3, kind: "spark", color: "#ffe9a8" });
  }
  const pk = g.pkg;
  if (pk && pk.stolen <= 0) {
    pk.s.agit = Math.max(0, (pk.s.agit ?? 0) - 0.5);
    if (pk.def.id === "cake") pk.s.flip = (pk.s.flip ?? 0) + 1;
    if (pk.def.id === "sleepcloud") pk.s.hush = (pk.s.hush ?? 0) + 1;
  }
  // call the frogs back, shoo the birds
  for (const fr of g.frogs) {
    const d = Math.hypot(fr.x - p.x, fr.y - p.y);
    if (d < 240) { fr.vx = (p.x - fr.x) * 2.2; fr.vy = (p.y - fr.y) * 2.2 - 40; fr.life = Math.max(fr.life, 2); }
  }
  for (const f of g.flocks) {
    if (Math.hypot(f.x - p.x, f.y - p.y) < 200) {
      f.scare = 5; f.cool = 12;
      if (f.hasPkg) { f.hasPkg = false; if (g.pkg) { g.pkg.stolen = 0; toast(g, "Shoo! The birds dropped it — got it back.", "good"); } }
    }
  }
}

function bump(g: Game, impact: number, nx: number, ny: number) {
  const p = g.p;
  if (p.invuln > 0) return;
  p.invuln = 0.35;
  const stab = upgradeLv(g, "stability");
  burst(g, p.x - nx * p.rad, p.y - ny * p.rad, 6, "star", "#ffe28a", 110, 0.5, 3);
  sfx(g, "bonk", p.x, clamp(impact / 400));
  g.shake = Math.max(g.shake, clamp(impact / 40, 0, 9));
  if (g.quest?.phase === "carry") g.quest.bumps++;
  const pk = g.pkg;
  if (pk && pk.stolen <= 0) {
    pk.s.bump = (pk.s.bump ?? 0) + 1;
    pk.s.agit = (pk.s.agit ?? 0) + (impact / 450) * (1 - 0.2 * stab);
    if (impact > 280) { p.tumble = 0.5; if (pk.def.id === "cake") pk.s.flip = (pk.s.flip ?? 0) + 1; }
  }
}

function stunPlayer(g: Game, t: number) {
  if (g.p.stun > 0) return;
  g.p.stun = t; g.p.tumble = Math.max(g.p.tumble, t);
  burst(g, g.p.x, g.p.y, 12, "spark", "#cfe0ff", 200, 0.5, 3);
  sfx(g, "zap");
  if (g.pkg) g.pkg.s.agit = (g.pkg.s.agit ?? 0) + 0.3;
}

function flight(g: Game, dt: number) {
  const p = g.p;
  const L = (id: UpgradeId) => upgradeLv(g, id);
  const maxS = 330 + 38 * L("speed"), acc = 950 + 170 * L("accel"), glide = L("glide");
  let ix = g.input.x, iy = g.input.y, wantBoost = g.input.boost;
  if (g.pkg?.def.id === "yesterday" && g.pkg.stolen <= 0) {
    g.queue.push({ t: g.t, x: ix, y: iy, boost: wantBoost });
    while (g.queue.length > 1 && g.queue[1].t <= g.t - 0.28) g.queue.shift();
    const q = g.queue[0]; ix = q.x; iy = q.y; wantBoost = q.boost;
  } else g.queue.length = 0;
  if (g.invertT > 0) { ix = -ix; iy = -iy; }
  if (p.stun > 0) { ix = 0; iy = 0; wantBoost = false; p.stun -= dt; }
  const m = Math.hypot(ix, iy);
  if (m > 1) { ix /= m; iy /= m; }
  const boosting = wantBoost && !p.boostLock && p.boost > 0;
  if (boosting && m < 0.05) { ix = p.face * 0.9; iy = 0; }
  const flying = m > 0.05 || boosting;
  // boost tank
  const cap = 100 + 18 * L("boost");
  if (boosting) { p.boost = Math.max(0, p.boost - 30 * dt); p.boostIdle = 0.5; if (p.boost <= 0) p.boostLock = true; }
  else { p.boostIdle -= dt; if (p.boostIdle <= 0) p.boost = Math.min(cap, p.boost + (18 + 5 * L("boost")) * dt); if (p.boostLock && p.boost > 25) p.boostLock = false; }
  if (p.boost > cap) p.boost = cap;
  const mass = pkgMass(g);
  const sp = maxS * (boosting ? 1.75 : 1) * (g.weather.snow > 0.5 ? 0.93 : 1);
  const a = (acc * (boosting ? 1.6 : 1)) / (1 + mass * 0.07);
  if (flying) {
    let dvx = ix * sp - p.vx, dvy = iy * sp - p.vy;
    const dl = Math.hypot(dvx, dvy), st = a * dt;
    if (dl > st) { dvx *= st / dl; dvy *= st / dl; }
    p.vx += dvx; p.vy += dvy;
  } else {
    const dr = g.weather.snow > 0.5 ? 1.2 : 0.9;
    p.vx *= Math.exp(-dr * dt); p.vy *= Math.exp(-0.5 * dt);
    const lift = (150 + 60 * glide) * clamp(Math.abs(p.vx) / maxS);
    p.vy += (240 - lift) * dt;
    const capV = 290 - 70 * glide;
    if (p.vy > capV) p.vy = lerp(p.vy, capV, Math.min(1, 5 * dt));
  }
  if (boosting && g.t % 0.05 < dt) spawnPart(g, { x: p.x - p.face * 18, y: p.y + 8, vx: -p.vx * 0.2 + rr(g, -30, 30), vy: rr(g, -20, 20), life: 0.45, size: 5, kind: "trail", color: "#ffd47a" });
  if (boosting) { g.shake = Math.max(g.shake, 1.2); }
  // a flourish
  if (g.input.flourish && !g.flourishPrev && p.flourishCd <= 0 && p.stun <= 0) doFlourish(g);
  g.flourishPrev = g.input.flourish;
  p.flourishCd = Math.max(0, p.flourishCd - dt); p.flourishT = Math.max(0, p.flourishT - dt);
  p.invuln = Math.max(0, p.invuln - dt); p.tumble = Math.max(0, p.tumble - dt); p.hatT = Math.max(0, p.hatT - dt);
  if (p.hatT <= 0) p.hat = "";
  if (Math.abs(p.vx) > 25) p.face = p.vx > 0 ? 1 : -1;
}

function forces(g: Game, dt: number) {
  const p = g.p, w = g.w;
  const maxS = 330 + 38 * upgradeLv(g, "speed");
  const stab = upgradeLv(g, "stability");
  const under = p.y > GROUND + 10 && inTunnelX(p.x);
  const pk = g.pkg && g.pkg.stolen <= 0 ? g.pkg : null;
  g.zoneFlags.windtunnel = 0;
  if (!under) {
    const dist = districtAt(p.x);
    const alt = 0.6 + 0.8 * clamp((GROUND - p.y) / 700, 0, 1);
    const gust = 1 + 0.4 * Math.sin(g.t * 0.7 + p.x * 0.002);
    let wv = g.weather.wind * g.weather.dir * dist.wind * alt * gust * (1 - 0.2 * stab);
    if (pk?.def.id === "clothes") wv *= 1.35;
    if (pk?.def.id === "umbrella" && (pk.s.open ?? 0) > 0.5) wv *= 1.6;
    wv = clamp(wv, -maxS * 0.5, maxS * 0.5);
    let jet = 0;
    if (p.y < 300 && g.weather.kind !== "thunder" && g.weather.kind !== "fog") jet = 120;
    p.windV = wv + jet;
    p.x += (wv + jet) * dt;
    if (jet) g.zoneFlags.cloud = g.t;
    for (const z of w.windTunnels) if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) {
      p.vx = Math.min(p.vx + 1500 * dt, maxS * 1.9); g.zoneFlags.windtunnel = g.t;
      if (g.t % 0.06 < dt) spawnPart(g, { x: p.x - 40, y: p.y + rr(g, -30, 30), vx: 300, vy: rr(g, -20, 20), life: 0.6, size: 4, kind: "leaf", color: "#8fc46a" });
    }
    for (const z of w.updrafts) if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) {
      p.vy = Math.max(p.vy - 520 * dt, -300);
      if (g.t % 0.1 < dt) spawnPart(g, { x: p.x + rr(g, -30, 30), y: p.y + 30, vx: 0, vy: -140, life: 0.8, size: 3, kind: "leaf", color: "#d8e8c8" });
    }
    for (const z of w.drags) if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) { p.vx *= Math.exp(-2.4 * dt); p.vy *= Math.exp(-2.4 * dt); }
    if (g.weather.storm > 0.5 && p.y < 500) p.vy += Math.sin(g.t * 3.1 + p.x * 0.01) * 110 * dt;
    for (const l of g.levity) if (Math.hypot(p.x - l.x, p.y - l.y) < l.r) p.vy -= 450 * dt;
  } else p.windV = 0;
}

function circleRect(g: Game, r: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  const p = g.p;
  const cx = clamp(p.x, rect.x, rect.x + rect.w), cy = clamp(p.y, rect.y, rect.y + rect.h);
  let dx = p.x - cx, dy = p.y - cy;
  let d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 0.0001) {
    // centre is inside the rect: push out through the nearest face
    const l = p.x - rect.x, rgt = rect.x + rect.w - p.x, t = p.y - rect.y, b = rect.y + rect.h - p.y;
    const m = Math.min(l, rgt, t, b);
    dx = m === l ? -1 : m === rgt ? 1 : 0; dy = m === t ? -1 : m === b ? 1 : 0;
    d = 0; p.x += dx * (m + r); p.y += dy * (m + r);
  } else { const push = r - d; p.x += (dx / d) * push; p.y += (dy / d) * push; dx /= d; dy /= d; }
  const vn = p.vx * dx + p.vy * dy;
  if (vn < 0) {
    p.vx -= 1.2 * vn * dx; p.vy -= 1.2 * vn * dy;
    p.vx *= 0.97; p.vy *= 0.97;
    if (-vn > 130) bump(g, -vn, dx, dy);
  }
  return true;
}

function collide(g: Game, dt: number) {
  const p = g.p, w = g.w;
  const r = (p.rad = playerRadius(g));
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.x < r) { p.x = r; if (p.vx < 0) p.vx = -p.vx * 0.3; }
  if (p.x > WORLD_W - r) { p.x = WORLD_W - r; if (p.vx > 0) p.vx = -p.vx * 0.3; }
  if (p.y < r + 8) { p.y = r + 8; p.vy = Math.max(p.vy, 0); }
  for (const s of solidsNear(w, p.x - r - 6, p.x + r + 6)) circleRect(g, r, s);
  // the ground, or the water
  const was = p.onGround;
  p.onGround = false; p.inWater = false;
  if (!inTunnelX(p.x)) {
    const ty = terrainY(p.x);
    if (p.y + r > ty) {
      const water = isWaterX(p.x);
      const impact = p.vy;
      p.y = ty - r;
      if (p.vy > 0) {
        if (impact > 190) bump(g, impact, 0, -1);
        p.vy = water ? Math.min(0, p.vy * -0.1) : p.vy * -0.12;
      }
      p.vx *= water ? 0.96 : 0.9;
      p.onGround = !water; p.inWater = water;
      if (water && g.splashCool <= 0) {
        g.splashCool = 0.8;
        burst(g, p.x, ty, 10, "splash", "#bfe0f5", 150, 0.6, 3);
        sfx(g, "splash", p.x, clamp(Math.abs(p.speed) / 400));
        if (g.pkg && g.pkg.stolen <= 0) g.pkg.s.wet = clamp((g.pkg.s.wet ?? 0) + 0.35);
      }
      if (!was && g.quest?.phase === "carry") g.quest.groundTouches++;
    }
  } else if (p.y > GROUND + 5) {
    // underground lantern light
  }
  g.splashCool = Math.max(0, g.splashCool - dt);
}

/* ------------------------------------------------------------------ */
/* Shortcuts, rings, hazards                                           */
/* ------------------------------------------------------------------ */

function markShortcut(g: Game, key: string, label: string) {
  if (g.quest?.phase === "carry") {
    g.quest.shortcut = true;
    pushRoute(g.quest, label, true);
  }
  if (!g.save.shortcuts[key]) { g.save.shortcuts[key] = true; toast(g, `Shortcut found: ${label}`, "good"); sfx(g, "discover"); }
}

function features(g: Game, dt: number) {
  const p = g.p, w = g.w;
  g.portalCool = Math.max(0, g.portalCool - dt);
  g.fountainCool = Math.max(0, g.fountainCool - dt);
  for (const k in g.ringCool) g.ringCool[k] = Math.max(0, g.ringCool[k] - dt);
  // chimney portals
  if (g.portalCool <= 0) {
    for (const po of w.portals) {
      if (Math.hypot(p.x - po.x, p.y - (po.mouthY + 12)) < 26 && p.vy > -60) {
        if (g.pkg?.def.id === "bigbox" && (g.pkg.s.size ?? 1) > 1.6) { toast(g, "It's far too big for the chimney.", "info"); g.portalCool = 2; break; }
        const to = w.portals.find((x) => x.id === po.to)!;
        burst(g, po.x, po.mouthY, 18, "smoke", "#b79cf0", 120, 0.8, 6);
        p.x = to.x; p.y = to.mouthY - 26; p.vx = 0; p.vy = -330; p.invuln = 0.6; g.portalCool = 1.8;
        burst(g, to.x, to.mouthY, 18, "smoke", "#b79cf0", 120, 0.8, 6);
        sfx(g, "whoosh"); g.shake = 4;
        markShortcut(g, "chimney", "the Great Chimneys");
        g.cam.x = p.x; g.cam.y = p.y;
        break;
      }
    }
  }
  // clocktower
  const h = w.towerHole;
  if (p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) { if (g.t - (g.zoneFlags.clock ?? -9) > 4) { markShortcut(g, "clock", "through the Clocktower"); } g.zoneFlags.clock = g.t; }
  if (g.zoneFlags.windtunnel && g.t - g.zoneFlags.windtunnel < 0.1 && g.t - (g.zoneFlags.wtmark ?? -9) > 6) { g.zoneFlags.wtmark = g.t; markShortcut(g, "windtunnel", "the Witch Path wind tunnel"); }
  if (p.y > GROUND + 20 && inTunnelX(p.x) && g.t - (g.zoneFlags.tun ?? -9) > 6) { g.zoneFlags.tun = g.t; markShortcut(g, "tunnel", "the underground tunnels"); }
  if (g.zoneFlags.cloud && g.t - g.zoneFlags.cloud < 0.1 && g.t - (g.zoneFlags.cmark ?? -9) > 8) { g.zoneFlags.cmark = g.t; if (g.quest?.phase === "carry") g.quest.shortcut = true; }
  // fountain
  const f = w.fountain;
  if (g.fountainCool <= 0 && p.x > f.x - 10 && p.x < f.x + f.w + 10 && p.y + p.rad > f.y) {
    g.fountainCool = 2;
    burst(g, p.x, f.y, 16, "splash", "#bfe0f5", 170, 0.7, 3);
    p.vy = -160; sfx(g, "splash");
    if (g.pkg && g.pkg.stolen <= 0) g.pkg.s.wet = clamp((g.pkg.s.wet ?? 0) + 0.5);
    toast(g, "Splash! You landed in the fountain.", "fun");
    g.zoneFlags.fountain = 1;
  }
  // rings
  for (const r of w.rings) {
    if ((g.ringCool[r.id] ?? 0) > 0) continue;
    if (Math.hypot(p.x - r.x, p.y - r.y) < r.r * 0.72 + 4) {
      g.ringCool[r.id] = 4;
      const full = upgradeLv(g, "boost") >= 3;
      p.boost = full ? 100 + 18 * upgradeLv(g, "boost") : Math.min(100 + 18 * upgradeLv(g, "boost"), p.boost + 40);
      p.boostLock = false;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      p.vx += (p.vx / sp) * 140; p.vy += (p.vy / sp) * 140;
      burst(g, r.x, r.y, 20, "spark", "#fff3b0", 220, 0.7, 3);
      sfx(g, "ring");
      if (g.quest?.phase === "carry") g.quest.rings++;
      if (r.lane && !g.save.secrets.cloudlane) discoverSecret(g, "cloudlane");
    }
  }
  // moving hazards
  const hz = hazards(g);
  for (const b of hz.books) if (Math.hypot(p.x - b.x, p.y - b.y) < p.rad + b.r) {
    const d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
    p.vx += ((p.x - b.x) / d) * 260; p.vy += ((p.y - b.y) / d) * 260;
    bump(g, 220, (b.x - p.x) / d, (b.y - p.y) / d);
    burst(g, b.x, b.y, 6, "paper", "#f5ecd0", 130, 0.9, 4);
  }
  for (const c of hz.cells) if (Math.hypot(p.x - c.x, p.y - c.y) < p.rad + c.r - 8) { stunPlayer(g, 0.7); p.vy += 120; }
  if (Math.hypot(p.x - hz.hook.x, p.y - hz.hook.y) < p.rad + hz.hook.r) {
    const d = Math.hypot(p.x - hz.hook.x, p.y - hz.hook.y) || 1;
    p.vx += ((p.x - hz.hook.x) / d) * 300; p.vy += ((p.y - hz.hook.y) / d) * 300;
    bump(g, 260, (hz.hook.x - p.x) / d, (hz.hook.y - p.y) / d);
  }
}

/* ------------------------------------------------------------------ */
/* Birds, frogs, lightning                                             */
/* ------------------------------------------------------------------ */

function birds(g: Game, dt: number) {
  const p = g.p;
  const pk = g.pkg;
  const carrying = !!pk && g.quest?.phase === "carry";
  for (const f of g.flocks) {
    const home = flockPos(g, f);
    f.cool = Math.max(0, f.cool - dt); f.scare = Math.max(0, f.scare - dt);
    let tx = home.x, ty = home.y, sp = 140;
    const dP = Math.hypot(p.x - f.x, p.y - f.y);
    const radius = pk?.def.id === "teapot" ? 560 : 300;
    if (f.hasPkg) {
      // flee with the loot
      tx = f.x + (f.x - p.x) * 2 + 200; ty = Math.max(120, f.y - 160); sp = 170;
      if (pk) { pk.x = f.x; pk.y = f.y + 14; pk.stolen -= dt; }
      if (dP < 34) { f.hasPkg = false; if (pk) { pk.stolen = 0; toast(g, "Got it back!", "good"); sfx(g, "chime"); } }
      else if (pk && pk.stolen <= 0) { f.hasPkg = false; toast(g, "The birds got bored and dropped it back in your satchel.", "fun"); }
    } else if (f.scare > 0) { tx = f.x + (f.x - p.x) * 3; ty = f.y - 120; sp = 220; }
    else if (carrying && !pk!.stolen && f.cool <= 0 && g.weather.storm < 0.5 && dP < radius && !(pk!.def.id === "storm")) {
      tx = p.x; ty = p.y; sp = (330 + 38 * upgradeLv(g, "speed")) * 0.72;
      if (dP < 32 + 6 && p.invuln <= 0.1) {
        f.hasPkg = true; pk!.stolen = 6.5; f.cool = 14;
        g.quest!.thefts++;
        toast(g, "A flock of birds snatched your package!", "fun"); sfx(g, "birds");
        burst(g, f.x, f.y, 10, "feather", "#2a2a35", 120, 0.9, 3);
      }
    }
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 30);
    f.vx = lerp(f.vx, (dx / d) * sp * k, Math.min(1, dt * 4)); f.vy = lerp(f.vy, (dy / d) * sp * k, Math.min(1, dt * 4));
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.y = clamp(f.y, 60, GROUND - 30);
  }
}

function frogsStep(g: Game, dt: number) {
  const p = g.p;
  for (const fr of g.frogs) {
    fr.life -= dt; fr.vy += 380 * dt; fr.x += fr.vx * dt; fr.y += fr.vy * dt; fr.vx *= Math.exp(-0.3 * dt);
    if (Math.hypot(fr.x - p.x, fr.y - p.y) < p.rad + 14 && g.pkg) {
      fr.life = 0; g.pkg.s.frogs = (g.pkg.s.frogs ?? 0) + 1;
      toast(g, "Caught a frog!", "good"); sfx(g, "ribbit"); burst(g, fr.x, fr.y, 6, "spark", "#b8f08a", 90, 0.4, 2);
    } else if (fr.y > terrainY(fr.x) - 6) {
      fr.life = 0;
      if (g.pkg) g.pkg.s.lost = (g.pkg.s.lost ?? 0) + 1;
      burst(g, fr.x, fr.y, 5, "splash", "#9ad46a", 80, 0.4, 2); sfx(g, "ribbit", fr.x, 0.5);
    }
  }
  g.frogs = g.frogs.filter((f) => f.life > 0);
}

function bolts(g: Game, dt: number) {
  for (const b of g.bolts) {
    if (b.warn > 0) { b.warn -= dt; if (b.warn <= 0) { b.life = 0.22; sfx(g, "thunder", b.x); g.shake = Math.max(g.shake, 5); } continue; }
    if (b.life > 0) {
      if (!b.hit) {
        b.hit = true;
        if (b.hostile && Math.abs(g.p.x - b.x) < 36 && g.p.y < b.y + 30) stunPlayer(g, 0.9);
        for (const f of g.flocks) if (Math.hypot(f.x - b.x, f.y - b.y) < 220) { f.scare = 5; f.cool = 10; }
        burst(g, b.x, b.y, 10, "spark", "#e8f0ff", 180, 0.4, 3);
      }
      b.life -= dt;
    }
  }
  g.bolts = g.bolts.filter((b) => b.warn > 0 || b.life > 0);
}

function particles(g: Game, dt: number) {
  for (const q of g.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind === "smoke" || q.kind === "trail") { q.vx *= Math.exp(-1.5 * dt); q.vy *= Math.exp(-1.5 * dt); }
    else if (q.kind === "splash" || q.kind === "feather" || q.kind === "paper" || q.kind === "star") q.vy += 260 * dt;
    else if (q.kind === "note") { q.vy -= 10 * dt; q.vx += Math.sin(q.life * 6) * 20 * dt; }
    q.rot += dt * 3;
  }
  g.parts = g.parts.filter((q) => q.life > 0);
}

/* ------------------------------------------------------------------ */
/* Packages: each one is its own small piece of gameplay               */
/* ------------------------------------------------------------------ */

function createPkg(g: Game, def: PackageDef): Pkg {
  const s: Record<string, number> = { wet: 0, maxWet: 0, bump: 0, flip: 0, agit: 0 };
  switch (def.id) {
    case "frogs": s.frogs = 6; s.lost = 0; s.esc = 7; break;
    case "sleepcloud": s.agit = 0.1; break;
    case "egg": s.warm = 0.45; s.wiggle = 6; break;
    case "ocean": s.slosh = 0; s.sv = 0; s.vol = 1; break;
    case "bigbox": s.size = 1; break;
    case "reflection": s.rx = -90; s.ry = -30; break;
    case "storm": s.zapT = 2.5; s.zaps = 0; break;
  }
  return { def, s, stolen: 0, x: g.p.x, y: g.p.y };
}

export function pkgCond(pk: Pkg): number {
  const s = pk.s, b = s.bump ?? 0, mw = s.maxWet ?? 0;
  switch (pk.def.id) {
    case "letter": return 1 - 0.6 * mw;
    case "book": return clamp(1 - 0.04 * b - 0.35 * mw, 0.3, 1);
    case "flowers": return clamp(1 - 0.65 * (s.wilt ?? 0) - 0.04 * b, 0.15, 1);
    case "cake": return clamp(1 - 0.75 * (s.melt ?? 0) - 0.04 * b - ((s.flip ?? 0) % 2 ? 0.25 : 0), 0.1, 1);
    case "clothes": return 1 - 0.5 * mw;
    case "gift": return clamp(1 - 0.16 * b, 0.4, 1);
    case "potion": return clamp(1 - 0.25 * (s.fizz ?? 0), 0.25, 1);
    case "teapot": return clamp(1 - 0.55 * mw - 0.03 * b, 0.3, 1);
    case "sleepcloud": return clamp(1 - 0.04 * (s.awakeT ?? 0), 0.2, 1);
    case "umbrella": return clamp(1 - 0.04 * b, 0.5, 1);
    case "frogs": return clamp((s.frogs ?? 0) / 6, 0.15, 1);
    case "storm": return clamp(1 - 0.1 * (s.zaps ?? 0), 0.5, 1);
    case "egg": return s.hatched ? 0.4 : (s.warm ?? 0.5) < 0.12 ? 0.6 : 1;
    case "moonlight": return clamp(1 - (s.fade ?? 0) * 1.1, 0.2, 1);
    case "homesick": return clamp(1 - 0.015 * (s.tugs ?? 0), 0.5, 1);
    case "shadow": return clamp(1 - (s.thin ?? 0), 0.4, 1);
    case "ocean": return clamp(s.vol ?? 1, 0.1, 1);
    case "reflection": return clamp(1 - 0.004 * (s.far ?? 0), 0.5, 1);
    default: return clamp(1 - 0.04 * b, 0.5, 1);
  }
}

export interface Gauge { label: string; value: number; text: string }
export function pkgGauge(pk: Pkg): Gauge | null {
  const s = pk.s;
  const words = (v: number, a: string[]) => a[Math.min(a.length - 1, Math.floor(clamp(v) * a.length))];
  switch (pk.def.id) {
    case "letter": case "clothes": case "teapot": return { label: "Dry", value: 1 - (s.wet ?? 0), text: words(1 - (s.wet ?? 0), ["soaked", "damp", "dry", "dry"]) };
    case "book": case "gift": case "umbrella": case "bigbox": return { label: "Condition", value: pkgCond(pk), text: words(pkgCond(pk), ["battered", "scuffed", "fine", "pristine"]) };
    case "flowers": return { label: "Fresh", value: 1 - (s.wilt ?? 0), text: words(1 - (s.wilt ?? 0), ["wilting", "tired", "perky", "blooming"]) };
    case "cake": return { label: "Cake", value: 1 - (s.melt ?? 0), text: (s.flip ?? 0) % 2 ? "upside down" : words(1 - (s.melt ?? 0), ["puddle", "drooping", "firm", "perfect"]) };
    case "potion": case "sleepcloud": { const c = 1 - clamp(s.agit ?? 0); return { label: "Calm", value: c, text: pk.def.id === "sleepcloud" && s.awake ? "awake and grumpy" : words(c, ["fizzing", "restless", "settled", "serene"]) }; }
    case "frogs": return { label: "Frogs", value: (s.frogs ?? 0) / 6, text: `${s.frogs ?? 0} of 6` };
    case "storm": return { label: "Charge", value: 1, text: "crackling" };
    case "egg": return { label: "Warmth", value: s.hatched ? 1 : s.warm ?? 0, text: s.hatched ? "hatched!" : words(s.warm ?? 0, ["chilly", "cosy", "warm", "too warm"]) };
    case "moonlight": return { label: "Glow", value: 1 - (s.fade ?? 0), text: words(1 - (s.fade ?? 0), ["faded", "dim", "soft", "bright"]) };
    case "homesick": return { label: "Tugging", value: 1, text: "wants to go home" };
    case "ocean": return { label: "Ocean", value: s.vol ?? 1, text: `${Math.round((s.vol ?? 1) * 100)}% left` };
    case "shadow": return { label: "Shadow", value: 1 - (s.thin ?? 0), text: words(1 - (s.thin ?? 0), ["wispy", "thin", "solid", "solid"]) };
    case "refuse": return { label: "Cloud", value: 1, text: "has opinions" };
    case "bigbox": return { label: "Size", value: 1 - ((s.size ?? 1) - 1) / 2, text: `${(s.size ?? 1).toFixed(1)}×` };
    default: return null;
  }
}

function updatePkg(g: Game, dt: number) {
  const pk = g.pkg, q = g.quest;
  if (!pk || !q || q.phase !== "carry") return;
  if (pk.stolen > 0) return;
  const p = g.p, s = pk.s, id = pk.def.id;
  pk.x = p.x; pk.y = p.y + 14;
  const under = p.y > GROUND + 10 && inTunnelX(p.x);
  const f = timeOfDay(g.clock), sun = lightLevel(f);
  const ax = (p.vx - g.prevV.x) / Math.max(dt, 1e-3), ay = (p.vy - g.prevV.y) / Math.max(dt, 1e-3);
  p.shake = lerp(p.shake, clamp((Math.hypot(ax, ay) - 350) / 1100, 0, 1), Math.min(1, dt * 6));
  const calm = 1 - 0.2 * upgradeLv(g, "stability");
  const wetter = id !== "umbrella" && id !== "storm" && id !== "ocean";
  if (!under && wetter) s.wet = clamp(s.wet + (g.weather.rain * 0.05 + g.weather.snow * 0.02) * dt);
  s.wet = clamp(s.wet - 0.01 * dt);
  s.maxWet = Math.max(s.maxWet, s.wet);
  const par = q.offer.par;
  switch (id) {
    case "flowers": s.wilt = clamp((s.wilt ?? 0) + (dt / Math.max(30, par * 1.7)) * (1 - 0.7 * clamp(g.weather.rain)) , 0, 1); break;
    case "cake": {
      const hot = under ? 0.2 : g.weather.kind === "clear" || g.weather.kind === "wind" ? 0.3 + sun * 0.8 : 0.2;
      s.melt = clamp((s.melt ?? 0) + (dt * (0.45 + hot)) / Math.max(20, q.offer.constraint.limit), 0, 1);
      break;
    }
    case "potion": {
      s.agit += p.shake * dt * 1.7 * calm; s.agit = Math.max(0, s.agit - 0.12 * dt);
      if (s.agit > 1) { s.fizz = (s.fizz ?? 0) + 1; s.agit = 0.3; p.hat = "#7ad88a"; p.hatT = 12; burst(g, p.x, p.y, 16, "spark", "#7ad88a", 160, 0.8, 4); sfx(g, "fizz"); toast(g, "Fizz! The potion bubbled over — your hat is now green.", "fun"); }
      break;
    }
    case "teapot": {
      s.sing = s.wet < 0.45 ? 1 : 0;
      g.musicT -= dt;
      if (s.sing && g.musicT <= 0) { g.musicT = 0.55; spawnPart(g, { x: p.x + p.face * 10, y: p.y - 16, vx: rr(g, -20, 20), vy: -50, life: 1.6, size: 6, kind: "note", color: ["#ffd47a", "#ff9ab8", "#9ad8ff"][Math.floor(rnd(g) * 3)] }); }
      break;
    }
    case "sleepcloud": {
      s.agit += p.shake * dt * 1.5 * calm; s.agit = Math.max(0, s.agit - 0.1 * dt);
      if (!s.awake && s.agit > 1) { s.awake = 1; toast(g, "The cloud woke up. It is not happy.", "fun"); sfx(g, "rumble"); }
      if (s.awake) {
        s.awakeT = (s.awakeT ?? 0) + dt; p.vy -= 70 * dt; s.wet = clamp(s.wet + 0.03 * dt);
        if (g.t % 0.07 < dt) spawnPart(g, { x: p.x + rr(g, -10, 10), y: p.y + 20, vx: 0, vy: 160, life: 0.7, size: 2, kind: "rain", color: "#bcd4ff" });
        if (s.agit < 0.3) { s.awake = 0; toast(g, "It drifted back to sleep.", "good"); }
      }
      break;
    }
    case "umbrella": {
      const open = !under && g.weather.rain > 0.25 ? 1 : 0;
      s.open = lerp(s.open ?? 0, open, Math.min(1, dt * 2.5));
      if ((s.open ?? 0) > 0.5) { p.vx *= Math.exp(-0.5 * dt); p.vy -= 45 * dt; if (!s.noticed) { s.noticed = 1; toast(g, "Something just opened above you. It's… an umbrella.", "fun"); } }
      break;
    }
    case "frogs": {
      s.esc -= dt;
      if (s.esc <= 0 && (s.frogs ?? 0) > 0) {
        s.esc = rr(g, 8, 13); s.frogs--;
        g.frogs.push({ x: p.x, y: p.y + 6, vx: -p.face * rr(g, 60, 140), vy: -rr(g, 130, 230), life: 6 });
        toast(g, "A frog made a break for it!", "fun"); sfx(g, "ribbit");
      }
      break;
    }
    case "storm": {
      s.zapT -= dt;
      if (s.zapT <= 0) {
        s.zapT = rr(g, 3, 6);
        const side = rnd(g) < 0.5 ? -1 : 1;
        g.bolts.push({ x: p.x + side * rr(g, 60, 200), y: Math.min(terrainY(p.x), p.y + rr(g, 60, 220)), warn: 0.35, life: 0, hostile: false, hit: false, seed: rnd(g) });
        if (rnd(g) < 0.08) { s.zaps = (s.zaps ?? 0) + 1; stunPlayer(g, 0.4); toast(g, "Static shock!", "fun"); }
      }
      if (g.t % 0.09 < dt) spawnPart(g, { x: p.x + rr(g, -14, 14), y: p.y - 18, vx: rr(g, -20, 20), vy: 140, life: 0.5, size: 2, kind: "rain", color: "#aabbe8" });
      break;
    }
    case "egg": {
      const sp = Math.hypot(p.vx, p.vy) / 330;
      s.warm = clamp((s.warm ?? 0.45) + dt * (0.014 * sp ** 1.5 + 0.004 * (sun > 0.6 ? 1 : 0) - 0.004 - 0.02 * g.weather.rain - 0.012 * g.weather.snow - 0.006 * g.weather.fog), 0, 1.01);
      if (!s.hatched && s.warm >= 1) { s.hatched = 1; toast(g, "It hatched! A tiny dragon is now sitting on your hat.", "fun"); sfx(g, "chirp"); burst(g, p.x, p.y, 20, "spark", "#ffb06a", 200, 0.8, 3); }
      s.wiggle -= dt;
      if (s.wiggle <= 0 && !s.hatched) { s.wiggle = rr(g, 6, 10); if (s.warm > 0.55) { p.vx += rr(g, -110, 110); p.vy += rr(g, -80, 40); toast(g, "The egg wiggled.", "fun"); sfx(g, "thump"); } }
      break;
    }
    case "moonlight": s.fade = clamp((s.fade ?? 0) + dt * (sun > 0.7 ? 0.012 : -0.003), 0, 0.85); break;
    case "homesick": {
      const origin = g.w.pads[q.offer.from], dest = g.w.pads[q.offer.to];
      const total = Math.hypot(origin.x - dest.x, origin.y - dest.y) || 1;
      const prog = 1 - clamp(Math.hypot(p.x - dest.x, p.y - dest.y) / total);
      const dx = origin.x - p.x, dy = origin.y - p.y, d = Math.hypot(dx, dy) || 1;
      const pulse = 1 + 0.8 * Math.max(0, Math.sin(g.t * 1.3));
      const pull = (70 + 70 * prog) * pulse * calm;
      p.vx += (dx / d) * pull * dt; p.vy += (dy / d) * pull * dt * 0.5;
      s.tugs = (s.tugs ?? 0) + dt * 0.4 * pulse * (g.input.x || g.input.y ? 0.4 : 1);
      break;
    }
    case "dream": p.vx += Math.sin(g.t * 0.9) * 90 * dt; p.vy += Math.cos(g.t * 0.7) * 70 * dt; break;
    case "shadow": {
      const h = GROUND - p.y;
      p.vy += clamp(h / 500, 0, 1.2) * 170 * dt;
      if (p.y < 500) s.thin = clamp((s.thin ?? 0) + dt * 0.012, 0, 1);
      break;
    }
    case "yesterday": {
      g.ghostT -= dt;
      if (g.ghostT <= 0) { g.ghostT = 0.08; g.ghost.push({ x: p.x, y: p.y }); if (g.ghost.length > 26) g.ghost.shift(); }
      break;
    }
    case "ocean": {
      s.sv += (-ax * 0.0009 - 14 * s.slosh - 2.4 * s.sv) * dt; s.slosh += s.sv * dt;
      if (Math.abs(s.slosh) > 0.85) {
        s.vol = Math.max(0, (s.vol ?? 1) - 0.1); s.slosh *= 0.5; s.sv *= -0.5;
        burst(g, p.x, p.y + 6, 8, "splash", "#6aa8e8", 120, 0.6, 3); sfx(g, "splash", p.x, 0.5);
        if (!s.spillMsg) { s.spillMsg = 1; toast(g, "Sploosh — some of the ocean got out.", "fun"); }
      }
      break;
    }
    case "reflection": {
      const ox = s.rx, oy = s.ry;
      s.rx += (-p.vx * 0.6 - ox * 1.1) * dt; s.ry += (-p.vy * 0.4 - oy * 1.1) * dt;
      const m = Math.hypot(s.rx, s.ry);
      if (m > 220) { s.rx *= 220 / m; s.ry *= 220 / m; }
      p.vx += s.rx * 1.2 * dt; p.vy += s.ry * 1.2 * dt;
      if (m > 170) s.far = (s.far ?? 0) + dt;
      break;
    }
    case "refuse": {
      const dest = g.w.pads[q.offer.to];
      const inPad = Math.hypot(p.x - dest.x, p.y - dest.y) < dest.r + 40;
      const dir = p.x < dest.x ? -1 : 1;
      p.vx += dir * (95 + (inPad ? 120 : 0)) * dt * calm; p.vy += Math.sin(g.t * 1.7) * 40 * dt;
      break;
    }
    case "bigbox": {
      const sp = Math.hypot(p.vx, p.vy);
      s.size = Math.min(3, (s.size ?? 1) + dt * (sp > 100 ? 0.018 : 0.006));
      break;
    }
  }
}

function outcome(g: Game): { title: string; line: string } {
  const pk = g.pkg!, s = pk.s, c = pkgCond(pk);
  const pick = (a: [string, string][]) => a[Math.min(a.length - 1, Math.floor((1 - c) * a.length * 0.999))];
  const [title, line] = ((): [string, string] => {
    switch (pk.def.id) {
      case "letter": return pick([["Crisp and dry", "Not a smudge. The news is exactly as important as promised."], ["A touch damp", "The ink ran a little. It now reads as poetry."], ["Soaked", "It's mostly a blue puddle shaped like a letter."]]);
      case "book": return pick([["Pristine", "Every page exactly where it should be."], ["A bit dog-eared", "The book has been somewhere. It has stories."], ["Battered", "It is now, technically, a very thick bookmark."]]);
      case "flowers": return pick([["Blooming", "They arrived looking pleased with themselves."], ["Somewhat tired", "They still smell lovely, just… quietly."], ["Very dramatic", "They wilted theatrically upon arrival."]]);
      case "cake": return (s.flip ?? 0) % 2 ? ["Upside down", "The cake arrived perfectly intact, and perfectly upside down."] : pick([["Perfect cake", "Three tiers, all present, all upright."], ["Slightly lopsided", "It's leaning. Cakes lean. It's fine."], ["A cake puddle", "It is now, at best, a cake-shaped sauce."]]);
      case "clothes": return pick([["Freshly mended", "Dry, folded, and only slightly windswept."], ["A little damp", "It will dry on the line. Probably."], ["Soaked", "Technically a very heavy cloak."]]);
      case "gift": return pick([["Beautifully wrapped", "The ribbon is still a bow."], ["Ribbon askew", "It rattled the whole way."], ["Unwrapped", "The ribbon is somewhere over the town. Happy birthday."]]);
      case "potion": return (s.fizz ?? 0) === 0 ? ["Still and clear", "Not a bubble out of place."] : (s.fizz ?? 0) < 3 ? ["Fizzy", "It's… livelier than when it left."] : ["Mostly fizz", "It's now a completely different potion. Possibly better."];
      case "teapot": return pick([["Still singing", "It finished on a high note. Literally."], ["Humming sulkily", "Wet, but willing."], ["Utterly silent", "Rain stopped the concert. It's sulking."]]);
      case "sleepcloud": return pick([["Fast asleep", "Not a rumble. You flew like a lullaby."], ["Dozing", "It woke up briefly. It forgives you."], ["Furious", "It rained on the entire delivery. Its customer is now wet, and delighted."]]);
      case "umbrella": return c > 0.8 ? ["Present and correct", "Probably. Nobody can see it. That's the whole point."] : ["Slightly dented", "A dent in the air, roughly umbrella-shaped."];
      case "frogs": return (s.frogs ?? 0) >= 6 ? ["All six frogs", "Present, accounted for, and slightly offended."] : (s.frogs ?? 0) >= 3 ? [`${s.frogs} frogs`, "Some frogs have chosen freedom."] : [`${s.frogs ?? 0} frogs`, "The rest are now the town's problem."];
      case "storm": return pick([["Still crackling", "Contained. Mostly. The recipient has an umbrella."], ["A bit rumbly", "It sneezed lightning once. Everyone's fine."], ["Overcharged", "Delivered, along with some thunder and a small rainbow."]]);
      case "egg": return s.hatched ? ["It hatched!", "A tiny dragon, riding on your hat, looking delighted with itself."] : (s.warm ?? 0) < 0.12 ? ["Shivering", "A very cold egg. A warm hug is on the way."] : ["Cosy and intact", "Warm, snug, and still an egg."];
      case "moonlight": return pick([["Glowing", "The bottle lit up the whole room."], ["Dimmer", "A softer moon than advertised. Still moon."], ["Mostly faded", "It's moonlight-ish. A rumour of moonlight."]]);
      case "homesick": return pick([["Resigned", "It stopped tugging at the door. It has accepted its new home."], ["Wistful", "It's still glancing back toward where it came from."], ["Plotting", "It already has a return route planned."]]);
      case "dream": return ["Delivered, dreamily", "Nobody's sure it was really there. It arrived anyway."];
      case "shadow": return pick([["Right at home", "It stretched out across the floor like it never left."], ["A little thin", "It's a bit see-through. Give it a day."], ["Barely there", "It arrived mostly as a rumour."]]);
      case "yesterday": return ["Right on time. (Late.)", "It had already been delivered by the time you arrived. Time is funny."];
      case "ocean": return pick([["A whole ocean", "Every wave present, each of them waving."], ["A large pond", "Some of the ocean got a day out."], ["A damp puddle", "It's mostly a metaphor now."]]);
      case "reflection": return pick([["Reunited", "They looked at each other for a long time. It was moving."], ["Slightly mismatched", "It's the right reflection, but a bit left-handed."], ["Mostly itself", "It showed up half a second late, backwards."]]);
      case "refuse": return ["Delivered under protest", "The cloud accepts that it's been delivered. It's still saying 'no'."];
      case "bigbox": return (s.size ?? 1) > 2.3 ? ["Enormous", "It was about the size of a barn at the end. Somehow it fit through the door."] : ["Larger than expected", "It contains something even larger than itself. Sign here."];
      default: return ["Delivered", "A job well done."];
    }
  })();
  return { title, line };
}

/* ------------------------------------------------------------------ */
/* Routes, secrets                                                     */
/* ------------------------------------------------------------------ */

const ROUTE_NAME: Record<string, string> = {
  street: "Street level", roof: "Rooftops", river: "River", forest: "Forest", tunnel: "Underground",
  high: "High air", cloud: "Cloud Lane",
};
function routeKey(g: Game): string {
  const p = g.p;
  if (p.y > GROUND + 20 && inTunnelX(p.x)) return "tunnel";
  if (p.y < 260) return "cloud";
  if (p.y < 400) return "high";
  if (isWaterX(p.x) && p.y > GROUND - 210) return "river";
  if (districtAt(p.x).id === "wood" && p.y > GROUND - 330) return "forest";
  if (p.y > GROUND - 110) return "street";
  return "roof";
}
function pushRoute(q: Quest, name: string, force = false) {
  if (q.routeSeq[q.routeSeq.length - 1] === name && !force) return;
  if (q.routeSeq.includes(name) && force) return;
  q.routeSeq.push(name);
}

function secretOk(g: Game, cond: string): boolean {
  const f = timeOfDay(g.clock);
  if (cond === "any") return true;
  if (cond === "rain") return g.weather.rain > 0.3;
  if (cond === "night") return isDark(f);
  if (cond === "midnight") return isMidnight(f);
  return false;
}
function discoverSecret(g: Game, id: string) {
  const s = SECRETS.find((x) => x.id === id);
  if (!s || g.save.secrets[id]) return;
  g.save.secrets[id] = true;
  g.save.coins += 25;
  toast(g, `Secret found: ${s.name}`, "secret");
  push(g, { type: "ann", text: `${s.name}. ${s.found}` });
  sfx(g, "discover");
  burst(g, g.p.x, g.p.y, 24, "spark", "#ffe9a8", 220, 1, 3);
}
function checkSecrets(g: Game) {
  for (const s of SECRETS) {
    if (g.save.secrets[s.id] || s.id === "cloudlane") continue;
    if (!secretOk(g, s.cond)) continue;
    if (Math.hypot(g.p.x - s.x, g.p.y - s.y) < s.r) discoverSecret(g, s.id);
  }
}

/* ------------------------------------------------------------------ */
/* Delivery flow                                                       */
/* ------------------------------------------------------------------ */

function startCarry(g: Game) {
  const q = g.quest!, o = q.offer;
  g.pkg = createPkg(g, PKG[o.pkg]);
  q.phase = "carry"; q.t0 = g.t; q.elapsed = 0; q.routeSeq = []; q.lastRoute = routeKey(g);
  g.frogs = []; g.ghost = []; g.queue = [];
  g.save.seen[o.pkg] = (g.save.seen[o.pkg] ?? 0) + 1;
  toast(g, `Collected: ${PKG[o.pkg].name}. Deliver to ${LOC[o.to].name}.`, "good");
  sfx(g, "pickup");
  burst(g, g.p.x, g.p.y, 14, "spark", "#fff3b0", 170, 0.7, 3);
}

function nightOk(g: Game, o: Offer): boolean {
  const f = timeOfDay(g.clock);
  if (o.constraint.kind !== "night") return true;
  return o.customer === "hollow" ? isMidnight(f) : isDark(f);
}

function finishDelivery(g: Game, dist: number, speed: number) {
  const q = g.quest!, o = q.offer, pk = g.pkg!;
  const pad = g.w.pads[o.to];
  const ratio = q.elapsed / o.par;
  const timeS = ratio <= 1 ? 1 : ratio <= 1.5 ? 0.6 : ratio <= 2.2 ? 0.3 : 0.1;
  const cond = pkgCond(pk);
  const acc = clamp(1 - clamp(speed / 260) * 0.4 - clamp(dist / pad.r) * 0.6, 0, 1);
  let obj: boolean | null = null;
  if (o.objective) {
    switch (o.objective.kind) {
      case "rings": obj = q.rings >= 2; break;
      case "noground": obj = q.groundTouches === 0; break;
      case "shortcut": obj = q.shortcut; break;
      case "low": obj = q.lowestUp < 3; break;
      case "nobirds": obj = q.thefts === 0; break;
    }
  }
  const quality = clamp(timeS * 0.3 + cond * 0.45 + acc * 0.25 + (obj ? 0.08 : 0));
  const stars = quality >= 0.8 ? 3 : quality >= 0.5 ? 2 : 1;
  const bucket: "great" | "ok" | "bad" = quality >= 0.8 ? "great" : quality >= 0.5 ? "ok" : "bad";
  const reward = Math.round((28 + o.tier * 22 + o.dist / 70) * (0.5 + 0.5 * quality)) + (obj ? 15 : 0);
  const oc = outcome(g);
  const cust = CUSTOMER[o.customer];
  const generic = GENERIC_LINES[bucket];
  const customerLine = rnd(g) < 0.8 ? cust.lines[bucket] : generic[Math.floor(rnd(g) * generic.length)];
  const route = q.routeSeq.length ? q.routeSeq.join(" → ") : ROUTE_NAME[routeKey(g)];
  const key = `${o.from}>${o.to}`;
  const best = g.save.routes[key];
  const newBest = !best || q.elapsed < best.t;
  if (newBest) g.save.routes[key] = { t: Math.round(q.elapsed * 10) / 10, route };
  const before = g.save.delivered;
  g.save.delivered++;
  g.save.coins += reward; g.save.stars += stars;
  g.save.met[o.customer] = (g.save.met[o.customer] ?? 0) + 1;
  const unlocks: string[] = [];
  for (const d of DISTRICTS) if (d.unlock > before && d.unlock <= g.save.delivered) unlocks.push(`${d.name} is open for deliveries`);
  TIER_UNLOCK.forEach((n, i) => { if (i > 0 && n > before && n <= g.save.delivered) unlocks.push(i === 1 ? "Unusual packages are now on the board" : "Impossible packages are now on the board"); });
  for (const w of WEATHERS) if (w.unlock > before && w.unlock <= g.save.delivered) unlocks.push(`New weather: ${w.name}`);
  const notes: string[] = [];
  if (q.thefts) notes.push(`Birds snatched it ${q.thefts}×`);
  if (q.bumps) notes.push(`${q.bumps} bonk${q.bumps > 1 ? "s" : ""}`);
  g.result = {
    offer: o, time: q.elapsed, par: o.par, stars, quality, parts: { time: timeS, cond, acc, obj },
    title: oc.title, line: oc.line, customerLine, reward, route, newBest, bestTime: g.save.routes[key].t, unlocks, customer: o.customer, bucket,
    tipNote: notes.join(" · "),
  };
  q.phase = "result";
  g.frogs = [];
  toast(g, `${CUSTOMER[o.customer].name}: “${customerLine}”`, "good");
  sfx(g, bucket === "bad" ? "oops" : "deliver");
  burst(g, pad.x, pad.y, 26, "spark", "#fff3b0", 260, 1, 3);
}

export function closeResult(g: Game) {
  g.result = null; g.quest = null; g.pkg = null; g.frogs = []; g.ghost = [];
  g.offers = makeOffers(g);
}

function questStep(g: Game, dt: number) {
  const q = g.quest;
  g.hint = "";
  if (!q || q.phase === "result") return;
  const p = g.p, o = q.offer;
  const speed = Math.hypot(p.vx, p.vy);
  if (q.phase === "pickup") {
    const pad = g.w.pads[o.from];
    const d = Math.hypot(p.x - pad.x, p.y - pad.y);
    if (d < pad.r + 8) {
      if (speed < 300) startCarry(g); else g.hint = "Slow down to collect the package";
    }
    return;
  }
  // carrying
  q.elapsed += dt;
  const pk = g.pkg!;
  const key = routeKey(g);
  if (key === q.lastRoute) q.routeHold = 0;
  else { q.routeHold += dt; if (q.routeHold > 1.2) { q.lastRoute = key; q.routeHold = 0; pushRoute(q, ROUTE_NAME[key]); } }
  if (!q.routeSeq.length && q.elapsed > 1.2) pushRoute(q, ROUTE_NAME[q.lastRoute]);
  q.routeT[key] = (q.routeT[key] ?? 0) + dt;
  if (p.y < GROUND - 280 && !(districtAt(p.x).id === "hill")) q.lowestUp += dt;
  const pad = g.w.pads[o.to];
  const d = Math.hypot(p.x - pad.x, p.y - pad.y);
  if (d < pad.r + 8 && pk.stolen <= 0) {
    if (!nightOk(g, o)) { g.hint = o.customer === "hollow" ? "The window stays dark. Wait for midnight." : "They only accept deliveries after dark."; q.dwell = 0; return; }
    if (speed >= 260) { g.hint = "Slow down to hand it over"; q.dwell = 0; return; }
    const need = pk.def.id === "refuse" ? 1.4 : 0.0;
    q.dwell += dt;
    if (need > 0) g.hint = "Hold steady — it's trying to leave…";
    if (q.dwell >= need) finishDelivery(g, d, speed);
  } else q.dwell = 0;
}

/* ------------------------------------------------------------------ */
/* The main step                                                       */
/* ------------------------------------------------------------------ */

function step(g: Game, dt: number) {
  g.t += dt; g.clock += dt;
  updateWeather(g, dt);
  flight(g, dt);
  forces(g, dt);
  collide(g, dt);
  p_speed(g);
  features(g, dt);
  birds(g, dt);
  frogsStep(g, dt);
  bolts(g, dt);
  updatePkg(g, dt);
  questStep(g, dt);
  particles(g, dt);
  g.secretT = (g.secretT ?? 0) - dt;
  if (g.secretT <= 0) { g.secretT = 0.25; checkSecrets(g); }
  // weather particles near the player
  ambient(g, dt);
  // camera
  const p = g.p;
  const tx = p.x + p.vx * 0.32, ty = p.y + p.vy * 0.12 - 30;
  const k = Math.min(1, dt * 4.5);
  g.cam.x = lerp(g.cam.x, tx, k); g.cam.y = lerp(g.cam.y, ty, k);
  g.shake = Math.max(0, g.shake - dt * 14);
  g.prevV.x = p.vx; g.prevV.y = p.vy;
  p.ang = lerp(p.ang, clamp(p.vx / 700, -0.5, 0.5) + clamp(p.vy / 1600, -0.25, 0.25) * p.face, Math.min(1, dt * 8));
}

function p_speed(g: Game) { g.p.speed = Math.hypot(g.p.vx, g.p.vy); }

function ambient(g: Game, dt: number) {
  const p = g.p, W = g.weather;
  if (W.rain > 0.1 && rnd(g) < dt * 90 * W.rain) spawnPart(g, { x: p.x + rr(g, -700, 700), y: p.y - 420, vx: -40 + W.dir * W.wind * 0.5, vy: 700, life: 1, size: 1.4, kind: "rain", color: "#c8dcf5" });
  if (W.snow > 0.1 && rnd(g) < dt * 50 * W.snow) spawnPart(g, { x: p.x + rr(g, -700, 700), y: p.y - 420, vx: W.dir * W.wind * 0.4 + rr(g, -20, 20), vy: 90, life: 6, size: 2.2, kind: "snow", color: "#ffffff" });
  // chimney smoke
  if (g.t % 0.4 < dt) for (const c of g.w.chimneyTops) if (Math.abs(c.x - p.x) < 900) spawnPart(g, { x: c.x, y: c.y, vx: 10, vy: -40, life: 2.4, size: 7, kind: "smoke", color: "#b79cf0" });
}

/** Advance the game by dt seconds (sub-stepped). */
export function advance(g: Game, dt: number) {
  if (g.paused || g.result) { g.ev.length = Math.min(g.ev.length, 40); return; }
  let left = Math.min(dt, 0.25);
  while (left > 0) { const h = Math.min(1 / 60, left); left -= h; step(g, h); }
}

/* ------------------------------------------------------------------ */
/* Upgrades                                                            */
/* ------------------------------------------------------------------ */

export function buyUpgrade(g: Game, id: UpgradeId, costs: number[]): boolean {
  const lv = g.save.upgrades[id];
  if (lv >= costs.length) return false;
  if (g.save.coins < costs[lv]) return false;
  g.save.coins -= costs[lv]; g.save.upgrades[id] = lv + 1;
  toast(g, "Broom upgraded!", "good"); sfx(g, "pickup");
  return true;
}

/* ------------------------------------------------------------------ */
/* Reading state                                                       */
/* ------------------------------------------------------------------ */

export interface Hud {
  coins: number; delivered: number; stars: number;
  clock: string; light: number; f: number; weather: Weather; weatherName: string; weatherNext: string | null; weatherBlurb: string;
  boost: number; boostLocked: boolean; flourish: number; speed: number; alt: number;
  phase: Phase; target: { name: string; id: LocId; dist: number; angle: number } | null;
  quest: null | { pkg: string; note: string; tip: string; from: string; to: string; customer: string; constraint: string; objective: string | null; objectiveDone: boolean | null; elapsed: number; par: number; limit: number; tier: number };
  gauge: Gauge | null; stolen: boolean; hint: string; inZone: boolean;
  secrets: number; windV: number; compass: number; hat: string;
}

export function snapshot(g: Game): Hud {
  const f = timeOfDay(g.clock), p = g.p, q = g.quest;
  const W = WEATHER[g.weather.kind];
  let target: Hud["target"] = null;
  if (q && q.phase !== "result") {
    const id = q.phase === "pickup" ? q.offer.from : q.offer.to;
    const pad = g.w.pads[id];
    target = { name: LOC[id].name, id, dist: Math.hypot(pad.x - p.x, pad.y - p.y), angle: Math.atan2(pad.y - p.y, pad.x - p.x) };
  }
  let objectiveDone: boolean | null = null;
  if (q?.offer.objective) {
    const k = q.offer.objective.kind;
    objectiveDone = k === "rings" ? q.rings >= 2 : k === "noground" ? q.groundTouches === 0 : k === "shortcut" ? q.shortcut : k === "low" ? q.lowestUp < 3 : q.thefts === 0;
  }
  return {
    coins: g.save.coins, delivered: g.save.delivered, stars: g.save.stars,
    clock: dayName(f), light: lightLevel(f), f, weather: g.weather.kind, weatherName: W.name, weatherNext: g.weather.next ? WEATHER[g.weather.next].name : null, weatherBlurb: W.blurb,
    boost: p.boost / (100 + 18 * upgradeLv(g, "boost")), boostLocked: p.boostLock, flourish: 1 - p.flourishCd / 3.2, speed: p.speed, alt: GROUND - p.y,
    phase: q ? q.phase : "idle", target,
    quest: q ? { pkg: PKG[q.offer.pkg].name, note: PKG[q.offer.pkg].note, tip: PKG[q.offer.pkg].tip, from: LOC[q.offer.from].name, to: LOC[q.offer.to].name, customer: CUSTOMER[q.offer.customer].name, constraint: q.offer.constraint.text, objective: q.offer.objective?.text ?? null, objectiveDone, elapsed: q.elapsed, par: q.offer.par, limit: q.offer.constraint.limit, tier: q.offer.tier } : null,
    gauge: g.pkg && q?.phase === "carry" ? pkgGauge(g.pkg) : null, stolen: !!g.pkg && g.pkg.stolen > 0, hint: g.hint,
    inZone: !!target && target.dist < g.w.pads[target.id].r + 8,
    secrets: Object.keys(g.save.secrets).length, windV: p.windV, compass: upgradeLv(g, "compass"), hat: p.hat,
  };
}

export function drainEvents(g: Game): GameEvent[] { const e = g.ev; g.ev = []; return e; }
export { TIER_LABEL, WORLD_H };
