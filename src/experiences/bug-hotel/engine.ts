/**
 * Bug Hotel — simulation layer.
 *
 * Pure TypeScript, no DOM. The presentation layer (render.ts / BugHotel.tsx)
 * reads this state and calls a handful of verbs (placeItem, advance, …).
 *
 * Tick rates, as in the design doc:
 *   movement       every frame (continuous)
 *   decisions      per creature, every ~1–2 s
 *   environment    1 s
 *   population     6 s   (arrivals, breeding, events)
 *   plant growth   20 s  (growth, decay, spread)
 */
import {
  CH, CHAMBERS, CHAMBER_ITEM_CAP, DAY_LEN, ITEM, ITEMS, PHASES, PREDATORS, SEASONS, SP, SPECIES, STAGES, doorPoint,
  type ChamberId, type ItemKind, type Phase, type ResKind, type Season, type SpeciesDef, type SpeciesId, type Weather,
} from "./data";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface Item {
  id: number; kind: ItemKind; ch: ChamberId; x: number; y: number;
  age: number; amount: number; store: number; seed: number;
}

export interface Web { id: number; ch: ChamberId; x: number; y: number; r: number; built: number; owner: number }

export type Mode =
  | "wander" | "forage" | "hunt" | "rest" | "web" | "wait" | "haul" | "flee"
  | "pupa" | "sun" | "orbit" | "transit" | "caught" | "patrol";

export interface Creature {
  id: number; sp: SpeciesId; ch: ChamberId; x: number; y: number; heading: number;
  hunger: number; comfort: number; stress: number; age: number; life: number;
  variant: number; scale: number; mode: Mode; tx: number; ty: number;
  tItem: number; tCre: number; res: ResKind | ""; timer: number; mtimer: number; chk: number;
  carrying: string; pollen: boolean; homeX: number; homeY: number; homeItem: number; hasHome: boolean;
  stage: "adult" | "pupa"; growth: number; dormant: boolean; hidden: boolean;
  visitorUntil: number; born: number; webId: number; transitTo: ChamberId | ""; wob: number;
  pause: number; fade: number; leaving: boolean; dead: boolean; hopT: number; lift: number; cycle: number; speedMul: number;
  caughtBy: number; seenChambers: number; orbitA: number;
}

export interface JournalEntry {
  sp: SpeciesId; firstT: number; firstCh: ChamberId; snapshot: string;
  obs: number; named: boolean; ate: boolean; behavior: boolean; relation: boolean; bred: boolean;
  phases: number; chambers: number; peak: number; boomed: boolean;
}

export interface LogEntry { t: number; kind: "arrival" | "event" | "world" | "stage" | "death"; text: string; sp?: SpeciesId }
export interface Toast { id: number; text: string; tone: "new" | "event" | "info" | "stage" }

export interface ChamberState {
  temp: number; humid: number; light: number; lightPot: number; wet: number;
  midges: number; aphids: number; detritus: number; carrion: number;
  shelterAll: number; pop: number; cap: number;
  n: Record<ItemKind, number>;
}

export interface View { x0: number; y0: number; x1: number; y1: number; zoom: number }

export interface World {
  v: number;
  rng: number; t: number; nextId: number;
  items: Item[]; creatures: Creature[]; webs: Web[];
  cs: Record<ChamberId, ChamberState>;
  weather: Weather; weatherLeft: number; rain: number; wind: number; rainSeen: boolean; lastRainEnd: number;
  season: Season; seasonStart: number;
  journal: Partial<Record<SpeciesId, JournalEntry>>;
  log: LogEntry[]; toasts: Toast[];
  stage: number; selected: number; view: View;
  placedAny: boolean; flags: Record<string, boolean | number>;
  tEnv: number; tSlow: number; tGrow: number; phase: Phase; arrivalCooldown: number;
  visitedPairs: Record<string, boolean>;
}

export const SEASON_LEN = DAY_LEN * 4;
const GLOBAL_CAP = 120;
const HUNGER_DAY = 0.55;

const ZERO_N = (): Record<ItemKind, number> => Object.fromEntries(ITEMS.map((i) => [i.id, 0])) as Record<ItemKind, number>;

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

export function rnd(w: World): number {
  // mulberry32 — state lives in the world so saves are deterministic
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (w: World, a: number, b: number) => a + rnd(w) * (b - a);
const ri = (w: World, a: number, b: number) => Math.floor(a + rnd(w) * (b - a + 1));
const pick = <T,>(w: World, a: T[]): T => a[Math.floor(rnd(w) * a.length)];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function rangeScore(v: number, r: [number, number], tol: number): number {
  if (v >= r[0] && v <= r[1]) return 1;
  const d = v < r[0] ? r[0] - v : v - r[1];
  return Math.max(0, 1 - d / tol);
}

/* ---- clock ---- */

export function phaseAt(f: number): Phase {
  return f < 0.17 ? "morning" : f < 0.55 ? "day" : f < 0.72 ? "evening" : "night";
}
const LIGHT_KEYS: [number, number][] = [[0, 0.35], [0.17, 0.85], [0.36, 1], [0.55, 0.7], [0.64, 0.35], [0.72, 0.1], [0.86, 0.04], [0.93, 0.08], [1, 0.35]];
export function daylight(f: number): number {
  for (let i = 1; i < LIGHT_KEYS.length; i++) {
    const [f1, l1] = LIGHT_KEYS[i];
    if (f <= f1) {
      const [f0, l0] = LIGHT_KEYS[i - 1];
      return lerp(l0, l1, (f - f0) / (f1 - f0));
    }
  }
  return 0.35;
}
export function clock(t: number) {
  const day = Math.floor(t / DAY_LEN);
  const f = (t % DAY_LEN) / DAY_LEN;
  return { day, f, phase: phaseAt(f), sun: daylight(f) };
}

export function unlockedSeasons(stage: number): Season[] {
  return stage >= 5 ? SEASONS : stage >= 4 ? SEASONS.slice(0, 3) : stage >= 3 ? SEASONS.slice(0, 2) : ["spring"];
}
const SEASON_TEMP: Record<Season, number> = { spring: 0, summer: 0.18, autumn: -0.05, winter: -0.3 };
const SEASON_BLOOM: Record<Season, number> = { spring: 1.2, summer: 1, autumn: 0.5, winter: 0.1 };
const SEASON_BREED: Record<Season, number> = { spring: 1.3, summer: 1.1, autumn: 0.8, winter: 0.3 };
const SEASON_ARRIVE: Record<Season, number> = { spring: 1.2, summer: 1.1, autumn: 0.9, winter: 0.5 };
const WEATHER_TEMP: Record<Weather, number> = { clear: 0, rain: -0.05, heat: 0.25, cold: -0.25, wind: -0.03, storm: -0.1 };

export function unlockedChambers(w: World): ChamberId[] {
  return CHAMBERS.filter((c) => c.stage <= w.stage).map((c) => c.id);
}
const isOpen = (w: World, id: ChamberId) => CH[id].stage <= w.stage;

export function stageFor(count: number): number {
  let s = 1;
  for (const st of STAGES) if (count >= st.at) s = st.n;
  return s;
}

const isGround = (sp: SpeciesDef) => sp.move === "crawl" || sp.move === "snail" || sp.move === "tick" || sp.move === "hop";
const isFlyer = (sp: SpeciesDef) => sp.move === "flutter" || sp.move === "fly" || sp.move === "hover";

export function bandOf(id: ChamberId) {
  const d = CH[id];
  return { y0: d.y + d.h * 0.5, y1: d.y + d.h - 8 };
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export function emptyChamberState(id: ChamberId): ChamberState {
  const d = CH[id];
  return {
    temp: d.temp, humid: d.humid, light: d.light, lightPot: d.light, wet: 0,
    midges: 0.1, aphids: 0, detritus: 0.25, carrion: 0, shelterAll: 0, pop: 0, cap: 8, n: ZERO_N(),
  };
}

export function createWorld(seed = 1): World {
  const cs = {} as Record<ChamberId, ChamberState>;
  for (const c of CHAMBERS) cs[c.id] = emptyChamberState(c.id);
  return {
    v: 1, rng: seed | 0 || 1, t: DAY_LEN * 0.04, nextId: 1,
    items: [], creatures: [], webs: [], cs,
    weather: "clear", weatherLeft: 70, rain: 0, wind: 0, rainSeen: false, lastRainEnd: -999,
    season: "spring", seasonStart: 0,
    journal: {}, log: [], toasts: [],
    stage: 1, selected: 0, view: { x0: 0, y0: 0, x1: 960, y1: 720, zoom: 1 },
    placedAny: false, flags: {},
    tEnv: 0, tSlow: 0, tGrow: 0, phase: "morning", arrivalCooldown: 20,
    visitedPairs: {},
  };
}

function toast(w: World, text: string, tone: Toast["tone"] = "info") {
  w.toasts.push({ id: w.nextId++, text, tone });
  if (w.toasts.length > 8) w.toasts.shift();
}
function logIt(w: World, kind: LogEntry["kind"], text: string, sp?: SpeciesId) {
  w.log.unshift({ t: w.t, kind, text, sp });
  if (w.log.length > 120) w.log.length = 120;
}
export function drainToasts(w: World): Toast[] {
  const out = w.toasts;
  w.toasts = [];
  return out;
}

/* ------------------------------------------------------------------ */
/* Player verbs                                                        */
/* ------------------------------------------------------------------ */

export function chamberAt(w: World, x: number, y: number, slack = 0): ChamberId | null {
  for (const c of CHAMBERS) {
    if (c.stage > w.stage) continue;
    if (x >= c.x - slack && x <= c.x + c.w + slack && y >= c.y - slack && y <= c.y + c.h + slack) return c.id;
  }
  return null;
}

export function itemCount(w: World, ch: ChamberId) {
  let n = 0;
  for (const it of w.items) if (it.ch === ch) n++;
  return n;
}

export function placeItem(w: World, kind: ItemKind, ch: ChamberId, x: number, y: number): Item | null {
  const def = ITEM[kind], cd = CH[ch];
  if (!def || def.hidden || def.stage > w.stage || cd.stage > w.stage) return null;
  if (itemCount(w, ch) >= CHAMBER_ITEM_CAP) return null;
  const it = putItem(w, kind, ch, x, y);
  w.placedAny = true;
  envTick(w);
  return it;
}

function putItem(w: World, kind: ItemKind, ch: ChamberId, x: number, y: number): Item {
  const d = CH[ch], def = ITEM[kind];
  const px = clamp(x, d.x + 14, d.x + d.w - 14);
  let py = y;
  if (def.anchor === "floor") py = clamp(y, d.y + d.h * 0.58, d.y + d.h - 10);
  else if (def.anchor === "air") py = clamp(y, d.y + 12, d.y + d.h * 0.5);
  else py = clamp(y, d.y + 14, d.y + d.h - 12);
  const it: Item = { id: w.nextId++, kind, ch, x: px, y: py, age: 0, amount: 1, store: 0, seed: rnd(w) };
  if (kind === "flower" || kind === "paleflower") it.amount = 0.8;
  w.items.push(it);
  return it;
}

export function removeItemAt(w: World, ch: ChamberId, x: number, y: number): boolean {
  let best = -1, bd = 30 * 30;
  for (let i = 0; i < w.items.length; i++) {
    const it = w.items[i];
    if (it.ch !== ch) continue;
    const d = (it.x - x) ** 2 + (it.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return false;
  w.items.splice(best, 1);
  envTick(w);
  return true;
}

export function creatureAt(w: World, x: number, y: number, r = 16): Creature | null {
  let best: Creature | null = null, bd = Infinity;
  for (const c of w.creatures) {
    if (c.dead || c.fade < 0.2) continue;
    const rad = r + SP[c.sp].size * 0.5;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < rad && d < bd) { bd = d; best = c; }
  }
  return best;
}

/** The player looked closely at a creature. */
export function observeCreature(w: World, id: number) {
  const c = w.creatures.find((k) => k.id === id);
  if (!c) { w.selected = 0; return; }
  w.selected = id;
  const e = w.journal[c.sp];
  if (e) {
    e.obs += 1;
    e.chambers |= 1 << chIndex(c.ch);
    if (!c.dormant) e.phases |= 1 << PHASES.indexOf(clock(w.t).phase);
    checkNamed(w, e);
  }
}

const chIndex = (id: ChamberId) => CHAMBERS.findIndex((c) => c.id === id);

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

const ITEM_WORD = (k: ItemKind) => ITEM[k].label.toLowerCase();

function snapshot(w: World, ch: ChamberId, how = ""): string {
  const cs = w.cs[ch];
  const { phase } = clock(w.t);
  const top = ITEMS.filter((i) => cs.n[i.id] > 0 && !i.hidden)
    .sort((a, b) => cs.n[b.id] - cs.n[a.id]).slice(0, 3).map((i) => ITEM_WORD(i.id));
  const near = top.length ? `, with ${top.join(", ")} nearby` : "";
  return `${how || "First seen"} in the ${CH[ch].name}, ${phase === "day" ? "by day" : phase === "night" ? "at night" : "in the " + phase}, ${w.weather === "clear" ? "under a clear sky" : w.weather === "storm" ? "in a storm" : "in " + w.weather}${near}.`;
}

function checkNamed(w: World, e: JournalEntry) {
  if (!e.named && e.obs >= 3) {
    e.named = true;
    const sp = SP[e.sp];
    toast(w, `Identified: ${sp.name}`, "new");
    logIt(w, "event", `Identified the ${sp.name.toLowerCase()} (${sp.latin}).`, e.sp);
  }
}

function discover(w: World, spId: SpeciesId, ch: ChamberId, how = ""): JournalEntry {
  let e = w.journal[spId];
  if (e) return e;
  const sp = SP[spId];
  const named = sp.rarity === "common" || sp.rarity === "uncommon";
  e = {
    sp: spId, firstT: w.t, firstCh: ch, snapshot: snapshot(w, ch, how),
    obs: 0, named, ate: false, behavior: false, relation: false, bred: false,
    phases: 0, chambers: 1 << chIndex(ch), peak: 1, boomed: false,
  };
  w.journal[spId] = e;
  if (named) {
    toast(w, `A new guest: ${sp.name}`, "new");
    logIt(w, "arrival", `A ${sp.name.toLowerCase()} moved into the ${CH[ch].name}.`, spId);
  } else {
    toast(w, `Something new has moved in…`, "new");
    logIt(w, "arrival", `Something unfamiliar appeared in the ${CH[ch].name}: ${sp.unknown?.name.toLowerCase() ?? "unknown"}.`, spId);
  }
  const count = Object.keys(w.journal).length;
  const st = stageFor(count);
  if (st > w.stage) {
    w.stage = st;
    const opened = CHAMBERS.filter((c) => c.stage === st).map((c) => c.name);
    const seasonNote = st === 3 ? " Summer will come." : st === 4 ? " Autumn will come." : st === 5 ? " Winter will come." : "";
    const info = STAGES[st - 1];
    toast(w, `The tree opens: ${info.name}`, "stage");
    logIt(w, "stage", `Stage ${st} — ${info.name}. New: ${opened.join(", ")}.${seasonNote}`);
  }
  return e;
}

function seen(w: World, c: Creature): boolean {
  const v = w.view;
  return (v.zoom >= 1.25 || w.selected === c.id) && c.x >= v.x0 && c.x <= v.x1 && c.y >= v.y0 && c.y <= v.y1;
}
type Flag = "ate" | "behavior" | "relation" | "bred";
function witness(w: World, c: Creature, flag: Flag) {
  if (!seen(w, c)) return;
  const e = w.journal[c.sp];
  if (e) e[flag] = true;
}

export interface JournalField { label: string; text: string | null; hint: string }
export interface JournalView {
  id: SpeciesId; known: boolean; named: boolean; title: string; latin: string | null; rarity: string | null;
  fields: JournalField[]; present: number; obs: number;
}

const bits = (n: number) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
const tempWord = (v: number) => ["cold", "cool", "mild", "warm", "hot"][Math.min(4, Math.floor(v * 5))];
const humidWord = (v: number) => ["dry", "dry-ish", "moderately damp", "damp", "wet"][Math.min(4, Math.floor(v * 5))];
const lightWord = (v: number) => ["dark", "dim", "softly lit", "bright", "sunlit"][Math.min(4, Math.floor(v * 5))];
const RES_WORD: Record<ResKind, string> = { midges: "midges", aphids: "aphids", detritus: "leaf litter", carrion: "remains" };
const list = (a: string[]) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

export function journalView(w: World, id: SpeciesId): JournalView {
  const sp = SP[id];
  const e = w.journal[id];
  const present = w.creatures.filter((c) => c.sp === id && !c.dead).length;
  if (!e) {
    return { id, known: false, named: false, title: "Undiscovered", latin: null, rarity: null, fields: [], present: 0, obs: 0 };
  }
  const named = e.named;
  const fields: JournalField[] = [];
  fields.push({ label: "First observation", text: e.snapshot, hint: "" });
  if (!named) {
    fields.push({ label: "Notes", text: sp.unknown?.hint ?? "Not yet identified.", hint: "" });
    fields.push({ label: "Identification", text: null, hint: "Keep watching it. Zoom in on its chamber, or tap it in Observe." });
    return { id, known: true, named, title: sp.unknown?.name ?? "Unknown", latin: null, rarity: null, fields, present, obs: e.obs };
  }
  const pm = (sp.temp[0] + sp.temp[1]) / 2, hm = (sp.humid[0] + sp.humid[1]) / 2, lm = (sp.light[0] + sp.light[1]) / 2;
  const habitatOK = bits(e.chambers) >= 2 || e.obs >= 2;
  fields.push({
    label: "Habitat",
    text: habitatOK ? (sp.noFood && sp.chambers.length === 1 ? `Lives only in the ${CH[sp.chambers[0]].name}.` : `Prefers ${tempWord(pm)}, ${humidWord(hm)}, ${lightWord(lm)} places — ${list(sp.chambers.slice(0, 4).map((c) => CH[c].name))}.`) : null,
    hint: "See it in more than one chamber.",
  });
  const foodBits: string[] = [];
  for (const k of sp.food.items ?? []) foodBits.push(ITEM_WORD(k));
  for (const k of sp.food.res ?? []) foodBits.push(RES_WORD[k]);
  for (const k of sp.food.prey ?? []) foodBits.push(SP[k].name.toLowerCase() + "s");
  fields.push({
    label: "Food",
    text: e.ate || (sp.noFood && e.obs >= 2) ? (sp.noFood ? "Doesn't seem to eat at all." : `Eats ${list(foodBits)}.`) : null,
    hint: "Watch what it eats.",
  });
  const act = PHASES.filter((_p, i) => sp.active[i] >= 0.5);
  fields.push({
    label: "Activity",
    text: bits(e.phases) >= 2 ? `Mostly out ${list(act.map((p) => (p === "day" ? "by day" : p === "night" ? "at night" : "in the " + p)))}.` : null,
    hint: "Watch it at different times of day.",
  });
  fields.push({ label: "Behaviour", text: e.behavior || e.obs >= 6 ? sp.text.behavior : null, hint: "Follow it for a while." });
  const rel: string[] = [];
  if (sp.food.prey?.length) rel.push(`Hunts ${list(sp.food.prey.map((p) => SP[p].name.toLowerCase() + "s"))}.`);
  const preds = PREDATORS[id];
  if (preds?.length) rel.push(`Eaten by ${list(preds.map((p) => SP[p].name.toLowerCase() + "s"))}.`);
  if (id === "bee" || id === "butterfly") rel.push("Carries pollen between flowers.");
  if (id === "caterpillar") rel.push("Becomes a butterfly or a moth.");
  if (id === "ant") rel.push("Feeds a colony.");
  if (id === "moth") rel.push("Circles lights.");
  fields.push({
    label: "Relationships",
    text: e.relation || e.obs >= 8 ? (rel.length ? rel.join(" ") : "Seems to keep to itself.") : null,
    hint: "See how it affects — or is affected by — the others.",
  });
  fields.push({ label: "Interesting fact", text: e.obs >= 5 ? sp.text.fact : null, hint: "A closer look might turn something up." });
  fields.push({ label: "Discovery conditions", text: e.obs >= 4 || e.bred ? sp.text.cond : null, hint: "Work out what brought it here." });
  return { id, known: true, named, title: sp.name, latin: sp.latin, rarity: sp.rarity, fields, present, obs: e.obs };
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

const FLYER_PREY = new Set<SpeciesId>(["moth", "butterfly", "bee", "ladybird", "dragonfly"]);

function recount(w: World) {
  for (const c of CHAMBERS) {
    const cs = w.cs[c.id];
    for (const k in cs.n) cs.n[k as ItemKind] = 0;
    cs.pop = 0;
  }
  for (const it of w.items) w.cs[it.ch].n[it.kind]++;
  for (const c of w.creatures) if (!c.dead && !c.leaving) w.cs[c.ch].pop++;
}

export function envTick(w: World) {
  recount(w);
  const { phase, sun } = clock(w.t);
  const wx = w.weather;
  const sunMult = wx === "rain" ? 0.6 : wx === "storm" ? 0.4 : 1;
  w.rain += ((wx === "rain" ? 0.6 : wx === "storm" ? 1 : 0) - w.rain) * 0.2;
  w.wind += ((wx === "wind" ? 0.6 : wx === "storm" ? 1 : 0.08) - w.wind) * 0.2;
  const moon = phase === "night" && wx === "clear" ? 0.09 : 0;
  const seasonT = SEASON_TEMP[w.season];

  for (const def of CHAMBERS) {
    const cs = w.cs[def.id], n = cs.n;
    const expo = def.open ? 1 : 0.35;
    let warm = 0, moist = 0, shelter = 0;
    for (const it of ITEMS) {
      const c = n[it.id];
      if (!c) continue;
      warm += it.warm * c * (it.id === "stones" ? 0.5 : 1);
      moist += it.moist * c;
      shelter += it.shelter * c;
    }
    const tT = clamp(def.temp + (sun - 0.5) * 0.22 * expo + seasonT * (0.4 + 0.6 * expo) + WEATHER_TEMP[wx] * expo + clamp(warm * 0.1, -0.3, 0.3), 0, 1);
    const hT = clamp(def.humid + Math.min(0.35, moist) + w.rain * (def.open ? 0.35 : 0.1) + cs.wet * 0.2 - Math.max(0, cs.temp - 0.65) * 0.8 - (wx === "wind" ? 0.08 * expo : 0), 0, 1);
    const art = n.light * 0.25 + n.livingmoss * 0.05 + n.paleflower * 0.03;
    const shade = n.shade * 0.1 + n.leaves * 0.01;
    const lPot = clamp(def.light + art - shade, 0, 1);
    const lT = clamp(def.light * (def.open ? sun * sunMult : 0.5 + 0.5 * sun * sunMult) + art + moon * expo - shade, 0, 1);
    const wetT = w.rain > 0.3 ? expo : 0;
    cs.wet = wetT > cs.wet ? lerp(cs.wet, wetT, 0.3) : Math.max(0, cs.wet - 0.004);
    cs.temp = lerp(cs.temp, tT, 0.15);
    cs.humid = lerp(cs.humid, hT, 0.15);
    cs.light = lerp(cs.light, lT, 0.3);
    cs.lightPot = lPot;
    cs.shelterAll = shelter;
    cs.cap = Math.floor(8 + shelter * 1.5);
    const bloom = SEASON_BLOOM[w.season];
    const mT = clamp((0.1 + n.water * 0.2 + (n.flower + n.paleflower) * 0.05 + n.fruit * 0.06 + cs.wet * 0.3 + (n.deadwood + n.fungi) * 0.04) * (cs.temp > 0.4 ? 1 : 0.3) * (0.6 + 0.4 * bloom));
    cs.midges += (mT - cs.midges) * 0.04;
    const aT = clamp((n.leaves * 0.12 + n.flower * 0.1 + n.paleflower * 0.05) * bloom, 0, 0.9);
    cs.aphids += (aT - cs.aphids) * 0.02;
    cs.carrion = Math.max(0, cs.carrion - 0.004);
  }

  // remove spent consumables
  for (let i = w.items.length - 1; i >= 0; i--) {
    const it = w.items[i];
    if ((it.kind === "seeds" || it.kind === "fruit" || it.kind === "nectar") && it.amount <= 0.02) w.items.splice(i, 1);
  }

  const idx = PHASES.indexOf(phase);
  const dayStep = 1 / DAY_LEN;
  for (const c of w.creatures) {
    if (c.dead) continue;
    const sp = SP[c.sp], cs = w.cs[c.ch];
    // ageing & hunger
    c.age += dayStep;
    if (c.scale < 1) c.scale = Math.min(1, c.scale + 1 / (DAY_LEN * 0.6));
    if (c.stage !== "pupa" && !sp.noFood && sp.special !== "visitor") c.hunger += (HUNGER_DAY * dayStep) * (c.dormant ? 0.4 : 1);
    if (sp.noFood) c.hunger = 0;
    // comfort
    const t = rangeScore(cs.temp, sp.temp, 0.25), h = rangeScore(cs.humid, sp.humid, 0.25), l = rangeScore(cs.lightPot, sp.light, 0.35);
    let cm = t * 0.4 + h * 0.4 + l * 0.2;
    if (t < 0.1 || h < 0.1) cm *= 0.5;
    if (sp.special === "visitor") cm = 1;
    c.comfort = lerp(c.comfort, cm, 0.3);
    if (c.comfort < 0.35) c.stress += 0.08; else c.stress = Math.max(0, c.stress - 0.05);
    // observation
    if (!c.hidden && c.fade > 0.5 && !c.leaving) {
      const e = w.journal[c.sp];
      if (e) {
        const zoomed = w.view.zoom >= 1.25;
        if (seen(w, c) || (c.x >= w.view.x0 && c.x <= w.view.x1 && c.y >= w.view.y0 && c.y <= w.view.y1)) {
          e.obs += (zoomed ? 0.04 : 0.012) * (w.selected === c.id ? 4 : 1);
          checkNamed(w, e);
        }
        if (seen(w, c)) {
          if (!c.dormant) e.phases |= 1 << idx;
          e.chambers |= 1 << chIndex(c.ch);
        }
      }
    }
    // pupa
    if (c.stage === "pupa") {
      c.mtimer -= 1;
      if (c.mtimer <= 0) emerge(w, c);
      continue;
    }
    // passive feeding from webs / glow
    if (sp.special === "web" && c.mode === "wait" && cs.midges > 0.1 && rnd(w) < 0.08) {
      c.hunger = Math.max(0, c.hunger - 0.12);
      cs.midges -= 0.02;
      witness(w, c, "ate");
    }
    if (sp.special === "glow" && c.mode === "wait" && phase === "night" && cs.midges > 0.1 && rnd(w) < 0.06) {
      c.hunger = Math.max(0, c.hunger - 0.15);
      cs.midges -= 0.02;
      witness(w, c, "ate");
    }
    // visitors leave
    if (c.visitorUntil > 0 && w.t > c.visitorUntil && !c.leaving) leave(w, c, true);
    // death
    if (c.hunger > 1.1) kill(w, c, "starved");
    else if (c.age > c.life) kill(w, c, "age");
    else if (c.stress > 1.2 && c.comfort < 0.15) kill(w, c, "exposure");
    else if (c.stress > 1 && !c.leaving) leave(w, c, false);
  }

  // web catching
  for (const web of w.webs) {
    if (web.built < 1) continue;
    const owner = w.creatures.find((k) => k.id === web.owner);
    if (!owner || owner.dead) continue;
    for (const c of w.creatures) {
      if (c.dead || c.ch !== web.ch || c.id === owner.id || c.mode === "caught" || c.stage === "pupa") continue;
      const sp = SP[c.sp];
      if (!FLYER_PREY.has(c.sp) || !isFlyer(sp) && c.sp !== "ladybird") continue;
      if (!SP[owner.sp].food.prey?.includes(c.sp)) continue;
      if (Math.hypot(c.x - web.x, c.y - web.y) < web.r) {
        if (rnd(w) < (phase === "night" && c.sp === "moth" ? 0.2 : 0.12)) {
          c.mode = "caught"; c.caughtBy = owner.id;
          owner.mode = "hunt"; owner.tCre = c.id;
        }
      }
    }
  }
  // caught things that lost their spider
  for (const c of w.creatures) if (c.mode === "caught" && !w.creatures.some((k) => k.id === c.caughtBy && !k.dead)) c.mode = "wander";
  w.webs = w.webs.filter((wb) => w.creatures.some((k) => k.id === wb.owner && !k.dead));
  recount(w);
}

/* ------------------------------------------------------------------ */
/* Life and death                                                      */
/* ------------------------------------------------------------------ */

function kill(w: World, c: Creature, cause: "starved" | "age" | "exposure" | "eaten" | "caught") {
  if (c.dead) return;
  c.dead = true;
  const sp = SP[c.sp];
  w.cs[c.ch].carrion = Math.min(1, w.cs[c.ch].carrion + 0.08 + sp.size * 0.012);
  w.cs[c.ch].detritus = Math.min(1, w.cs[c.ch].detritus + 0.03);
  if (w.selected === c.id) w.selected = 0;
  if ((sp.rarity === "rare" || sp.rarity === "strange") && cause !== "eaten" && cause !== "caught") {
    logIt(w, "death", `The ${sp.name.toLowerCase()} has died (${cause === "age" ? "of old age" : cause}).`, c.sp);
  }
}

function leave(w: World, c: Creature, visitor: boolean) {
  c.leaving = true;
  const sp = SP[c.sp];
  if (visitor && sp.special === "visitor") {
    logIt(w, "event", "The pocket whale is gone. The air still feels a little rounder.", c.sp);
  } else if (!visitor && sp.rarity !== "common" && w.flags["left:" + c.sp] !== Math.floor(w.t / SEASON_LEN)) {
    w.flags["left:" + c.sp] = Math.floor(w.t / SEASON_LEN);
    logIt(w, "event", `The ${sp.name.toLowerCase()} has moved on from the ${CH[c.ch].name}. It wasn't comfortable.`, c.sp);
  }
}

function emerge(w: World, c: Creature) {
  const cs = w.cs[c.ch];
  const flowers = cs.n.flower + cs.n.paleflower + cs.n.nectar;
  const toButterfly = flowers > 0 ? rnd(w) < 0.7 : rnd(w) < 0.4;
  c.sp = toButterfly ? "butterfly" : "moth";
  const sp = SP[c.sp];
  c.stage = "adult"; c.mode = "wander"; c.scale = 1; c.growth = 0; c.hunger = 0.3; c.age = 0;
  c.life = rr(w, sp.life[0], sp.life[1]); c.hidden = false; c.timer = 0.5; c.pause = 0;
  c.hasHome = false; c.carrying = ""; c.stress = 0;
  const first = !w.journal[c.sp];
  const e = discover(w, c.sp, c.ch, "Emerged from a chrysalis");
  if (first) e.snapshot = snapshot(w, c.ch, "Emerged from a chrysalis");
  if (seen(w, c)) { e.behavior = true; e.relation = true; }
  logIt(w, "event", `A caterpillar became a ${sp.name.toLowerCase()} in the ${CH[c.ch].name}.`, c.sp);
}

/* ------------------------------------------------------------------ */
/* Suitability & arrival                                               */
/* ------------------------------------------------------------------ */

function foodScore(w: World, sp: SpeciesDef, cs: ChamberState, ch: ChamberId): number {
  let best = 0;
  if (sp.food.items) {
    let s = 0;
    for (const k of sp.food.items) s += cs.n[k];
    best = Math.max(best, Math.min(1, s / 1.5));
  }
  if (sp.food.res) for (const r of sp.food.res) best = Math.max(best, Math.min(1, cs[r] / 0.5));
  if (sp.food.prey) {
    let p = 0;
    for (const c of w.creatures) if (c.ch === ch && !c.dead && sp.food.prey.includes(c.sp)) p++;
    best = Math.max(best, Math.min(1, p / 2));
  }
  return best;
}

export function suitability(w: World, sp: SpeciesDef, ch: ChamberId): number {
  const cs = w.cs[ch];
  const t = rangeScore(cs.temp, sp.temp, 0.2), h = rangeScore(cs.humid, sp.humid, 0.2), l = rangeScore(cs.lightPot, sp.light, 0.3);
  if (t < 0.4 || h < 0.4 || l < 0.3) return 0;
  let sh = 1;
  if (sp.shelterNeed > 0) {
    let s = 0;
    for (const k of sp.shelter) s += cs.n[k] * ITEM[k].shelter;
    sh = Math.min(1, s / sp.shelterNeed);
    if (sh < 0.5) return 0;
  }
  let f = 1;
  if (!sp.noFood) {
    f = foodScore(w, sp, cs, ch);
    if (f < 0.2) return 0;
  }
  return (t * 0.3 + h * 0.3 + sh * 0.15 + f * 0.25) * (0.7 + 0.3 * l);
}

interface Ctx {
  w: World; ch: ChamberId; cs: ChamberState; n: Record<ItemKind, number>; phase: Phase;
  pops: Record<string, number>; kinds: number; stage: number;
}
const REQ: Record<string, (x: Ctx) => boolean> = {
  dragonfly: (x) => x.n.water >= 1 && x.cs.midges >= 0.2,
  spider: (x) => x.n.twigs >= 2,
  mantis: (x) => x.n.twigs + x.n.leaves >= 3 && x.cs.temp > 0.6 && (SP.mantis.food.prey ?? []).filter((p) => (x.pops[p] ?? 0) > 0).length >= 2,
  stag: (x) => x.n.deadwood >= 2 && x.n.fungi >= 1 && (x.pops.beetle ?? 0) >= 1,
  jewel: (x) => (x.pops.orbspider ?? 0) >= 1 && x.n.twigs >= 3 && x.n.flower + x.n.paleflower >= 2 && x.kinds >= 8,
  glowworm: (x) => (x.phase === "night" || x.phase === "evening") && x.n.moss >= 2,
  veil: (x) => x.phase === "night" && (x.w.weather === "rain" || x.w.weather === "storm") && x.n.leaves >= 3,
  golden: (x) => x.phase === "day" && x.cs.temp >= 0.78 && x.n.stones >= 3 && (x.pops.beetle ?? 0) >= 1,
  moonmoth: (x) => x.phase === "night" && x.w.weather === "clear" && x.n.paleflower >= 1,
  glass: (x) => (x.phase === "day" || x.phase === "morning") && x.cs.wet >= 0.25 && x.w.rain < 0.2 && x.n.stones >= 2 && x.n.water >= 1 && x.cs.lightPot >= 0.4,
  clockwork: (x) => x.phase === "evening" && x.n.twigs >= 3 && x.n.stones >= 2 && x.n.hollowwood >= 1,
  starbeetle: (x) => x.phase === "night" && (x.w.weather === "clear" || x.w.weather === "cold") && x.cs.temp <= 0.34,
  wisp: (x) => x.n.livingmoss >= 1,
  whale: (x) => x.stage >= 6 && x.phase === "night" && x.n.water >= 2 && x.kinds >= 9,
};

function census(w: World) {
  const pops: Record<string, number> = {};
  for (const c of w.creatures) if (!c.dead && !c.leaving && c.stage !== "pupa") pops[c.sp] = (pops[c.sp] ?? 0) + 1;
  return pops;
}
export { census };

function nextDawn(w: World): number {
  return (Math.floor(w.t / DAY_LEN) + 1) * DAY_LEN + DAY_LEN * 0.12;
}

function shuffle<T>(w: World, a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(w) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function rollDormant(w: World, c: Creature) {
  const sp = SP[c.sp];
  const idx = PHASES.indexOf(w.phase);
  let p = sp.active[idx];
  if (isFlyer(sp) || sp.move === "hop") {
    if (w.weather === "storm") p *= 0.25;
    else if (w.weather === "wind") p *= 0.6;
    else if (w.weather === "rain") p *= 0.6;
  }
  c.dormant = rnd(w) > p;
  if (!c.dormant) c.hidden = false;
}

function pickPoint(w: World, c: Creature, ch: ChamberId = c.ch) {
  const d = CH[ch], sp = SP[c.sp];
  const x = rr(w, d.x + 12, d.x + d.w - 12);
  if (isGround(sp)) {
    const b = bandOf(ch);
    return { x, y: rr(w, b.y0, b.y1) };
  }
  return { x, y: rr(w, d.y + 12, d.y + d.h - 12) };
}

export function spawn(w: World, spId: SpeciesId, ch: ChamberId, x?: number, y?: number, visitorUntil = 0): Creature {
  const sp = SP[spId];
  const c: Creature = {
    id: w.nextId++, sp: spId, ch, x: 0, y: 0, heading: rnd(w) * Math.PI * 2,
    hunger: rr(w, 0.1, 0.35), comfort: 1, stress: 0, age: 0, life: rr(w, sp.life[0], sp.life[1]),
    variant: rnd(w), scale: 1, mode: "wander", tx: 0, ty: 0, tItem: 0, tCre: 0, res: "",
    timer: rr(w, 0.2, 1.2), mtimer: 0, chk: rnd(w) * 0.35, carrying: "", pollen: false,
    homeX: 0, homeY: 0, homeItem: 0, hasHome: false, stage: "adult", growth: 0, dormant: false, hidden: false,
    visitorUntil, born: w.t, webId: 0, transitTo: "", wob: rnd(w) * 20, pause: 0, fade: 0, leaving: false, dead: false,
    hopT: 0, lift: 0, cycle: rnd(w) * 2, speedMul: 1, caughtBy: 0, seenChambers: 1 << chIndex(ch), orbitA: rnd(w) * 6.28,
  };
  const p = x === undefined || y === undefined ? pickPoint(w, c, ch) : { x, y };
  c.x = p.x; c.y = p.y; c.tx = p.x; c.ty = p.y;
  rollDormant(w, c);
  w.creatures.push(c);
  return c;
}

function arrivals(w: World) {
  if (w.arrivalCooldown > 0) { w.arrivalCooldown -= 6; return; }
  if (w.creatures.length >= GLOBAL_CAP) return;
  const { phase } = clock(w.t);
  const pops = census(w);
  const kinds = Object.keys(pops).length;
  const boost = w.creatures.length < 4 ? 2 : 1;
  for (const sp of shuffle(w, SPECIES)) {
    const pop = pops[sp.id] ?? 0;
    if (pop >= sp.cap) continue;
    if (sp.arrive && !sp.arrive.includes(phase)) continue;
    let best: ChamberId | null = null, bs = 0;
    for (const chId of sp.chambers) {
      if (!isOpen(w, chId)) continue;
      const cs = w.cs[chId];
      if (cs.pop >= cs.cap + (sp.rarity === "rare" || sp.rarity === "strange" ? 3 : 0)) continue;
      const s = suitability(w, sp, chId);
      if (s <= bs) continue;
      if (sp.req && !REQ[sp.req]({ w, ch: chId, cs, n: cs.n, phase, pops, kinds, stage: w.stage })) continue;
      bs = s; best = chId;
    }
    if (!best || bs < 0.45) continue;
    const p = sp.rate * bs * SEASON_ARRIVE[w.season] * (1 - pop / sp.cap) * boost;
    if (rnd(w) >= p) continue;
    const n = Math.min(ri(w, sp.group[0], sp.group[1]), sp.cap - pop, w.cs[best].cap - w.cs[best].pop);
    const vis = sp.special === "visitor" ? nextDawn(w) : 0;
    const first = !w.journal[sp.id];
    for (let i = 0; i < Math.max(1, n); i++) spawn(w, sp.id, best, undefined, undefined, vis);
    discover(w, sp.id, best);
    if (sp.special === "visitor" && first) {
      logIt(w, "event", "An impossible visitor drifted in from somewhere that is not the tree.", sp.id);
    }
    w.arrivalCooldown = sp.rarity === "common" ? 20 : sp.rarity === "uncommon" ? 32 : 45;
    return;
  }
}

/* ------------------------------------------------------------------ */
/* Population: breeding & events                                       */
/* ------------------------------------------------------------------ */

function population(w: World) {
  const { phase } = clock(w.t);
  const pops = census(w);
  for (const sp of SPECIES) {
    const adults = w.creatures.filter((c) => c.sp === sp.id && !c.dead && !c.leaving && c.stage === "adult");
    const e = w.journal[sp.id];
    if (e) {
      e.peak = Math.max(e.peak, adults.length);
      if (!e.boomed && adults.length >= Math.max(5, sp.cap * 0.75) && sp.cap >= 6) {
        e.boomed = true;
        logIt(w, "event", `${sp.name} numbers are climbing fast.`, sp.id);
        toast(w, `${sp.name}s are multiplying`, "event");
      } else if (e.boomed && adults.length < sp.cap * 0.4) e.boomed = false;
    }
    if (!sp.repro) continue;
    const minPop = sp.repro.minPop ?? 2;
    if (adults.length < minPop || adults.length >= sp.cap || w.creatures.length >= GLOBAL_CAP) continue;
    const parent = pick(w, adults);
    const cs = w.cs[parent.ch];
    if (parent.hunger > 0.6 || parent.comfort < 0.5 || parent.scale < 0.9) continue;
    if (sp.repro.needs && !sp.repro.needs.some((k) => cs.n[k] > 0)) continue;
    if (cs.pop >= cs.cap) continue;
    if (!sp.repro.solo && adults.filter((a) => a.ch === parent.ch).length < 2) continue;
    const p = (6 / sp.repro.every) * parent.comfort * SEASON_BREED[w.season] * (1 - adults.length / sp.cap);
    if (rnd(w) >= p) continue;
    const childSp: SpeciesId | null = sp.id === "butterfly" || sp.id === "moth" ? (cs.n.leaves > 0 ? "caterpillar" : null) : sp.id;
    if (!childSp || (pops[childSp] ?? 0) >= SP[childSp].cap) continue;
    const ch = spawn(w, childSp, parent.ch, parent.x, parent.y);
    ch.scale = 0.55; ch.fade = 0.6;
    discover(w, childSp, parent.ch, "Hatched");
    if (seen(w, parent)) { const pe = w.journal[sp.id]; if (pe) pe.bred = true; }
  }

  // ---- the strange and the lovely ----
  const nextMorning = nextDawn(w);
  if (phase !== "night") { w.flags.mothNight = 0; w.flags.bloom = 0; }
  if (phase === "night" && w.weather === "rain" && !w.flags.mothNight && (pops.moth ?? 0) >= 2 && w.creatures.length < GLOBAL_CAP * 1.3) {
    const lamp = unlockedChambers(w).find((id) => w.cs[id].n.light >= 1);
    if (lamp && rnd(w) < 0.07 && w.t - ((w.flags.mothNightT as number) || -9999) > DAY_LEN * 4) {
      w.flags.mothNight = 1; w.flags.mothNightT = w.t;
      const cnt = ri(w, 14, 20);
      for (let i = 0; i < cnt; i++) spawn(w, "moth", lamp, undefined, undefined, nextMorning).fade = 0.3;
      logIt(w, "event", "Moth Night. Dozens of moths came in out of the rain, all at once, to the light.", "moth");
      toast(w, "Moth Night", "event");
      w.flags.mothNights = ((w.flags.mothNights as number) || 0) + 1;
    }
  }
  if (phase === "night" && !w.flags.bloom && (pops.glowworm ?? 0) >= 3) {
    const room = unlockedChambers(w).find((id) => { const s = w.cs[id]; return s.n.moss >= 3 && s.humid > 0.75 && s.lightPot < 0.3; });
    if (room && rnd(w) < 0.05 && w.t - ((w.flags.bloomT as number) || -9999) > DAY_LEN * 4) {
      w.flags.bloom = 1; w.flags.bloomT = w.t;
      for (let i = 0; i < 12; i++) { const g = spawn(w, "glowworm", room, undefined, undefined, nextMorning); g.fade = 0.3; g.mode = "wait"; g.dormant = false; }
      logIt(w, "event", "Glowworm Bloom. The whole wall lit up at once, green, for one night.", "glowworm");
      toast(w, "Glowworm Bloom", "event");
      w.flags.blooms = ((w.flags.blooms as number) || 0) + 1;
    }
  }
  if (phase === "night" && (pops.glowworm ?? 0) >= 1 && !w.flags.livingMoss) {
    const room = unlockedChambers(w).find((id) => { const s = w.cs[id]; return s.n.moss >= 3 && s.humid > 0.75 && s.lightPot < 0.35; });
    if (room && rnd(w) < 0.03) {
      const m = w.items.find((i) => i.ch === room && i.kind === "moss");
      if (m) {
        m.kind = "livingmoss"; m.age = 0; m.amount = 1;
        w.flags.livingMoss = 1;
        logIt(w, "event", "Living Moss. One patch you didn't plant has begun to glow, and to spread.");
        toast(w, "Living moss", "event");
      }
    }
  }
  if ((pops.ant ?? 0) >= 8 && !w.flags.colony && w.creatures.some((c) => c.sp === "ant" && c.hasHome)) {
    w.flags.colony = 1;
    logIt(w, "event", "An ant colony has established itself. The trails are getting busy.", "ant");
    toast(w, "An ant colony has formed", "event");
  }
}

/* ------------------------------------------------------------------ */
/* Growth, decay, spread  (very slow)                                  */
/* ------------------------------------------------------------------ */

function near(w: World, x: number, spread = 22) { return x + rr(w, -spread, spread); }

function growTick(w: World) {
  const days = 20 / DAY_LEN;
  const bloom = SEASON_BLOOM[w.season];
  const remove = new Set<number>();
  const adds: { k: ItemKind; ch: ChamberId; x: number; y: number; store?: number }[] = [];
  const room = (ch: ChamberId) => itemCount(w, ch) + adds.filter((a) => a.ch === ch).length < CHAMBER_ITEM_CAP;

  for (const it of w.items) {
    it.age += days;
    const cs = w.cs[it.ch], open = CH[it.ch].open;
    switch (it.kind) {
      case "flower": case "paleflower": {
        const ok = cs.lightPot > 0.3 && cs.humid > 0.25 && cs.temp > 0.25;
        it.amount = ok ? Math.min(1, it.amount + 0.25 * bloom) : Math.max(0, it.amount - 0.1);
        if (!ok && it.amount <= 0) { remove.add(it.id); cs.detritus = Math.min(1, cs.detritus + 0.1); }
        else if (it.age > (it.kind === "flower" ? 4 : 8)) { remove.add(it.id); if (room(it.ch)) adds.push({ k: "seeds", ch: it.ch, x: it.x, y: it.y, store: it.kind === "paleflower" ? 1 : 0 }); }
        break;
      }
      case "leaves": {
        const ok = cs.humid > 0.2 && cs.temp > 0.15;
        it.amount = ok ? Math.min(1, it.amount + 0.3 * (w.season === "winter" ? 0.4 : 1)) : Math.max(0, it.amount - 0.1);
        if (it.age > 7 || it.amount <= 0) {
          remove.add(it.id); cs.detritus = Math.min(1, cs.detritus + 0.15);
          if (rnd(w) < 0.5 && room(it.ch)) adds.push({ k: "seeds", ch: it.ch, x: near(w, it.x), y: it.y });
        }
        break;
      }
      case "seeds": {
        if (it.age > 1 && cs.humid > 0.4 && cs.n.soil + cs.n.moss > 0 && cs.lightPot > 0.15) {
          remove.add(it.id);
          const pale = it.store === 1 && cs.lightPot > 0.4;
          const flower = w.stage >= 2 && cs.lightPot > 0.4 && rnd(w) < 0.4 && bloom > 0.3;
          adds.push({ k: pale ? "paleflower" : flower ? "flower" : "leaves", ch: it.ch, x: it.x, y: it.y });
        } else if (it.age > 3) remove.add(it.id);
        break;
      }
      case "fruit": if (it.age > 2) { remove.add(it.id); cs.detritus = Math.min(1, cs.detritus + 0.15); cs.midges = Math.min(1, cs.midges + 0.2); if (rnd(w) < 0.4 && room(it.ch)) adds.push({ k: "fungi", ch: it.ch, x: it.x, y: it.y }); } break;
      case "nectar": if (it.age > 1.5) remove.add(it.id); break;
      case "moss": {
        it.amount = cs.humid < 0.35 ? Math.max(0, it.amount - 0.15) : Math.min(1, it.amount + 0.1);
        if (it.amount <= 0) remove.add(it.id);
        else if (cs.humid > 0.55 && cs.lightPot < 0.6 && cs.n.moss < 8 && rnd(w) < 0.2 && room(it.ch)) adds.push({ k: "moss", ch: it.ch, x: near(w, it.x, 26), y: it.y });
        break;
      }
      case "livingmoss":
        it.amount = Math.min(1, it.amount + 0.1);
        if (cs.n.livingmoss < 8 && cs.humid > 0.5 && rnd(w) < 0.35 && room(it.ch)) adds.push({ k: "livingmoss", ch: it.ch, x: near(w, it.x, 26), y: it.y });
        break;
      case "deadwood":
        if (cs.humid > 0.5 && cs.n.fungi < 3 && rnd(w) < 0.2 && room(it.ch)) adds.push({ k: "fungi", ch: it.ch, x: near(w, it.x, 18), y: it.y });
        if (it.amount <= 0.05) { remove.add(it.id); cs.detritus = Math.min(1, cs.detritus + 0.12); }
        break;
      case "hollowwood":
        if (it.age > 8 && cs.humid > 0.6) {
          it.kind = "deadwood"; it.age = 0; it.amount = 1;
          if (!w.flags.woodDecayed) { w.flags.woodDecayed = 1; logIt(w, "event", `Wood has begun to decay in the ${CH[it.ch].name}.`); }
        }
        break;
      case "twigs": if (it.age > 12 && cs.humid > 0.6 && rnd(w) < 0.3) { it.kind = "deadwood"; it.age = 0; it.amount = 1; } break;
      case "fungi":
        if (it.age > 6 && cs.humid < 0.4) remove.add(it.id);
        else it.amount = cs.humid > 0.4 ? Math.min(1, it.amount + 0.15) : it.amount;
        break;
      case "water": {
        it.amount -= 0.04 * (1 + Math.max(0, cs.temp - 0.5) * 3) * (open ? 1.3 : 0.6);
        if (open && w.rain > 0.3) it.amount += 0.5;
        else if (cs.wet > 0.3) it.amount += 0.15;
        it.amount = Math.min(1, it.amount);
        if (it.amount <= 0.05) { remove.add(it.id); logIt(w, "world", `A pool in the ${CH[it.ch].name} has dried up.`); }
        break;
      }
      case "moisture": it.amount -= 0.08; if (it.amount <= 0) remove.add(it.id); break;
      default: break;
    }
  }

  // wind & storms: strip leaves, tear webs in open chambers
  if (w.wind > 0.5) {
    for (const id of unlockedChambers(w)) {
      if (!CH[id].open) continue;
      const lf = w.items.find((i) => i.ch === id && i.kind === "leaves" && !remove.has(i.id));
      if (lf && rnd(w) < 0.15) remove.add(lf.id);
    }
    const torn = w.webs.filter((wb) => CH[wb.ch].open && rnd(w) < 0.4);
    if (torn.length) {
      for (const wb of torn) { const o = w.creatures.find((c) => c.id === wb.owner); if (o) { o.webId = 0; o.mode = "wander"; o.timer = 0; } }
      w.webs = w.webs.filter((wb) => !torn.includes(wb));
      if (w.weather === "storm" && !w.flags.stormWeb) { w.flags.stormWeb = 1; logIt(w, "event", "The storm tore a web apart. The spider will start again."); }
    }
  }
  // autumn: leaves fall and accumulate downward
  if (w.season === "autumn") {
    for (const id of unlockedChambers(w)) {
      if (!CH[id].open || w.cs[id].n.leaves < 1 || rnd(w) > 0.3) continue;
      const below = CH[id].adj.filter((a) => isOpen(w, a) && CH[a].y > CH[id].y);
      if (below.length) { const dest = pick(w, below); if (room(dest)) adds.push({ k: "leaves", ch: dest, x: rr(w, CH[dest].x + 20, CH[dest].x + CH[dest].w - 20), y: CH[dest].y + CH[dest].h - 10 }); }
    }
  }
  for (const c of CHAMBERS) {
    const cs = w.cs[c.id];
    cs.detritus *= 0.96;
    if (cs.detritus > 0.5 && cs.humid > 0.5 && cs.n.fungi < 3 && rnd(w) < 0.2 && room(c.id) && c.stage <= w.stage) {
      adds.push({ k: "fungi", ch: c.id, x: rr(w, c.x + 20, c.x + c.w - 20), y: c.y + c.h - 10 });
    }
  }
  if (remove.size) w.items = w.items.filter((i) => !remove.has(i.id));
  for (const a of adds) {
    if (itemCount(w, a.ch) >= CHAMBER_ITEM_CAP) continue;
    const it = putItem(w, a.k, a.ch, a.x, a.y);
    if (a.store) it.store = a.store;
    if (a.k === "fungi" && !w.flags.fungiSeen && !w.items.some((i) => i.id !== it.id && i.kind === "fungi")) {
      w.flags.fungiSeen = 1;
      logIt(w, "event", `Fungi have appeared in the ${CH[a.ch].name}.`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Weather & seasons                                                   */
/* ------------------------------------------------------------------ */

const WEATHER_WEIGHTS: Record<Season, Partial<Record<Weather, number>>> = {
  spring: { clear: 40, rain: 35, wind: 10, heat: 5, cold: 5, storm: 5 },
  summer: { clear: 40, rain: 15, heat: 25, storm: 12, wind: 8 },
  autumn: { clear: 30, rain: 30, wind: 20, cold: 10, storm: 10 },
  winter: { clear: 35, cold: 35, rain: 10, wind: 10, storm: 10 },
};
function weatherUnlocked(w: World, k: Weather) {
  if (k === "clear" || k === "rain") return true;
  if (k === "wind" || k === "heat") return w.stage >= 2;
  if (k === "cold") return w.stage >= 3;
  return w.stage >= 4;
}
function pickWeather(w: World) {
  const prev = w.weather;
  if (prev === "rain" || prev === "storm") w.lastRainEnd = w.t;
  let next: Weather = "clear";
  if (!w.rainSeen && w.t > 90) next = "rain";
  else {
    const opts = (Object.entries(WEATHER_WEIGHTS[w.season]) as [Weather, number][]).filter(([k]) => k !== prev && weatherUnlocked(w, k));
    const total = opts.reduce((s, [, v]) => s + v, 0);
    let r = rnd(w) * total;
    for (const [k, v] of opts) { r -= v; if (r <= 0) { next = k; break; } }
  }
  w.weather = next;
  w.weatherLeft = rr(w, 45, 110);
  if (next === "rain" || next === "storm") w.rainSeen = true;
  if (next === "storm") { logIt(w, "world", "A storm is coming in."); }
}

function seasonTick(w: World) {
  if (w.t - w.seasonStart < SEASON_LEN) return;
  const open = unlockedSeasons(w.stage);
  const i = open.indexOf(w.season);
  const next = open[(i + 1) % open.length];
  w.seasonStart = w.t;
  if (next === w.season) return;
  w.season = next;
  const text: Record<Season, string> = {
    spring: "Spring. Flowers are blooming and numbers are rising.",
    summer: "Summer. High activity and strong growth.",
    autumn: "Autumn. Leaves are falling and food is changing.",
    winter: "Winter. Things are slowing down, and different species may show.",
  };
  logIt(w, "world", text[next]);
  toast(w, next[0].toUpperCase() + next.slice(1), "info");
  if (next === "winter") logIt(w, "world", "Migrants are leaving for warmer places.");
}

/* ------------------------------------------------------------------ */
/* Behaviour: decisions (periodic)                                     */
/* ------------------------------------------------------------------ */

function setMode(c: Creature, m: Mode) { c.mode = m; c.mtimer = 0; }

function itemTarget(c: Creature, it: Item) {
  const sp = SP[c.sp];
  c.tx = it.x;
  c.ty = isGround(sp) ? clamp(it.y, bandOf(c.ch).y0, bandOf(c.ch).y1) : it.y;
}

function nearestItem(w: World, c: Creature, kinds: ItemKind[], minAmt: number): Item | null {
  let best: Item | null = null, bd = Infinity;
  for (const it of w.items) {
    if (it.ch !== c.ch || !kinds.includes(it.kind) || it.amount < minAmt) continue;
    const d = (it.x - c.x) ** 2 + (it.y - c.y) ** 2;
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

function nearestCreature(w: World, c: Creature, kinds: SpeciesId[]): Creature | null {
  let best: Creature | null = null, bd = Infinity;
  for (const o of w.creatures) {
    if (o.dead || o.ch !== c.ch || o.id === c.id || o.leaving || o.stage === "pupa" || !kinds.includes(o.sp)) continue;
    if (o.hidden && rnd(w) < 0.6) continue;
    const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function startTransit(c: Creature, to: ChamberId) {
  const dp = doorPoint(c.ch, to);
  c.transitTo = to; setMode(c, "transit"); c.tx = dp.x; c.ty = dp.y; c.hidden = false;
}

function goRest(w: World, c: Creature) {
  const sp = SP[c.sp];
  const it = sp.shelter.length ? nearestItem(w, c, sp.shelter, -1) : null;
  setMode(c, "rest");
  if (it) { c.tItem = it.id; itemTarget(c, it); }
  else { c.tItem = 0; c.tx = c.x; c.ty = c.y; }
}

function bestAdjacent(w: World, c: Creature, explore: boolean): ChamberId | null {
  const sp = SP[c.sp];
  const here = foodScore(w, sp, w.cs[c.ch], c.ch);
  let best: ChamberId | null = null, bs = explore ? 0.15 : here + 0.15;
  for (const a of CH[c.ch].adj) {
    if (!isOpen(w, a)) continue;
    const cs = w.cs[a];
    if (rangeScore(cs.temp, sp.temp, 0.25) < 0.3 || rangeScore(cs.humid, sp.humid, 0.25) < 0.3) continue;
    if (!explore && cs.pop >= cs.cap + 3) continue;
    const s = explore ? 0.3 + rnd(w) * 0.4 + (sp.chambers.includes(a) ? 0.3 : 0) : foodScore(w, sp, cs, a);
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}

function resSpot(w: World, c: Creature, r: ResKind) {
  const kinds: Record<ResKind, ItemKind[]> = { aphids: ["leaves", "flower", "paleflower"], midges: ["water", "flower", "fruit", "paleflower"], detritus: ["deadwood", "leaves", "soil"], carrion: [] };
  const cand = w.items.filter((i) => i.ch === c.ch && kinds[r].includes(i.kind));
  if (cand.length) { const it = pick(w, cand); c.tx = near(w, it.x, 10); c.ty = isGround(SP[c.sp]) ? clamp(it.y, bandOf(c.ch).y0, bandOf(c.ch).y1) : it.y - rr(w, 2, 14); }
  else { const p = pickPoint(w, c); c.tx = p.x; c.ty = p.y; }
}

function forage(w: World, c: Creature): boolean {
  const sp = SP[c.sp], cs = w.cs[c.ch];
  if (sp.food.items?.length) {
    const it = nearestItem(w, c, sp.food.items, 0.1);
    if (it) { c.tItem = it.id; c.res = ""; setMode(c, "forage"); itemTarget(c, it); return true; }
  }
  if (sp.food.res) {
    for (const r of sp.food.res) {
      if (cs[r] > 0.12) { c.res = r; c.tItem = 0; setMode(c, "forage"); resSpot(w, c, r); return true; }
    }
  }
  if (sp.food.prey?.length) {
    const t = nearestCreature(w, c, sp.food.prey);
    if (t) { c.tCre = t.id; setMode(c, "hunt"); return true; }
  }
  const dest = bestAdjacent(w, c, false);
  if (dest) { startTransit(c, dest); return true; }
  return false;
}

function wander(w: World, c: Creature) {
  const sp = SP[c.sp];
  setMode(c, "wander");
  if (rnd(w) < 0.1 && sp.special !== "visitor") {
    const dest = bestAdjacent(w, c, true);
    if (dest && (sp.chambers.includes(dest) || rnd(w) < 0.15)) { startTransit(c, dest); return; }
  }
  // curiosity: sometimes drift to an item
  if (rnd(w) < 0.3) {
    const here = w.items.filter((i) => i.ch === c.ch);
    if (here.length) { itemTarget(c, pick(w, here)); c.tx = near(w, c.tx, 14); return; }
  }
  const p = pickPoint(w, c);
  c.tx = p.x; c.ty = p.y;
}

function findHive(w: World, c: Creature): Item | null {
  return nearestItem(w, c, ["hollowwood"], -1) ?? nearestItem(w, c, ["bark"], -1) ?? nearestItem(w, c, ["twigs"], -1);
}

function decide(w: World, c: Creature) {
  const sp = SP[c.sp], cs = w.cs[c.ch];
  c.timer = rr(w, 0.8, 2);
  if (c.stage === "pupa" || c.mode === "caught" || c.leaving) return;
  if (c.mode === "transit" || c.mode === "flee" || c.mode === "hunt") { if (c.mtimer < 8) return; }
  if (c.mode === "forage" && c.mtimer < 10) {
    const ok = c.res ? true : w.items.some((i) => i.id === c.tItem && i.amount > 0.05);
    if (ok) return;
  }
  if (c.mode === "haul" && c.mtimer < 14) return;
  if (c.mode === "web" && c.mtimer < 30) return;
  if (c.mode === "orbit" && c.mtimer < 12) return;
  if (c.mode === "wait" && c.pause > 0) return;
  if (c.mode === "wait" && c.dormant && c.hidden) return;

  if (sp.special === "visitor") {
    const open = unlockedChambers(w);
    const id = pick(w, open), d = CH[id];
    setMode(c, "wander"); c.tx = rr(w, d.x + 20, d.x + d.w - 20); c.ty = rr(w, d.y + 20, d.y + d.h - 20);
    return;
  }

  // ---- spiders: the web comes first ----
  if (sp.special === "web") {
    let web = w.webs.find((x) => x.id === c.webId);
    if (web && web.ch !== c.ch) { web = undefined; c.webId = 0; }
    if (!web && !(c.dormant && c.hunger < 0.8)) {
      const anchor = nearestItem(w, c, ["twigs"], -1) ?? nearestItem(w, c, ["leaves"], -1);
      if (anchor) {
        const d = CH[c.ch], r = c.sp === "jewelspider" ? 30 : 26;
        web = { id: w.nextId++, ch: c.ch, x: clamp(anchor.x, d.x + r, d.x + d.w - r), y: clamp(anchor.y - 6, d.y + 26, d.y + d.h - 26), r, built: 0, owner: c.id };
        w.webs.push(web); c.webId = web.id;
      }
    }
    if (web) {
      c.tx = web.x; c.ty = web.y;
      if (web.built < 1) { setMode(c, "web"); witness(w, c, "behavior"); return; }
      if (c.hunger > 0.85 && forage(w, c)) return;
      setMode(c, "wait"); c.hidden = false;
      return;
    }
  }

  // ---- dormancy: go and rest ----
  if (c.dormant && c.hunger < 0.8) {
    if (sp.special === "glow" || sp.special === "ambush") { if (c.mode === "wait") return; }
    goRest(w, c);
    return;
  }

  // ---- caterpillars pupate when grown ----
  if (c.sp === "caterpillar" && c.growth >= 1 && !c.dormant) {
    c.stage = "pupa"; c.mtimer = 40; setMode(c, "pupa"); c.hidden = false;
    witness(w, c, "behavior");
    return;
  }

  // ---- colony / hive routines ----
  if (sp.special === "colony") {
    if (!c.hasHome) {
      const it = nearestItem(w, c, ["soil", "bark", "stones"], -1);
      if (it) { c.homeX = it.x; c.homeY = clamp(it.y, bandOf(c.ch).y0, bandOf(c.ch).y1); c.homeItem = it.id; }
      else { const p = pickPoint(w, c); c.homeX = p.x; c.homeY = p.y; }
      c.hasHome = true;
    }
    if (c.carrying) { setMode(c, "haul"); c.tx = c.homeX; c.ty = c.homeY; return; }
    if (c.hunger > 0.15 || rnd(w) < 0.6) { if (forage(w, c)) return; }
  } else if (sp.special === "hive") {
    const hive = findHive(w, c);
    if (c.carrying && hive) { setMode(c, "haul"); itemTarget(c, hive); c.tItem = hive.id; return; }
    if (hive && c.hunger > 0.3 && hive.store > 0.1) { setMode(c, "haul"); itemTarget(c, hive); c.tItem = hive.id; return; }
    if (forage(w, c)) return;
  } else if (sp.special === "hoverpatrol") {
    if (c.hunger > 0.25 || rnd(w) < 0.7) {
      const water = w.items.filter((i) => i.ch === c.ch && i.kind === "water");
      setMode(c, "patrol");
      if (water.length) { const it = pick(w, water); c.tx = near(w, it.x, 40); c.ty = rr(w, CH[c.ch].y + 18, CH[c.ch].y + CH[c.ch].h * 0.55); }
      else { const p = pickPoint(w, c); c.tx = p.x; c.ty = p.y; }
      return;
    }
  } else if (sp.special === "ambush") {
    if (!c.hasHome || c.homeItem && !w.items.some((i) => i.id === c.homeItem)) {
      const it = nearestItem(w, c, ["twigs", "leaves", "flower"], -1);
      if (it) { c.homeX = it.x; c.homeY = it.y; c.homeItem = it.id; c.hasHome = true; setMode(c, "sun"); c.tx = it.x; c.ty = it.y; return; }
    } else if (c.mode !== "wait") { setMode(c, "sun"); c.tx = c.homeX; c.ty = c.homeY; return; }
    if (c.hunger > 0.7 && c.mtimer > 6 && rnd(w) < 0.25) { const dest = bestAdjacent(w, c, true); if (dest) { c.hasHome = false; startTransit(c, dest); return; } }
    return;
  } else if (sp.special === "glow") {
    if (!c.hasHome) {
      const it = nearestItem(w, c, ["moss", "livingmoss", "stones", "deadwood"], -1);
      if (it) { c.homeX = it.x; c.homeY = clamp(it.y, bandOf(c.ch).y0, bandOf(c.ch).y1); c.hasHome = true; setMode(c, "sun"); c.tx = c.homeX; c.ty = c.homeY; return; }
    } else if (c.mode !== "wait") { setMode(c, "sun"); c.tx = c.homeX; c.ty = c.homeY; return; }
    if (c.hunger > 0.8 && forage(w, c)) return;
    return;
  } else if (sp.special === "sun") {
    if (c.hunger > 0.3 && forage(w, c)) return;
    const r = rnd(w);
    if (r < 0.45) {
      const lamp = nearestItem(w, c, ["light"], -1);
      setMode(c, "sun");
      if (lamp) { c.tx = lamp.x; c.ty = lamp.y + 8; } else if (CH[c.ch].open) { c.tx = rr(w, CH[c.ch].x + 20, CH[c.ch].x + CH[c.ch].w - 20); c.ty = CH[c.ch].y + 16; } else { wander(w, c); }
      return;
    }
    if (r < 0.7) { const lf = nearestItem(w, c, ["leaves", "twigs"], -1); if (lf) { setMode(c, "sun"); itemTarget(c, lf); return; } }
  } else if (sp.special === "light") {
    if (c.hunger > 0.3 && forage(w, c)) return;
    const lamp = nearestItem(w, c, ["light"], -1);
    if (lamp && clock(w.t).phase !== "day") { c.tItem = lamp.id; setMode(c, "orbit"); return; }
  }

  // ---- generic foraging ----
  if (c.hunger > 0.3 && !sp.noFood && forage(w, c)) return;

  // clockwork: wind down, rest, wind up
  if (c.sp === "clockwork" && rnd(w) < 0.25) { setMode(c, "wait"); c.pause = rr(w, 5, 10); return; }
  // glass beetle drinks
  if (c.sp === "glassbeetle") { const wtr = nearestItem(w, c, ["water"], 0.1); if (wtr && rnd(w) < 0.5) { c.tItem = wtr.id; setMode(c, "forage"); itemTarget(c, wtr); return; } }
  if (cs.pop > cs.cap && rnd(w) < 0.4) { const dest = bestAdjacent(w, c, true); if (dest) { startTransit(c, dest); return; } }
  wander(w, c);
}

/* ------------------------------------------------------------------ */
/* Behaviour: movement (continuous)                                    */
/* ------------------------------------------------------------------ */

function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function scanThreats(w: World, c: Creature) {
  const sp = SP[c.sp];
  const preds = PREDATORS[c.sp];
  if (preds && c.mode !== "hunt" && c.mode !== "caught" && c.mode !== "flee" && !c.hidden && c.stage !== "pupa") {
    for (const p of w.creatures) {
      if (p.dead || p.ch !== c.ch || !preds.includes(p.sp) || p.dormant || p.stage === "pupa") continue;
      if (p.mode === "wait" || p.mode === "rest" || p.mode === "web") continue;
      if (Math.hypot(p.x - c.x, p.y - c.y) < 38) {
        const d = CH[c.ch];
        const dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy) || 1;
        setMode(c, "flee");
        c.tx = clamp(c.x + (dx / l) * 70, d.x + 10, d.x + d.w - 10);
        c.ty = isGround(sp) ? clamp(c.y + (dy / l) * 30, bandOf(c.ch).y0, bandOf(c.ch).y1) : clamp(c.y + (dy / l) * 50, d.y + 10, d.y + d.h - 10);
        break;
      }
    }
  }
  if (sp.special === "ambush" && !c.dormant && c.hunger > 0.25 && (c.mode === "wait" || c.mode === "sun" || c.mode === "wander") && sp.food.prey) {
    for (const o of w.creatures) {
      if (o.dead || o.ch !== c.ch || o.leaving || o.hidden || o.stage === "pupa" || !sp.food.prey.includes(o.sp)) continue;
      if (Math.hypot(o.x - c.x, o.y - c.y) < 56) { c.tCre = o.id; setMode(c, "hunt"); break; }
    }
  }
}

function eat(w: World, c: Creature, amt = 0.45) {
  c.hunger = Math.max(0, c.hunger - amt);
  witness(w, c, "ate");
}

function eatAt(w: World, c: Creature) {
  const sp = SP[c.sp], cs = w.cs[c.ch];
  if (c.res) {
    const r = c.res;
    c.res = "";
    if (cs[r] > 0.05) {
      cs[r] = Math.max(0, cs[r] - 0.1);
      if (sp.special === "colony") { c.carrying = "crumb"; witness(w, c, "behavior"); }
      else eat(w, c, 0.4);
      c.pause = 1;
    }
    c.timer = 0.2; setMode(c, "wander");
    return;
  }
  const it = w.items.find((i) => i.id === c.tItem);
  if (!it || it.amount < 0.05) { c.timer = 0; setMode(c, "wander"); return; }
  const k = it.kind;
  const renew = k === "flower" || k === "paleflower" || k === "leaves" || k === "moss" || k === "livingmoss" || k === "fungi" || k === "water" || k === "deadwood";
  const bite = k === "water" ? 0.04 : renew ? 0.15 : 0.3;
  if (sp.special === "colony") {
    it.amount = Math.max(0, it.amount - bite * 0.5); c.carrying = "crumb"; witness(w, c, "behavior");
  } else if (sp.special === "hive" && (k === "flower" || k === "paleflower" || k === "nectar") && c.hunger < 0.55) {
    it.amount = Math.max(0, it.amount - 0.08); c.carrying = "nectar"; witness(w, c, "behavior"); pollinate(w, c, it);
  } else {
    it.amount = Math.max(0, it.amount - bite);
    eat(w, c, k === "water" ? 0.12 : 0.45);
    if (c.sp === "caterpillar") c.growth += 0.2;
    if (k === "flower" || k === "paleflower") pollinate(w, c, it);
    if (k === "deadwood" && it.amount <= 0.05) { it.amount = 0; }
  }
  c.pause = isGround(sp) ? 1.2 : 0.5;
  c.timer = 0.3; setMode(c, "wander");
}

function pollinate(w: World, c: Creature, it: Item) {
  if (c.sp !== "bee" && c.sp !== "butterfly" && c.sp !== "moth") return;
  if (c.pollen && c.homeItem !== it.id && rnd(w) < 0.3 && itemCount(w, c.ch) < CHAMBER_ITEM_CAP && w.cs[c.ch].n[it.kind] < 7) {
    const f = putItem(w, it.kind, c.ch, near(w, it.x, 55), it.y);
    f.amount = 0.5;
    witness(w, c, "relation");
    if (!w.flags.spread) { w.flags.spread = 1; logIt(w, "event", `A flower has spread in the ${CH[c.ch].name}. A ${SP[c.sp].name.toLowerCase()} carried the pollen.`, c.sp); toast(w, "A flower spread", "event"); }
    c.pollen = false;
  } else { c.pollen = true; c.homeItem = it.id; }
}

function deposit(w: World, c: Creature) {
  const sp = SP[c.sp];
  if (sp.special === "colony") {
    if (c.carrying) { c.carrying = ""; eat(w, c, 0.35); c.pause = 0.6; }
    setMode(c, "wander"); c.timer = 0.2;
    return;
  }
  if (sp.special === "hive") {
    const hive = w.items.find((i) => i.id === c.tItem);
    if (hive) {
      if (c.carrying) { hive.store = Math.min(1, hive.store + 0.1); c.carrying = ""; c.hunger = Math.max(0, c.hunger - 0.12); witness(w, c, "behavior"); }
      else if (hive.store > 0.1) { hive.store -= 0.1; eat(w, c, 0.45); }
    } else c.carrying = "";
    c.pause = 1.2; setMode(c, "wander"); c.timer = 0.2;
    return;
  }
  setMode(c, "wander");
}

function resolveHunt(w: World, c: Creature, t: Creature) {
  const caught = t.mode === "caught";
  const p = caught ? 1 : 0.5 * (t.hidden ? 0.3 : 1);
  if (rnd(w) < p) {
    kill(w, t, caught ? "caught" : "eaten");
    c.hunger = Math.max(0, c.hunger - 0.7);
    c.pause = 3; c.timer = 0.3; setMode(c, SP[c.sp].special === "ambush" || SP[c.sp].special === "web" ? "wait" : "wander");
    witness(w, c, "ate"); witness(w, c, "relation"); witness(w, t, "relation");
    const key = `kill:${c.sp}:${t.sp}`;
    if (!w.visitedPairs[key]) {
      w.visitedPairs[key] = true;
      logIt(w, "event", `A ${SP[c.sp].name.toLowerCase()} caught a ${SP[t.sp].name.toLowerCase()} in the ${CH[c.ch].name}. The web of who-eats-whom just got a line.`, c.sp);
      if (c.sp === "orbspider" || c.sp === "mantis" || !w.flags.firstKill) { w.flags.firstKill = 1; toast(w, "A predator made a catch", "event"); }
    }
  } else {
    const d = CH[c.ch];
    const dx = t.x - c.x, dy = t.y - c.y, l = Math.hypot(dx, dy) || 1;
    setMode(t, "flee");
    t.tx = clamp(t.x + (dx / l) * 70, d.x + 10, d.x + d.w - 10);
    t.ty = isGround(SP[t.sp]) ? clamp(t.y + (dy / l) * 25, bandOf(t.ch).y0, bandOf(t.ch).y1) : clamp(t.y + (dy / l) * 40, d.y + 10, d.y + d.h - 10);
    c.pause = 1.2; c.timer = 0.2; setMode(c, SP[c.sp].special === "ambush" ? "wait" : "wander");
  }
}

function onArrive(w: World, c: Creature) {
  const sp = SP[c.sp];
  switch (c.mode) {
    case "transit": {
      const to = c.transitTo;
      if (!to) { setMode(c, "wander"); break; }
      const from = c.ch;
      const dp = doorPoint(to, from);
      c.ch = to; c.x = dp.x; c.y = dp.y; c.transitTo = "";
      c.hasHome = false; c.homeItem = 0; c.webId = 0; c.hidden = false;
      c.seenChambers |= 1 << chIndex(to);
      const e = w.journal[c.sp];
      if (e && seen(w, c)) e.chambers |= 1 << chIndex(to);
      const key = `${c.sp}:${to}`;
      if (!w.visitedPairs[key]) {
        w.visitedPairs[key] = true;
        if (sp.rarity !== "common") logIt(w, "event", `A ${sp.name.toLowerCase()} wandered into the ${CH[to].name} for the first time.`, c.sp);
      }
      setMode(c, "wander"); c.timer = 0.3;
      break;
    }
    case "forage": eatAt(w, c); break;
    case "haul": deposit(w, c); break;
    case "rest": c.hidden = c.tItem > 0 && w.items.some((i) => i.id === c.tItem); setMode(c, "wait"); break;
    case "sun": setMode(c, "wait"); c.timer = rr(w, 4, 7); c.pause = c.timer; witness(w, c, "behavior"); break;
    case "patrol": {
      const cs = w.cs[c.ch];
      if (rnd(w) < 0.35 && cs.midges > 0.1) { cs.midges -= 0.05; eat(w, c, 0.3); }
      c.pause = rr(w, 1, 2.2); c.timer = 0.1; setMode(c, "wander");
      break;
    }
    case "flee": setMode(c, "wander"); c.timer = 0.2; break;
    case "wander": c.timer = Math.min(c.timer, 0.25); c.pause = isGround(sp) ? rr(w, 0, 1.2) : 0; break;
    default: break;
  }
}

function moveCreature(w: World, c: Creature, dt: number) {
  if (c.dead || c.stage === "pupa") return;
  const sp = SP[c.sp];
  if (c.leaving) { c.fade -= dt * 0.5; if (c.fade <= 0) c.dead = true; return; }
  if (c.fade < 1) c.fade = Math.min(1, c.fade + dt * 0.5);
  c.mtimer += dt; c.wob += dt;
  if (c.mode === "caught") { c.wob += dt * 6; return; }
  c.chk -= dt;
  if (c.chk <= 0) { c.chk = 0.35; scanThreats(w, c); }
  if (c.mode === "wait") return;
  if (c.pause > 0) { c.pause -= dt; c.lift = 0; return; }

  let v = sp.speed * Math.sqrt(c.scale);
  if (c.mode === "hunt") {
    const t = w.creatures.find((k) => k.id === c.tCre);
    if (!t || t.dead || t.ch !== c.ch) { setMode(c, "wander"); c.timer = 0; return; }
    c.tx = t.x; c.ty = t.y;
    const reach = sp.size * 0.5 + SP[t.sp].size * 0.5 + 3;
    const dd = Math.hypot(t.x - c.x, t.y - c.y);
    if (dd < reach) { resolveHunt(w, c, t); return; }
    v *= sp.special === "ambush" && dd < 70 ? 5 : 1.3;
  } else if (c.mode === "orbit") {
    const it = w.items.find((i) => i.id === c.tItem);
    if (!it) { setMode(c, "wander"); c.timer = 0; return; }
    c.orbitA += dt * 2.2;
    c.tx = it.x + Math.cos(c.orbitA) * 16; c.ty = it.y + Math.sin(c.orbitA) * 9 + 3;
  } else if (c.mode === "flee") v *= 1.8;
  else if (c.mode === "wander") v *= 0.75;
  else if (c.mode === "rest") v *= 0.7;

  let dx = c.tx - c.x, dy = c.ty - c.y;
  const d = Math.hypot(dx, dy);
  const R = isGround(sp) ? 4 : 6 + sp.size * 0.4;
  if (d < R && c.mode !== "orbit" && c.mode !== "hunt") { onArrive(w, c); return; }
  if (c.mode === "web" && d < 10) return;
  if (c.mode === "web") { /* keep walking to the hub */ }
  if (c.mode === "forage" || c.mode === "haul" || c.mode === "transit" || c.mode === "rest" || c.mode === "sun") { if (c.mtimer > 25) { setMode(c, "wander"); c.timer = 0; return; } }

  let turn = 8, hv = 0;
  switch (sp.move) {
    case "crawl": v *= 0.75 + 0.25 * Math.sin(c.wob * 7); break;
    case "scuttle": c.cycle += dt; v = c.cycle % 0.8 < 0.4 ? v * 1.7 : 0; break;
    case "hop": { c.cycle += dt; const hp = c.cycle % 1.3; if (hp < 0.35) { v *= 3.2; c.lift = Math.sin((Math.PI * hp) / 0.35) * 9; } else { v = 0; c.lift = 0; } break; }
    case "tick": c.cycle += dt; v = c.cycle % 1 < 0.2 ? v * 4 : 0; turn = 30; break;
    case "hover": c.cycle += dt; v = c.cycle % 2.6 < 0.5 ? v * 2.2 : v * 0.12; c.lift = Math.sin(c.wob * 5) * 1.5; turn = 6; break;
    case "snail": v *= 0.85 + 0.15 * Math.sin(c.wob * 1.5); break;
    case "stalk": v *= 0.4 + 0.6 * Math.max(0, Math.sin(c.wob * 0.9)); turn = 4; break;
    case "flutter": v *= 0.7 + 0.5 * Math.abs(Math.sin(c.wob * 4)); hv = Math.sin(c.wob * 2.3) * 0.9 + Math.sin(c.wob * 5.1) * 0.4; turn = 5; c.lift = Math.sin(c.wob * 9) * 2; break;
    case "fly": hv = Math.sin(c.wob * 3) * 0.25; turn = 7; c.lift = Math.sin(c.wob * 14) * 1.2; break;
    case "drift": v *= 0.8 + 0.2 * Math.sin(c.wob * 0.8); hv = Math.sin(c.wob * 0.7) * 0.5; turn = 2.5; c.lift = Math.sin(c.wob * 1.1) * 3; break;
  }
  if (v <= 0) return;
  const want = Math.atan2(dy, dx) + hv;
  const diff = angDiff(c.heading, want);
  c.heading += Math.sign(diff) * Math.min(Math.abs(diff), turn * dt);
  const step = Math.min(v * dt, d + 1);
  c.x += Math.cos(c.heading) * step;
  c.y += Math.sin(c.heading) * step;
  if (sp.special === "visitor") {
    const here = chamberAt(w, c.x, c.y, 6);
    if (here) c.ch = here;
  } else {
    const dd = CH[c.ch];
    c.x = clamp(c.x, dd.x + 5, dd.x + dd.w - 5);
    c.y = clamp(c.y, dd.y + 5, dd.y + dd.h - 5);
  }
  dx = 0; dy = 0;
}

/* ------------------------------------------------------------------ */
/* Stepping                                                            */
/* ------------------------------------------------------------------ */

function webTick(w: World) {
  for (const web of w.webs) {
    const o = w.creatures.find((c) => c.id === web.owner);
    if (!o || o.dead) continue;
    if (web.built < 1 && o.mode === "web" && Math.hypot(o.x - web.x, o.y - web.y) < 14) {
      web.built = Math.min(1, web.built + 1 / 12);
      if (web.built >= 1) { setMode(o, "wait"); witness(w, o, "behavior"); }
    }
  }
}

function step(w: World, h: number) {
  w.t += h;
  const { phase } = clock(w.t);
  if (phase !== w.phase) {
    w.phase = phase;
    for (const c of w.creatures) {
      if (c.dead || c.stage === "pupa") continue;
      rollDormant(w, c);
      if (!c.dormant) { c.hidden = false; if (c.mode === "wait" || c.mode === "rest") { c.mode = "wander"; c.timer = rr(w, 0, 3); c.pause = 0; } }
      else if (c.mode === "wait" && !c.hidden) c.timer = rr(w, 0, 2);
    }
  }
  w.weatherLeft -= h;
  if (w.weatherLeft <= 0) pickWeather(w);
  seasonTick(w);
  w.tEnv += h; w.tSlow += h; w.tGrow += h;
  if (w.tEnv >= 1) { w.tEnv -= 1; envTick(w); webTick(w); }
  if (w.tSlow >= 6) { w.tSlow -= 6; arrivals(w); population(w); }
  if (w.tGrow >= 20) { w.tGrow -= 20; growTick(w); }
  for (const c of w.creatures) {
    if (c.dead) continue;
    c.timer -= h;
    if (c.timer <= 0 && c.stage !== "pupa") decide(w, c);
    moveCreature(w, c, h);
  }
  if (w.creatures.some((c) => c.dead)) w.creatures = w.creatures.filter((c) => !c.dead);
}

/** Advance the hotel by `dt` simulated seconds. */
export function advance(w: World, dt: number) {
  let left = Math.min(dt, 30);
  while (left > 0) {
    const h = Math.min(0.1, left);
    left -= h;
    step(w, h);
  }
}

/* ------------------------------------------------------------------ */
/* Reading state                                                       */
/* ------------------------------------------------------------------ */

export function describeCreature(_w: World, c: Creature): string {
  const sp = SP[c.sp];
  if (c.stage === "pupa") return "Hanging still in a chrysalis, changing.";
  if (c.leaving) return "Leaving.";
  if (c.dormant && (c.mode === "wait" || c.mode === "rest")) return c.hidden ? "Resting, tucked out of sight." : "Resting.";
  switch (c.mode) {
    case "forage": return c.res ? `Looking for ${RES_WORD[c.res]}.` : sp.special === "colony" ? "Looking for something to carry home." : "Looking for food.";
    case "hunt": return c.caughtBy ? "Closing in." : "Hunting.";
    case "haul": return c.carrying === "nectar" ? "Carrying nectar home." : c.carrying ? "Carrying a crumb home." : "Heading home to eat.";
    case "web": return "Spinning a web.";
    case "wait": return sp.special === "web" ? "Waiting at the centre of its web." : sp.special === "ambush" ? "Perfectly still. Waiting." : sp.special === "glow" ? "Glowing, low on the wall." : "Staying put.";
    case "flee": return "Getting away from something.";
    case "caught": return "Stuck in a web.";
    case "sun": return sp.special === "ambush" ? "Taking up a perch." : "Looking for a good spot.";
    case "orbit": return "Circling the light.";
    case "patrol": return "Patrolling over open water.";
    case "transit": return `Heading for the ${CH[c.transitTo || c.ch].name}.`;
    case "rest": return "Looking for somewhere to rest.";
    default: return c.hunger > 0.7 ? "Wandering. Hungry." : "Wandering.";
  }
}

export function mood(c: Creature): "settled" | "uneasy" | "unhappy" {
  return c.comfort > 0.7 ? "settled" : c.comfort > 0.4 ? "uneasy" : "unhappy";
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

export function serialize(w: World): string {
  const { toasts: _t, view: _v, ...rest } = w;
  void _t; void _v;
  return JSON.stringify(rest);
}

export function deserialize(s: string): World | null {
  try {
    const o = JSON.parse(s);
    if (!o || o.v !== 1 || !Array.isArray(o.items) || !Array.isArray(o.creatures)) return null;
    const base = createWorld(1);
    const w: World = { ...base, ...o, toasts: [], view: base.view };
    for (const c of CHAMBERS) {
      w.cs[c.id] = { ...emptyChamberState(c.id), ...(o.cs?.[c.id] ?? {}) };
      w.cs[c.id].n = { ...ZERO_N(), ...(o.cs?.[c.id]?.n ?? {}) };
    }
    return w;
  } catch {
    return null;
  }
}

/** Why can't this species arrive right now? (diagnostics for tests) */
export function arrivalReport(w: World, id: SpeciesId): string[] {
  const sp = SP[id];
  const pops = census(w);
  const kinds = Object.keys(pops).length;
  const phase = clock(w.t).phase;
  const out: string[] = [`phase=${phase} weather=${w.weather} cooldown=${w.arrivalCooldown} total=${w.creatures.length} kinds=${kinds}`];
  if (sp.arrive && !sp.arrive.includes(phase)) out.push("wrong phase for arrival");
  for (const ch of sp.chambers) {
    if (!isOpen(w, ch)) { out.push(`${ch}: locked`); continue; }
    const cs = w.cs[ch];
    const req = sp.req ? REQ[sp.req]({ w, ch, cs, n: cs.n, phase, pops, kinds, stage: w.stage }) : true;
    out.push(`${ch}: suit=${suitability(w, sp, ch).toFixed(2)} req=${req} pop=${cs.pop}/${cs.cap} T=${cs.temp.toFixed(2)} H=${cs.humid.toFixed(2)} L=${cs.lightPot.toFixed(2)}`);
  }
  return out;
}

/** Where an item of this kind would actually land if dropped at (x, y). */
export function snapPoint(kind: ItemKind, ch: ChamberId, x: number, y: number) {
  const d = CH[ch], def = ITEM[kind];
  const px = clamp(x, d.x + 14, d.x + d.w - 14);
  let py = y;
  if (def.anchor === "floor") py = clamp(y, d.y + d.h * 0.58, d.y + d.h - 10);
  else if (def.anchor === "air") py = clamp(y, d.y + 12, d.y + d.h * 0.5);
  else py = clamp(y, d.y + 14, d.y + d.h - 12);
  return { x: px, y: py };
}
