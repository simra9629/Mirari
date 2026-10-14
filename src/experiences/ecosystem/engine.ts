import { makeRng } from "../../lib/rng";

/* ------------------------------------------------------------------ *
 * World geometry
 * ------------------------------------------------------------------ */
export const WORLD_W = 1200;
export const WORLD_H = 700;
export const CELL = 25;
export const COLS = WORLD_W / CELL; // 48
export const ROWS = WORLD_H / CELL; // 28
const NCELLS = COLS * ROWS;

const HASH = 60; // spatial hash cell size
const HCOLS = Math.ceil(WORLD_W / HASH);
const HROWS = Math.ceil(WORLD_H / HASH);

/* ------------------------------------------------------------------ *
 * Species
 * ------------------------------------------------------------------ */
export type AnimalKind = "rabbit" | "deer" | "fox" | "wolf" | "crow";
export type PlantKind = "shrub" | "tree";
export type Role = "herbivore" | "predator" | "scavenger";

interface AnimalCfg {
  label: string;
  role: Role;
  color: string;
  maxEnergy: number;
  metabolism: number; // energy / second at rest
  speed: number; // px / second, cruising
  burst: number; // px / second, fleeing or chasing
  vision: number; // px
  reach: number; // px, catch / eat distance
  mature: number; // seconds
  maxAge: number; // seconds (varies +-20% per animal)
  repEnergy: number; // energy needed to reproduce
  repCost: number; // energy parent pays
  childEnergy: number;
  repCooldown: number; // seconds
  bite: number; // grass biomass / second
  gain: number; // energy per unit of grass biomass
  stamina: number; // seconds a predator can chase
  /** Same-species neighbours within `room` px suppress breeding. 0 = no territory. */
  room: number;
  crowd: number;
  startCount: number;
  /** Below this many individuals, migrants may arrive from off-map. */
  refugeCount: number;
}

export const ANIMALS: Record<AnimalKind, AnimalCfg> = {
  rabbit: {
    label: "Rabbits", role: "herbivore", color: "#e8dcc4",
    maxEnergy: 100, metabolism: 1.5, speed: 34, burst: 74, vision: 85, reach: 6,
    mature: 22, maxAge: 260, repEnergy: 68, repCost: 30, childEnergy: 26, repCooldown: 32,
    bite: 0.045, gain: 60, stamina: 0, room: 55, crowd: 7, startCount: 34, refugeCount: 4,
  },
  deer: {
    label: "Deer", role: "herbivore", color: "#b98a5a",
    maxEnergy: 190, metabolism: 2.1, speed: 30, burst: 78, vision: 130, reach: 7,
    mature: 40, maxAge: 520, repEnergy: 140, repCost: 70, childEnergy: 64, repCooldown: 48,
    bite: 0.075, gain: 70, stamina: 0, room: 90, crowd: 4, startCount: 10, refugeCount: 3,
  },
  fox: {
    label: "Foxes", role: "predator", color: "#e8834a",
    maxEnergy: 150, metabolism: 1.25, speed: 36, burst: 96, vision: 90, reach: 9,
    mature: 30, maxAge: 380, repEnergy: 112, repCost: 54, childEnergy: 52, repCooldown: 45,
    bite: 0, gain: 0, stamina: 4.5, room: 200, crowd: 2, startCount: 4, refugeCount: 2,
  },
  wolf: {
    label: "Wolves", role: "predator", color: "#8ea0c4",
    maxEnergy: 280, metabolism: 1.8, speed: 38, burst: 96, vision: 130, reach: 11,
    mature: 60, maxAge: 620, repEnergy: 210, repCost: 105, childEnergy: 95, repCooldown: 90,
    bite: 0, gain: 0, stamina: 8, room: 300, crowd: 2, startCount: 3, refugeCount: 2,
  },
  crow: {
    label: "Crows", role: "scavenger", color: "#2b2f3d",
    maxEnergy: 90, metabolism: 0.9, speed: 48, burst: 70, vision: 150, reach: 7,
    mature: 20, maxAge: 320, repEnergy: 70, repCost: 30, childEnergy: 28, repCooldown: 40,
    bite: 0, gain: 0, stamina: 0, room: 130, crowd: 3, startCount: 5, refugeCount: 2,
  },
};

export const ANIMAL_KINDS = Object.keys(ANIMALS) as AnimalKind[];

/** Grazers cannot eat grass below this level. */
const GRASS_ROOTS = 0.12;

/** Prey only react to a predator inside this fraction of their vision. */
const ALERT = 0.55;

/** Energy a predator gets from a kill, and how likely the kill is. */
export const PREY: Record<"fox" | "wolf", Partial<Record<"rabbit" | "deer", { energy: number; catchChance: number }>>> = {
  fox: { rabbit: { energy: 62, catchChance: 0.42 } },
  wolf: { rabbit: { energy: 48, catchChance: 0.5 }, deer: { energy: 150, catchChance: 0.3 } },
};

/* ------------------------------------------------------------------ *
 * Settings (all live-editable)
 * ------------------------------------------------------------------ */
export interface Settings {
  // environment
  sunlight: number; // 0-100
  rainfall: number; // 0-100
  temperature: number; // 0-100 -> about -5..30 C baseline
  fertility: number; // 0-100
  wildfires: number; // 0-100 lightning frequency
  seasons: boolean;
  seasonLength: number; // seconds per year
  // plants
  grassRegrowth: number; // multiplier
  shrubSpread: number; // multiplier
  treeShade: number; // 0-100
  // animals
  metabolism: number; // multiplier
  herbivoreFertility: number; // multiplier (shorter cooldowns)
  predatorFertility: number; // multiplier
  predatorSkill: number; // multiplier on catch chance
  predatorAppetite: number; // 0-100: how hungry a predator must be to hunt
  territory: number; // multiplier on how much room predators and crows demand
  cover: number; // 0-100: how well plants hide prey
  mutation: number; // 0-100
  migration: number; // 0-100
  // limits
  maxCreatures: number;
  maxPlants: number;
  // time
  speed: number; // sim seconds per real second
}

export const DEFAULT_SETTINGS: Settings = {
  sunlight: 70, rainfall: 55, temperature: 55, fertility: 55, wildfires: 8,
  seasons: true, seasonLength: 150,
  grassRegrowth: 1, shrubSpread: 1, treeShade: 50,
  metabolism: 1, herbivoreFertility: 1, predatorFertility: 1, predatorSkill: 1,
  predatorAppetite: 65, territory: 1, cover: 55, mutation: 25, migration: 30,
  maxCreatures: 850, maxPlants: 1200,
  speed: 1,
};

/* ------------------------------------------------------------------ *
 * Entities
 * ------------------------------------------------------------------ */
export interface Animal {
  id: number;
  kind: AnimalKind;
  x: number; y: number; vx: number; vy: number;
  energy: number;
  age: number;
  maxAge: number;
  cooldown: number;
  gene: number; // speed trait multiplier
  alive: boolean;
  panic: number; // seconds of fleeing left
  chase: number; // seconds spent chasing
  rest: number; // seconds of recovery
  replan: number;
  tx: number; ty: number; hasTarget: boolean;
  prey: Animal | null;
  carrion: Carcass | null;
  food: Plant | null;
  wander: number; // heading
  facing: number;
  seedIn: number; // crows: seconds until a swallowed seed drops
  gen: number;
}

export interface Plant {
  id: number;
  kind: PlantKind;
  x: number; y: number;
  size: number; // 0..1
  berries: number; // 0..1
  age: number;
  maxAge: number;
  alive: boolean;
}

export interface Carcass {
  x: number; y: number;
  energy: number;
  age: number;
}

export interface Pond { x: number; y: number; r: number }
export interface Warren { x: number; y: number }

export type Tool =
  | "rabbit" | "deer" | "fox" | "wolf" | "crow"
  | "shrub" | "tree" | "grass"
  | "rain" | "fire" | "blight" | "plague" | "pond";

export type DeathCause = "eaten" | "starved" | "old age" | "burned" | "plague" | "drowned";

export interface LogEntry { time: number; text: string }

export interface World {
  seed: number;
  rand: () => number;
  settings: Settings;
  time: number;
  animals: Animal[];
  plants: Plant[];
  carcasses: Carcass[];
  ponds: Pond[];
  warrens: Warren[];
  grass: Float32Array;
  moisture: Float32Array;
  fertility: Float32Array;
  burn: Float32Array;
  shade: Float32Array;
  water: Uint8Array; // 1 where a pond covers the cell
  raining: number; // seconds of rain left
  rainCheck: number;
  nextId: number;
  animalHash: Animal[][];
  plantHash: Plant[][];
  shadeTimer: number;
  extinct: Record<AnimalKind, boolean>;
  everSeen: Record<AnimalKind, number>;
  peaks: Record<AnimalKind, number>;
  deaths: Record<DeathCause, number>;
  log: LogEntry[];
  lastYear: number;
  lastSeason: number;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;
const cellIndex = (x: number, y: number) => clamp(Math.floor(y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1);
const hashIndex = (x: number, y: number) => clamp(Math.floor(y / HASH), 0, HROWS - 1) * HCOLS + clamp(Math.floor(x / HASH), 0, HCOLS - 1);

export const SEASON_NAMES = ["Winter", "Spring", "Summer", "Autumn"];

/** Position within the year, 0..1. Winter sits at 0. */
export function yearFraction(w: World): number {
  if (!w.settings.seasons) return 0.45;
  return (0.2 + w.time / w.settings.seasonLength) % 1;
}

export function seasonOf(y: number): number {
  return Math.floor(((y + 0.125) % 1) * 4); // 0 winter, 1 spring, 2 summer, 3 autumn
}

export interface Climate {
  wave: number; // -1 deep winter .. +1 high summer
  temp: number; // degrees C
  sun: number; // 0..1
  tempGrowth: number; // 0..1
  berrySeason: number; // 0..1.2
}

export function climate(w: World): Climate {
  const s = w.settings;
  const y = yearFraction(w);
  const wave = s.seasons ? -Math.cos(2 * Math.PI * y) : 0.3;
  const base = -5 + (s.temperature / 100) * 35;
  const temp = base + (s.seasons ? 9 : 0) * wave;
  const sun = (s.sunlight / 100) * (0.72 + 0.28 * wave);
  const tempGrowth = clamp((temp - 1) / 12, 0, 1) * clamp(1 - (temp - 27) / 10, 0, 1);
  const berrySeason = clamp(0.45 + 0.55 * Math.sin(2 * Math.PI * (y - 0.32)), 0.1, 1.1);
  return { wave, temp, sun, tempGrowth, berrySeason };
}

function inWater(w: World, x: number, y: number): boolean {
  for (const p of w.ponds) if (dist2(x, y, p.x, p.y) < p.r * p.r) return true;
  return false;
}

function rebuildWaterMask(w: World) {
  w.water.fill(0);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (inWater(w, (c + 0.5) * CELL, (r + 0.5) * CELL)) w.water[r * COLS + c] = 1;
    }
  }
}

function pushLog(w: World, text: string) {
  w.log.unshift({ time: w.time, text });
  if (w.log.length > 40) w.log.length = 40;
}

/* ------------------------------------------------------------------ *
 * Creation
 * ------------------------------------------------------------------ */
export function createWorld(seed: number, settings: Settings = { ...DEFAULT_SETTINGS }): World {
  const rand = makeRng(seed);
  const w: World = {
    seed, rand, settings, time: 0,
    animals: [], plants: [], carcasses: [], ponds: [], warrens: [],
    grass: new Float32Array(NCELLS), moisture: new Float32Array(NCELLS),
    fertility: new Float32Array(NCELLS), burn: new Float32Array(NCELLS),
    shade: new Float32Array(NCELLS), water: new Uint8Array(NCELLS),
    raining: 0, rainCheck: 4, nextId: 1,
    animalHash: Array.from({ length: HCOLS * HROWS }, () => []),
    plantHash: Array.from({ length: HCOLS * HROWS }, () => []),
    shadeTimer: 0,
    extinct: { rabbit: false, deer: false, fox: false, wolf: false, crow: false },
    everSeen: { rabbit: 0, deer: 0, fox: 0, wolf: 0, crow: 0 },
    peaks: { rabbit: 0, deer: 0, fox: 0, wolf: 0, crow: 0 },
    deaths: { eaten: 0, starved: 0, "old age": 0, burned: 0, plague: 0, drowned: 0 },
    log: [], lastYear: 0, lastSeason: -1,
  };

  // Two or three ponds, kept away from the edges.
  const pondCount = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < pondCount; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const p = { x: 140 + rand() * (WORLD_W - 280), y: 110 + rand() * (WORLD_H - 220), r: 38 + rand() * 30 };
      if (w.ponds.every((o) => Math.hypot(o.x - p.x, o.y - p.y) > o.r + p.r + 180)) {
        w.ponds.push(p);
        break;
      }
    }
  }
  rebuildWaterMask(w);

  // Rabbit warrens: safe ground that predators cannot easily take prey from.
  for (let i = 0; i < 5; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const wr = { x: 90 + rand() * (WORLD_W - 180), y: 70 + rand() * (WORLD_H - 140) };
      if (!inWater(w, wr.x, wr.y) && w.warrens.every((o) => Math.hypot(o.x - wr.x, o.y - wr.y) > 170)) {
        w.warrens.push(wr);
        break;
      }
    }
  }

  const baseFert = 0.15 + (settings.fertility / 100) * 0.7;
  for (let i = 0; i < NCELLS; i++) {
    w.fertility[i] = clamp(baseFert + (rand() - 0.5) * 0.25, 0.05, 1);
    w.moisture[i] = 0.5;
    w.grass[i] = w.water[i] ? 0 : 0.35 + rand() * 0.5;
  }

  for (let i = 0; i < 26; i++) addPlant(w, "shrub", rand() * WORLD_W, rand() * WORLD_H, 0.5 + rand() * 0.5);
  for (let i = 0; i < 16; i++) addPlant(w, "tree", rand() * WORLD_W, rand() * WORLD_H, 0.5 + rand() * 0.5);
  for (const kind of ANIMAL_KINDS) {
    for (let i = 0; i < ANIMALS[kind].startCount; i++) {
      addAnimal(w, kind, rand() * WORLD_W, rand() * WORLD_H, 0.7 + rand() * 0.3, 1, true);
    }
  }
  computeShade(w);
  pushLog(w, "A quiet valley. Two ponds, a little grass, a few animals.");
  return w;
}

function addAnimal(w: World, kind: AnimalKind, x: number, y: number, energyFrac: number, gene: number, adult = false): Animal | null {
  const cfg = ANIMALS[kind];
  for (let tries = 0; tries < 8 && inWater(w, x, y); tries++) {
    x = w.rand() * WORLD_W;
    y = w.rand() * WORLD_H;
  }
  const a: Animal = {
    id: w.nextId++, kind, x: clamp(x, 2, WORLD_W - 2), y: clamp(y, 2, WORLD_H - 2), vx: 0, vy: 0,
    energy: cfg.maxEnergy * energyFrac, age: adult ? cfg.mature + w.rand() * cfg.mature : 0,
    maxAge: cfg.maxAge * (0.8 + w.rand() * 0.4), cooldown: w.rand() * cfg.repCooldown,
    gene, alive: true, panic: 0, chase: 0, rest: 0, replan: w.rand(), tx: 0, ty: 0, hasTarget: false,
    prey: null, carrion: null, food: null, wander: w.rand() * Math.PI * 2, facing: 0, seedIn: 0, gen: 0,
  };
  w.animals.push(a);
  w.everSeen[kind]++;
  if (w.extinct[kind]) w.extinct[kind] = false;
  return a;
}

function addPlant(w: World, kind: PlantKind, x: number, y: number, size: number): Plant | null {
  if (w.plants.length >= w.settings.maxPlants) return null;
  if (inWater(w, x, y)) return null;
  const p: Plant = {
    id: w.nextId++, kind, x: clamp(x, 4, WORLD_W - 4), y: clamp(y, 4, WORLD_H - 4), size,
    berries: kind === "shrub" ? w.rand() * 0.5 : w.rand() * 0.3,
    age: size * (kind === "tree" ? 240 : 90),
    maxAge: (kind === "tree" ? 1500 : 480) * (0.7 + w.rand() * 0.6), alive: true,
  };
  w.plants.push(p);
  return p;
}

function computeShade(w: World) {
  w.shade.fill(0);
  for (const p of w.plants) {
    if (p.kind !== "tree" || p.size < 0.25) continue;
    const r = 16 + 30 * p.size;
    const c0 = Math.max(0, Math.floor((p.x - r) / CELL));
    const c1 = Math.min(COLS - 1, Math.floor((p.x + r) / CELL));
    const r0 = Math.max(0, Math.floor((p.y - r) / CELL));
    const r1 = Math.min(ROWS - 1, Math.floor((p.y + r) / CELL));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const d = Math.hypot((col + 0.5) * CELL - p.x, (row + 0.5) * CELL - p.y);
        if (d < r) w.shade[row * COLS + col] = Math.min(1, w.shade[row * COLS + col] + 0.5 * (1 - d / r) + 0.25);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Counting
 * ------------------------------------------------------------------ */
export interface Stats {
  counts: Record<AnimalKind, number>;
  peaks: Record<AnimalKind, number>;
  extinct: Record<AnimalKind, boolean>;
  shrubs: number;
  trees: number;
  grassCover: number; // 0..1 average biomass over dry land
  moisture: number;
  fertility: number;
  meanGene: Record<AnimalKind, number>;
  temp: number;
  raining: boolean;
  year: number;
  season: number;
  burning: number;
  carcasses: number;
}

export function stats(w: World): Stats {
  const counts: Record<AnimalKind, number> = { rabbit: 0, deer: 0, fox: 0, wolf: 0, crow: 0 };
  const geneSum: Record<AnimalKind, number> = { rabbit: 0, deer: 0, fox: 0, wolf: 0, crow: 0 };
  for (const a of w.animals) {
    counts[a.kind]++;
    geneSum[a.kind] += a.gene;
  }
  const meanGene = { rabbit: 1, deer: 1, fox: 1, wolf: 1, crow: 1 } as Record<AnimalKind, number>;
  for (const k of ANIMAL_KINDS) if (counts[k] > 0) meanGene[k] = geneSum[k] / counts[k];
  let shrubs = 0;
  let trees = 0;
  for (const p of w.plants) if (p.kind === "shrub") shrubs++; else trees++;
  let g = 0, m = 0, f = 0, land = 0, burning = 0;
  for (let i = 0; i < NCELLS; i++) {
    if (w.burn[i] > 0.05) burning++;
    if (w.water[i]) continue;
    land++;
    g += w.grass[i];
    m += w.moisture[i];
    f += w.fertility[i];
  }
  const y = yearFraction(w);
  return {
    counts, peaks: { ...w.peaks }, extinct: { ...w.extinct }, shrubs, trees, meanGene,
    grassCover: land ? g / land : 0, moisture: land ? m / land : 0, fertility: land ? f / land : 0,
    temp: climate(w).temp, raining: w.raining > 0,
    year: Math.floor((0.2 + w.time / w.settings.seasonLength)) + 1,
    season: seasonOf(y), burning, carcasses: w.carcasses.length,
  };
}

/* ------------------------------------------------------------------ *
 * Spatial queries
 * ------------------------------------------------------------------ */
function forAnimalsNear(w: World, x: number, y: number, r: number, fn: (a: Animal) => void) {
  const c0 = clamp(Math.floor((x - r) / HASH), 0, HCOLS - 1);
  const c1 = clamp(Math.floor((x + r) / HASH), 0, HCOLS - 1);
  const r0 = clamp(Math.floor((y - r) / HASH), 0, HROWS - 1);
  const r1 = clamp(Math.floor((y + r) / HASH), 0, HROWS - 1);
  const r2 = r * r;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      for (const a of w.animalHash[row * HCOLS + col]) {
        if (a.alive && dist2(a.x, a.y, x, y) <= r2) fn(a);
      }
    }
  }
}

function forPlantsNear(w: World, x: number, y: number, r: number, fn: (p: Plant) => void) {
  const c0 = clamp(Math.floor((x - r) / HASH), 0, HCOLS - 1);
  const c1 = clamp(Math.floor((x + r) / HASH), 0, HCOLS - 1);
  const r0 = clamp(Math.floor((y - r) / HASH), 0, HROWS - 1);
  const r1 = clamp(Math.floor((y + r) / HASH), 0, HROWS - 1);
  const r2 = r * r;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      for (const p of w.plantHash[row * HCOLS + col]) {
        if (p.alive && dist2(p.x, p.y, x, y) <= r2) fn(p);
      }
    }
  }
}

function rebuildHashes(w: World) {
  for (const b of w.animalHash) b.length = 0;
  for (const b of w.plantHash) b.length = 0;
  for (const a of w.animals) if (a.alive) w.animalHash[hashIndex(a.x, a.y)].push(a);
  for (const p of w.plants) if (p.alive) w.plantHash[hashIndex(p.x, p.y)].push(p);
}

/** True when the animal is standing in cover a predator would have to get close to see into. */
function hidden(w: World, a: Animal): boolean {
  if (w.settings.cover <= 0) return false;
  if (a.kind === "rabbit") for (const wr of w.warrens) if (dist2(a.x, a.y, wr.x, wr.y) < 26 * 26) return true;
  let covered = false;
  const reach = 10 + (w.settings.cover / 100) * 10;
  forPlantsNear(w, a.x, a.y, reach + 12, (p) => {
    if (covered) return;
    const cr = p.kind === "tree" ? 8 + 26 * p.size : 6 + 12 * p.size;
    if (p.size > 0.35 && dist2(a.x, a.y, p.x, p.y) < cr * cr * (reach / 14)) covered = true;
  });
  return covered;
}

/* ------------------------------------------------------------------ *
 * Killing and eating
 * ------------------------------------------------------------------ */
function kill(w: World, a: Animal, cause: DeathCause, leavesBody = true) {
  if (!a.alive) return;
  a.alive = false;
  w.deaths[cause]++;
  if (leavesBody && cause !== "burned" && cause !== "drowned") {
    const cfg = ANIMALS[a.kind];
    const value = cfg.maxEnergy * (cause === "eaten" ? 0.18 : 0.42) * (a.age < cfg.mature ? 0.6 : 1);
    w.carcasses.push({ x: a.x, y: a.y, energy: value, age: 0 });
  }
}

/* ------------------------------------------------------------------ *
 * Environment step
 * ------------------------------------------------------------------ */
function stepEnvironment(w: World, dt: number, cl: Climate) {
  const s = w.settings;

  // Weather
  w.rainCheck -= dt;
  if (w.raining > 0) w.raining -= dt;
  if (w.rainCheck <= 0) {
    w.rainCheck = 4 + w.rand() * 4;
    const winterFactor = s.seasons ? 0.75 + 0.35 * (1 - (cl.wave + 1) / 2) : 1;
    if (w.raining <= 0 && w.rand() < (s.rainfall / 100) * 0.3 * winterFactor) {
      w.raining = 9 + w.rand() * 14;
    }
  }
  const rainAdd = w.raining > 0 ? 0.085 * dt : 0;
  const groundwater = 0.05 + (s.rainfall / 100) * 0.3;
  const evaporation = (0.004 + 0.012 * cl.sun * clamp(cl.temp / 30, 0, 1.2)) * dt;

  const g = w.grass, m = w.moisture, f = w.fertility, b = w.burn, sh = w.shade;
  const baseFert = 0.15 + (s.fertility / 100) * 0.7;
  const regrow = 0.022 * s.grassRegrowth;
  const shadeK = s.treeShade / 100;

  // Moisture diffuses (cheap 4-neighbour), rain and ponds add, sun and heat remove.
  const nextM = new Float32Array(NCELLS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      let sum = 0, n = 0;
      if (c > 0) { sum += m[i - 1]; n++; }
      if (c < COLS - 1) { sum += m[i + 1]; n++; }
      if (r > 0) { sum += m[i - COLS]; n++; }
      if (r < ROWS - 1) { sum += m[i + COLS]; n++; }
      let v = m[i] + (sum / n - m[i]) * 0.5 * dt + rainAdd - evaporation * (m[i] > groundwater * 0.5 ? 1 : 0.25);
      if (w.water[i]) v = 1;
      else v += (groundwater - v) * 0.004 * dt;
      nextM[i] = clamp(v, 0, 1);
    }
  }
  m.set(nextM);

  // Fire
  if (s.wildfires > 0 && cl.temp > 8 && w.raining <= 0 && w.rand() < (s.wildfires / 100) * 0.0035 * dt * 10) {
    const i = Math.floor(w.rand() * NCELLS);
    if (!w.water[i] && g[i] > 0.4 && m[i] < 0.45) {
      b[i] = 1;
      pushLog(w, "Lightning struck the dry grass. A fire has started.");
    }
  }
  const spreadFrom: number[] = [];
  for (let i = 0; i < NCELLS; i++) {
    if (b[i] <= 0) continue;
    b[i] -= dt * (0.16 + (w.raining > 0 ? 0.5 : 0) + m[i] * 0.3);
    if (b[i] > 0.4) spreadFrom.push(i);
    g[i] = Math.max(0, g[i] - dt * 0.9);
    f[i] = Math.min(1, f[i] + dt * 0.025);
    if (b[i] < 0) b[i] = 0;
  }
  for (const i of spreadFrom) {
    const c = i % COLS, r = Math.floor(i / COLS);
    const nbrs = [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, r > 0 ? i - COLS : -1, r < ROWS - 1 ? i + COLS : -1];
    for (const j of nbrs) {
      if (j < 0 || b[j] > 0 || w.water[j]) continue;
      const fuel = g[j] * 0.8 + 0.1;
      const dry = clamp(1.1 - m[j] * 1.5, 0, 1);
      if (w.rand() < 0.9 * fuel * dry * dt) b[j] = 0.9;
    }
  }

  // Grass, soil
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (w.water[i]) continue;
      // fertility relaxes toward its baseline
      f[i] += (baseFert - f[i]) * 0.0015 * dt;
      if (b[i] > 0) continue;
      const wet = clamp(m[i] * 1.7, 0, 1);
      const cond = cl.tempGrowth * (0.35 + cl.sun * 0.9) * wet * (0.3 + f[i] * 0.8) * (1 - sh[i] * shadeK * 0.75);
      let nb = 0, nn = 0;
      if (c > 0) { nb += g[i - 1]; nn++; }
      if (c < COLS - 1) { nb += g[i + 1]; nn++; }
      if (r > 0) { nb += g[i - COLS]; nn++; }
      if (r < ROWS - 1) { nb += g[i + COLS]; nn++; }
      const seeds = 0.025 + (nb / nn) * 0.12;
      let v = g[i] + regrow * cond * (g[i] * 0.9 + seeds) * (1 - g[i]) * dt * 3.2;
      // Drought and hard winters thin the grass rather than freeze it in place.
      if (m[i] < 0.09) v -= 0.012 * dt;
      if (cl.temp < 0) v -= 0.004 * dt * (1 - g[i] * 0.5);
      g[i] = clamp(v, 0, 1);
    }
  }

  // Trees change shade slowly
  w.shadeTimer -= dt;
  if (w.shadeTimer <= 0) {
    w.shadeTimer = 3;
    computeShade(w);
  }
}

/* ------------------------------------------------------------------ *
 * Plants
 * ------------------------------------------------------------------ */
function stepPlants(w: World, dt: number, cl: Climate) {
  const s = w.settings;
  for (const p of w.plants.slice()) {
    if (!p.alive) continue;
    p.age += dt;
    const i = cellIndex(p.x, p.y);
    const moist = w.moisture[i];
    const cond = cl.tempGrowth * (0.3 + cl.sun) * clamp(moist * 1.8, 0, 1) * (0.4 + w.fertility[i] * 0.7);

    if (w.burn[i] > 0.15) {
      const survive = p.kind === "tree" ? 0.35 * p.size + 0.05 : 0;
      if (w.rand() < 0.6 * dt * 5) {
        if (w.rand() > survive) p.alive = false;
        else p.size *= 0.6;
      }
      continue;
    }
    if (p.age > p.maxAge || (moist < 0.04 && w.rand() < 0.02 * dt)) {
      p.alive = false;
      continue;
    }

    const full = p.kind === "tree" ? 250 : 80;
    p.size = Math.min(1, p.size + (cond / full) * dt);
    if (p.size > 0.55) {
      const rate = p.kind === "shrub" ? 0.03 : 0.012;
      p.berries = Math.min(1, p.berries + rate * cond * cl.berrySeason * dt * 3);
    }
    if (cl.temp < 0) p.berries = Math.max(0, p.berries - 0.004 * dt);

    // Seeds
    if (p.size > 0.8 && cond > 0.12 && w.plants.length < s.maxPlants) {
      const chance = (p.kind === "shrub" ? 0.012 : 0.004) * s.shrubSpread * cond * dt;
      if (w.rand() < chance) {
        const ang = w.rand() * Math.PI * 2;
        const d = 30 + w.rand() * (p.kind === "tree" ? 130 : 90);
        const nx = p.x + Math.cos(ang) * d;
        const ny = p.y + Math.sin(ang) * d;
        if (nx > 6 && nx < WORLD_W - 6 && ny > 6 && ny < WORLD_H - 6) {
          let crowd = 0;
          forPlantsNear(w, nx, ny, 55, (o) => { if (o.kind === p.kind) crowd++; });
          if (crowd < (p.kind === "tree" ? 2 : 4)) addPlant(w, p.kind, nx, ny, 0.05);
        }
      }
    }
  }
  w.plants = w.plants.filter((p) => p.alive);
}

/* ------------------------------------------------------------------ *
 * Animals
 * ------------------------------------------------------------------ */
function moveAnimal(w: World, a: Animal, desiredVx: number, desiredVy: number, dt: number) {
  const k = Math.min(1, dt * 4);
  a.vx += (desiredVx - a.vx) * k;
  a.vy += (desiredVy - a.vy) * k;
  const nx = a.x + a.vx * dt;
  const ny = a.y + a.vy * dt;
  const flying = a.kind === "crow";
  if (!flying && inWater(w, nx, ny)) {
    // slide around the pond instead of walking into it
    a.vx = -a.vx * 0.5 + (w.rand() - 0.5) * 20;
    a.vy = -a.vy * 0.5 + (w.rand() - 0.5) * 20;
    a.wander += Math.PI * (0.5 + w.rand());
  } else {
    a.x = nx;
    a.y = ny;
  }
  if (a.x < 3) { a.x = 3; a.vx = Math.abs(a.vx); a.wander = w.rand() * 1.5 - 0.75; }
  if (a.x > WORLD_W - 3) { a.x = WORLD_W - 3; a.vx = -Math.abs(a.vx); a.wander = Math.PI + w.rand() * 1.5 - 0.75; }
  if (a.y < 3) { a.y = 3; a.vy = Math.abs(a.vy); a.wander = Math.PI / 2 + w.rand() * 1.5 - 0.75; }
  if (a.y > WORLD_H - 3) { a.y = WORLD_H - 3; a.vy = -Math.abs(a.vy); a.wander = -Math.PI / 2 + w.rand() * 1.5 - 0.75; }
  if (Math.abs(a.vx) + Math.abs(a.vy) > 2) a.facing = Math.atan2(a.vy, a.vx);
}

function wanderStep(w: World, a: Animal, speed: number, dt: number) {
  a.wander += (w.rand() - 0.5) * 2.4 * dt;
  const cell = cellIndex(a.x, a.y);
  // avoid fire
  if (w.burn[cell] > 0.05) a.wander += Math.PI * 0.8;
  moveAnimal(w, a, Math.cos(a.wander) * speed, Math.sin(a.wander) * speed, dt);
}

function steerTo(w: World, a: Animal, tx: number, ty: number, speed: number, dt: number) {
  const dx = tx - a.x, dy = ty - a.y;
  const d = Math.hypot(dx, dy) || 1;
  moveAnimal(w, a, (dx / d) * speed, (dy / d) * speed, dt);
}

function chooseGrazeTarget(w: World, a: Animal, cfg: AnimalCfg) {
  const rC = Math.ceil(cfg.vision / CELL);
  const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
  let best = 0.1, bx = 0, by = 0, found = false;
  for (let dy = -rC; dy <= rC; dy++) {
    for (let dx = -rC; dx <= rC; dx++) {
      const c = cx + dx, r = cy + dy;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      const i = r * COLS + c;
      if (w.water[i] || w.burn[i] > 0.02) continue;
      const d = Math.hypot(dx, dy) * CELL;
      if (d > cfg.vision) continue;
      const score = w.grass[i] / (1 + d / 70) + (w.rand() - 0.5) * 0.05;
      if (w.grass[i] > GRASS_ROOTS + 0.08 && score > best) {
        best = score; bx = (c + 0.5) * CELL; by = (r + 0.5) * CELL; found = true;
      }
    }
  }
  if (found) {
    a.tx = bx + (w.rand() - 0.5) * 10;
    a.ty = by + (w.rand() - 0.5) * 10;
    a.hasTarget = true;
  } else {
    a.hasTarget = false;
  }
}

function findFruit(w: World, a: Animal, cfg: AnimalCfg): Plant | null {
  let best: Plant | null = null;
  let bestScore = 0.25;
  forPlantsNear(w, a.x, a.y, cfg.vision, (p) => {
    if (p.berries < 0.3) return;
    const s = p.berries / (1 + Math.sqrt(dist2(a.x, a.y, p.x, p.y)) / 60);
    if (s > bestScore) { bestScore = s; best = p; }
  });
  return best;
}

function stepAnimal(w: World, a: Animal, dt: number, cl: Climate, offspring: Animal[]) {
  const s = w.settings;
  const cfg = ANIMALS[a.kind];
  const cellI = cellIndex(a.x, a.y);

  a.age += dt;
  a.cooldown -= dt;
  a.panic = Math.max(0, a.panic - dt);
  a.rest = Math.max(0, a.rest - dt);
  a.replan -= dt;
  if (a.seedIn > 0) {
    a.seedIn -= dt;
    if (a.seedIn <= 0 && w.rand() < 0.8) addPlant(w, w.rand() < 0.75 ? "shrub" : "tree", a.x, a.y, 0.05);
  }

  // Upkeep: faster animals pay for it; cold weather costs more.
  const cold = a.kind === "crow" ? 1 : 1 + clamp((6 - cl.temp) / 30, 0, 0.6);
  a.energy -= cfg.metabolism * s.metabolism * cold * Math.pow(a.gene, 1.6) * dt;

  if (w.burn[cellI] > 0.2) {
    a.energy -= 18 * dt;
    if (a.energy <= 0) { kill(w, a, "burned"); return; }
  }
  if (fleeFire(w, a, cfg, dt)) return;
  if (a.energy <= 0) { kill(w, a, "starved"); return; }
  if (a.age > a.maxAge) { kill(w, a, "old age"); return; }

  const adult = a.age >= cfg.mature;
  const gene = a.gene;

  if (cfg.role === "herbivore") stepHerbivore(w, a, cfg, dt, gene, cellI);
  else if (cfg.role === "predator") stepPredator(w, a, cfg, dt, gene, s);
  else stepScavenger(w, a, cfg, dt, gene);

  // Reproduction: needs to be adult, well-fed, rested, and the world must have room.
  const fertilityMult = cfg.role === "herbivore" ? s.herbivoreFertility : cfg.role === "predator" ? s.predatorFertility : 1;
  if (adult && a.cooldown <= 0 && a.energy > cfg.repEnergy && w.animals.length + offspring.length < s.maxCreatures) {
    if (cfg.room > 0 && !hasRoom(w, a, cfg)) {
      // Crowded: wait a while before trying again rather than breeding the moment a gap opens.
      a.cooldown = (cfg.role === "herbivore" ? 3 : 6) + w.rand() * (cfg.role === "herbivore" ? 4 : 8);
      return;
    }
    a.energy -= cfg.repCost;
    a.cooldown = cfg.repCooldown / Math.max(0.1, fertilityMult) * (0.85 + w.rand() * 0.3);
    const mut = (s.mutation / 100) * 0.16;
    const childGene = clamp(a.gene * (1 + (w.rand() - 0.5) * 2 * mut), 0.6, 1.6);
    const child = addAnimal(w, a.kind, a.x + (w.rand() - 0.5) * 8, a.y + (w.rand() - 0.5) * 8, cfg.childEnergy / cfg.maxEnergy, childGene);
    if (child) { child.gen = a.gen + 1; offspring.push(child); }
  }
}

/** Animals run from flames: steer away from any burning cell close by. */
function fleeFire(w: World, a: Animal, cfg: AnimalCfg, dt: number): boolean {
  const c = Math.floor(a.x / CELL), r = Math.floor(a.y / CELL);
  let fx = 0, fy = 0, hot = false;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
      if (w.burn[rr * COLS + cc] > 0.1) {
        hot = true;
        fx -= dc;
        fy -= dr;
      }
    }
  }
  if (!hot) return false;
  const n = Math.hypot(fx, fy) || 1;
  moveAnimal(w, a, (fx / n) * cfg.burst, (fy / n) * cfg.burst, dt);
  return true;
}

function hasRoom(w: World, a: Animal, cfg: AnimalCfg): boolean {
  if (cfg.room <= 0 || w.settings.territory <= 0) return true;
  let n = 0;
  forAnimalsNear(w, a.x, a.y, cfg.room * w.settings.territory, (o) => { if (o.kind === a.kind && o !== a) n++; });
  return n < cfg.crowd;
}

function stepHerbivore(w: World, a: Animal, cfg: AnimalCfg, dt: number, gene: number, cellI: number) {
  const s = w.settings;
  // 1. Danger
  let threat: Animal | null = null;
  let threatD = Infinity;
  const senseR = cfg.vision * ALERT;
  forAnimalsNear(w, a.x, a.y, senseR, (o) => {
    if (ANIMALS[o.kind].role !== "predator") return;
    if (o.rest > 0 && o.kind === "fox") return;
    const d = dist2(a.x, a.y, o.x, o.y);
    if (d < threatD) { threatD = d; threat = o; }
  });
  if (threat) {
    const t = threat as Animal;
    a.panic = Math.max(a.panic, 1.4);
    const dx = a.x - t.x, dy = a.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    // run away, biased toward the nearest cover if there is any
    let cx = dx / d, cy = dy / d;
    let coverBest: Plant | null = null;
    let coverD = 90 * 90;
    forPlantsNear(w, a.x, a.y, 90, (p) => {
      if (p.size < 0.4) return;
      const dd = dist2(a.x, a.y, p.x, p.y);
      const away = (p.x - a.x) * cx + (p.y - a.y) * cy;
      if (dd < coverD && away > -20) { coverD = dd; coverBest = p; }
    });
    if (a.kind === "rabbit" && s.cover > 0 && w.warrens.length > 0) {
      let wb: Warren | null = null;
      let wd = 220 * 220;
      for (const wr of w.warrens) {
        const dd = dist2(a.x, a.y, wr.x, wr.y);
        if (dd < wd && (wr.x - a.x) * cx + (wr.y - a.y) * cy > -30) { wd = dd; wb = wr; }
      }
      if (wb) {
        const px = wb.x - a.x, py = wb.y - a.y, pd = Math.hypot(px, py) || 1;
        cx = cx * 0.45 + (px / pd) * 0.55;
        cy = cy * 0.45 + (py / pd) * 0.55;
        const n = Math.hypot(cx, cy) || 1;
        cx /= n; cy /= n;
      }
    } else if (coverBest && s.cover > 0) {
      const cb = coverBest as Plant;
      const px = cb.x - a.x, py = cb.y - a.y, pd = Math.hypot(px, py) || 1;
      cx = cx * 0.55 + (px / pd) * 0.45;
      cy = cy * 0.55 + (py / pd) * 0.45;
      const n = Math.hypot(cx, cy) || 1;
      cx /= n; cy /= n;
    }
    moveAnimal(w, a, cx * cfg.burst * gene, cy * cfg.burst * gene, dt);
    a.hasTarget = false;
    return;
  }

  // 2. Feeding
  const hungry = a.energy < cfg.maxEnergy * 0.88;
  if (a.panic > 0) {
    wanderStep(w, a, cfg.burst * 0.5 * gene, dt);
    return;
  }

  // eat the grass underfoot
  let eating = false;
  if (hungry && !w.water[cellI] && w.grass[cellI] > GRASS_ROOTS + 0.02) {
    // Grazers take the leaves; the roots stay, so a bitten meadow can recover.
    const bite = Math.min(w.grass[cellI] - GRASS_ROOTS, cfg.bite * dt);
    w.grass[cellI] -= bite;
    a.energy = Math.min(cfg.maxEnergy, a.energy + bite * cfg.gain);
    eating = bite > 0;
  }

  // fruit within reach
  if (a.food && (!a.food.alive || a.food.berries < 0.1 || dist2(a.x, a.y, a.food.x, a.food.y) > cfg.vision * cfg.vision)) a.food = null;
  if (a.food && dist2(a.x, a.y, a.food.x, a.food.y) < 14 * 14) {
    const take = Math.min(a.food.berries, dt * 0.25);
    a.food.berries -= take;
    a.energy = Math.min(cfg.maxEnergy, a.energy + take * 95);
    eating = true;
    // deer also strip the leaves
    if (a.kind === "deer" && a.food.kind === "shrub") a.food.size = Math.max(0.02, a.food.size - dt * 0.012);
  }

  if (hungry && a.replan <= 0) {
    a.replan = 0.7 + w.rand() * 0.8;
    a.food = w.grass[cellI] > 0.5 ? null : findFruit(w, a, cfg);
    if (!a.food) chooseGrazeTarget(w, a, cfg);
  }

  const cruise = cfg.speed * gene;
  if (hungry && a.food) {
    steerTo(w, a, a.food.x, a.food.y, cruise, dt);
  } else if (hungry && a.hasTarget && dist2(a.x, a.y, a.tx, a.ty) > 5 * 5) {
    steerTo(w, a, a.tx, a.ty, eating ? cruise * 0.3 : cruise, dt);
  } else if (eating) {
    moveAnimal(w, a, a.vx * 0.5, a.vy * 0.5, dt);
  } else {
    if (a.kind === "deer") {
      // deer drift toward the herd
      let hx = 0, hy = 0, n = 0;
      forAnimalsNear(w, a.x, a.y, 140, (o) => { if (o.kind === "deer" && o !== a) { hx += o.x; hy += o.y; n++; } });
      if (n > 0 && dist2(a.x, a.y, hx / n, hy / n) > 60 * 60) {
        steerTo(w, a, hx / n, hy / n, cruise * 0.5, dt);
        return;
      }
    }
    wanderStep(w, a, cruise * (hungry ? 0.7 : 0.35), dt);
  }
}

function stepPredator(w: World, a: Animal, cfg: AnimalCfg, dt: number, gene: number, s: Settings) {
  const kind = a.kind as "fox" | "wolf";
  const menu = PREY[kind];
  const hungryLine = cfg.maxEnergy * (0.3 + (s.predatorAppetite / 100) * 0.6);
  const hunting = a.energy < hungryLine;

  if (a.rest > 0) {
    wanderStep(w, a, cfg.speed * 0.3 * gene, dt);
    return;
  }

  // validate current prey
  if (a.prey && (!a.prey.alive || dist2(a.x, a.y, a.prey.x, a.prey.y) > cfg.vision * cfg.vision * 1.5)) {
    a.prey = null;
    a.chase = 0;
  }

  if (hunting && !a.prey && a.replan <= 0) {
    a.replan = 0.4 + w.rand() * 0.4;
    let best: Animal | null = null;
    let bestScore = 0;
    forAnimalsNear(w, a.x, a.y, cfg.vision, (o) => {
      const entry = o.kind === "rabbit" ? menu.rabbit : o.kind === "deer" ? menu.deer : undefined;
      if (!entry) return;
      const youngDeer = o.kind === "deer" && o.age < ANIMALS.deer.mature;
      // Wolves are after deer; they only bother with rabbits when starving.
      if (kind === "wolf" && o.kind === "rabbit" && a.energy > cfg.maxEnergy * 0.28) return;
      const d = Math.sqrt(dist2(a.x, a.y, o.x, o.y));
      if (hidden(w, o) && d > 30) return;
      const weak = 1 + (o.energy < ANIMALS[o.kind].maxEnergy * 0.35 ? 0.5 : 0) + (youngDeer ? 0.5 : 0);
      const score = (entry.energy * weak) / (30 + d);
      if (score > bestScore) { bestScore = score; best = o; }
    });
    a.prey = best;
    a.chase = 0;
    if (a.prey) a.carrion = null;
  }

  if (a.prey) {
    const prey = a.prey;
    a.chase += dt;
    const d = Math.sqrt(dist2(a.x, a.y, prey.x, prey.y));
    if (a.chase > cfg.stamina * gene) {
      // ran out of breath
      a.prey = null;
      a.chase = 0;
      a.rest = 4 + w.rand() * 4;
      a.replan = 1;
      return;
    }
    // Stalk quietly until the prey can sense us, then burst.
    const preyCfg = ANIMALS[prey.kind];
    const noticed = d < preyCfg.vision * ALERT * 1.15;
    if (!noticed) a.chase = Math.max(0, a.chase - dt * 0.9);
    steerTo(w, a, prey.x + prey.vx * 0.3, prey.y + prey.vy * 0.3, noticed ? cfg.burst * gene : cfg.speed * 1.15 * gene, dt);
    if (d < cfg.reach) {
      const entry = prey.kind === "rabbit" ? menu.rabbit! : menu.deer!;
      let p = entry.catchChance * s.predatorSkill;
      if (kind === "wolf") {
        let pack = 0;
        forAnimalsNear(w, a.x, a.y, 110, (o) => { if (o.kind === "wolf" && o !== a) pack++; });
        p += Math.min(3, pack) * 0.1;
      }
      // faster prey escape more often
      p *= 1.35 - 0.35 * prey.gene;
      if (prey.energy < ANIMALS[prey.kind].maxEnergy * 0.3) p += 0.15;
      if (hidden(w, prey)) p *= 1 - (s.cover / 100) * 0.75;
      if (w.rand() < clamp(p, 0.02, 0.95)) {
        a.energy = Math.min(cfg.maxEnergy, a.energy + entry.energy);
        kill(w, prey, "eaten");
        a.prey = null;
        a.chase = 0;
        a.rest = 2 + w.rand() * 2; // eating
      } else {
        prey.panic = 2.5;
        a.rest = 1.5 + w.rand();
        a.chase = Math.max(0, a.chase - 1);
      }
    }
    return;
  }

  // Carrion, when hungry and nothing is running
  if (hunting) {
    if (a.carrion && a.carrion.energy <= 0) a.carrion = null;
    if (!a.carrion && a.replan <= 0) {
      a.replan = 0.6 + w.rand() * 0.5;
      let bestD = (cfg.vision * 1.2) ** 2;
      for (const c of w.carcasses) {
        const d = dist2(a.x, a.y, c.x, c.y);
        if (d < bestD && c.energy > 4) { bestD = d; a.carrion = c; }
      }
    }
    if (a.carrion) {
      const c = a.carrion;
      steerTo(w, a, c.x, c.y, cfg.speed * gene, dt);
      if (dist2(a.x, a.y, c.x, c.y) < 12 * 12) {
        const take = Math.min(c.energy, 22 * dt);
        c.energy -= take;
        a.energy = Math.min(cfg.maxEnergy, a.energy + take * 0.9);
      }
      return;
    }
  }

  // Idle: wander, wolves stay loosely together
  if (kind === "wolf") {
    let hx = 0, hy = 0, n = 0;
    forAnimalsNear(w, a.x, a.y, 260, (o) => { if (o.kind === "wolf" && o !== a) { hx += o.x; hy += o.y; n++; } });
    if (n > 0 && dist2(a.x, a.y, hx / n, hy / n) > 130 * 130) {
      steerTo(w, a, hx / n, hy / n, cfg.speed * 0.6 * gene, dt);
      return;
    }
  }
  wanderStep(w, a, cfg.speed * (hunting ? 0.8 : 0.4) * gene, dt);
}

function stepScavenger(w: World, a: Animal, cfg: AnimalCfg, dt: number, gene: number) {
  const hungry = a.energy < cfg.maxEnergy * 0.85;

  if (a.carrion && (a.carrion.energy <= 0)) a.carrion = null;
  if (hungry && a.replan <= 0) {
    a.replan = 0.8 + w.rand() * 0.6;
    if (!a.carrion) {
      let bestD = (cfg.vision * 1.4) ** 2;
      for (const c of w.carcasses) {
        const d = dist2(a.x, a.y, c.x, c.y);
        if (d < bestD && c.energy > 3) { bestD = d; a.carrion = c; }
      }
    }
    if (!a.carrion && !a.food) a.food = findFruit(w, a, cfg);
  }
  if (a.food && (!a.food.alive || a.food.berries < 0.1)) a.food = null;

  if (a.carrion) {
    steerTo(w, a, a.carrion.x, a.carrion.y, cfg.speed * gene, dt);
    if (dist2(a.x, a.y, a.carrion.x, a.carrion.y) < 10 * 10) {
      const take = Math.min(a.carrion.energy, 14 * dt);
      a.carrion.energy -= take;
      a.energy = Math.min(cfg.maxEnergy, a.energy + take);
    }
    return;
  }
  if (a.food) {
    steerTo(w, a, a.food.x, a.food.y, cfg.speed * gene, dt);
    if (dist2(a.x, a.y, a.food.x, a.food.y) < 12 * 12) {
      const take = Math.min(a.food.berries, dt * 0.3);
      a.food.berries -= take;
      a.energy = Math.min(cfg.maxEnergy, a.energy + take * 80);
      if (a.seedIn <= 0 && w.rand() < dt * 0.6) a.seedIn = 3 + w.rand() * 6;
    }
    return;
  }
  // Nothing to eat: grubs in the grass
  if (hungry && w.grass[cellIndex(a.x, a.y)] > 0.4) a.energy = Math.min(cfg.maxEnergy, a.energy + 0.45 * dt);
  wanderStep(w, a, cfg.speed * 0.6 * gene, dt);
}

/* ------------------------------------------------------------------ *
 * Carcasses, migration
 * ------------------------------------------------------------------ */
function stepCarcasses(w: World, dt: number) {
  for (const c of w.carcasses) {
    c.age += dt;
    const rot = 1.4 * dt;
    c.energy -= rot;
    const i = cellIndex(c.x, c.y);
    w.fertility[i] = Math.min(1, w.fertility[i] + rot * 0.0016);
    if (c.age > 80) c.energy = 0;
  }
  w.carcasses = w.carcasses.filter((c) => c.energy > 0.5);
}

function stepMigration(w: World, dt: number, counts: Record<AnimalKind, number>) {
  const m = w.settings.migration / 100;
  if (m <= 0) return;
  for (const kind of ANIMAL_KINDS) {
    const cfg = ANIMALS[kind];
    if (counts[kind] >= cfg.refugeCount) continue;
    // The emptier the valley, the more likely something wanders in; a species that has
    // vanished entirely gets an extra push so it reliably comes back within a minute or two.
    const gone = counts[kind] === 0;
    const p = m * 0.012 * dt * (1 + (cfg.refugeCount - counts[kind]) * 0.5) * (gone ? 3 : 1);
    // Predators only arrive if there is something to eat.
    if (cfg.role === "predator" && counts.rabbit + counts.deer < 10) continue;
    if (cfg.role === "herbivore" && w.grass.reduce((s, v) => s + v, 0) < NCELLS * 0.025) continue;
    if (w.rand() < p) {
      const edge = w.rand() < 0.5;
      const x = edge ? (w.rand() < 0.5 ? 6 : WORLD_W - 6) : w.rand() * WORLD_W;
      const y = edge ? w.rand() * WORLD_H : (w.rand() < 0.5 ? 6 : WORLD_H - 6);
      const a = addAnimal(w, kind, x, y, 0.8, 1, true);
      if (a) pushLog(w, `A lone ${cfg.label.toLowerCase().replace(/s$/, "")} wandered in from beyond the valley.`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Main step
 * ------------------------------------------------------------------ */
export function step(w: World, dt: number) {
  w.time += dt;
  const cl = climate(w);

  stepEnvironment(w, dt, cl);
  rebuildHashes(w);
  stepPlants(w, dt, cl);
  rebuildHashes(w);

  const offspring: Animal[] = [];
  const snapshot = w.animals.slice();
  for (const a of snapshot) {
    if (a.alive) stepAnimal(w, a, dt, cl, offspring);
  }
  w.animals = w.animals.filter((a) => a.alive);
  stepCarcasses(w, dt);

  const counts: Record<AnimalKind, number> = { rabbit: 0, deer: 0, fox: 0, wolf: 0, crow: 0 };
  for (const a of w.animals) counts[a.kind]++;
  for (const k of ANIMAL_KINDS) {
    if (counts[k] > w.peaks[k]) w.peaks[k] = counts[k];
    if (counts[k] === 0 && !w.extinct[k] && w.everSeen[k] > 0) {
      w.extinct[k] = true;
      pushLog(w, `The last ${ANIMALS[k].label.toLowerCase().replace(/s$/, "")} is gone.`);
    }
  }
  stepMigration(w, dt, counts);

  // Season and year announcements
  const y = yearFraction(w);
  const season = seasonOf(y);
  if (w.settings.seasons && season !== w.lastSeason) {
    if (w.lastSeason !== -1) pushLog(w, `${SEASON_NAMES[season]} arrives.`);
    w.lastSeason = season;
  }
}

/* ------------------------------------------------------------------ *
 * Player tools
 * ------------------------------------------------------------------ */
export function applyTool(w: World, tool: Tool, x: number, y: number, radius: number) {
  const rand = w.rand;
  const jitter = () => (rand() - 0.5) * 2 * radius;

  switch (tool) {
    case "rabbit": case "deer": case "fox": case "wolf": case "crow": {
      const n = tool === "rabbit" ? 5 : tool === "crow" ? 3 : tool === "deer" ? 3 : 2;
      for (let i = 0; i < n; i++) {
        if (w.animals.length >= w.settings.maxCreatures) break;
        addAnimal(w, tool, x + jitter() * 0.5, y + jitter() * 0.5, 0.8, 1, true);
      }
      break;
    }
    case "shrub": case "tree": {
      const n = tool === "shrub" ? 4 : 2;
      for (let i = 0; i < n; i++) addPlant(w, tool, x + jitter(), y + jitter(), 0.35 + rand() * 0.4);
      break;
    }
    case "grass": {
      const c0 = Math.floor((x - radius) / CELL), c1 = Math.floor((x + radius) / CELL);
      const r0 = Math.floor((y - radius) / CELL), r1 = Math.floor((y + radius) / CELL);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        if (Math.hypot((c + 0.5) * CELL - x, (r + 0.5) * CELL - y) > radius) continue;
        const i = r * COLS + c;
        if (!w.water[i]) {
          w.grass[i] = Math.min(1, w.grass[i] + 0.7);
          w.moisture[i] = Math.min(1, w.moisture[i] + 0.3);
          w.fertility[i] = Math.min(1, w.fertility[i] + 0.15);
        }
      }
      break;
    }
    case "rain": {
      const c0 = Math.floor((x - radius * 2) / CELL), c1 = Math.floor((x + radius * 2) / CELL);
      const r0 = Math.floor((y - radius * 2) / CELL), r1 = Math.floor((y + radius * 2) / CELL);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        const i = r * COLS + c;
        w.moisture[i] = Math.min(1, w.moisture[i] + 0.55);
        w.burn[i] = 0;
      }
      break;
    }
    case "fire": {
      const c = clamp(Math.floor(x / CELL), 0, COLS - 1), r = clamp(Math.floor(y / CELL), 0, ROWS - 1);
      if (!w.water[r * COLS + c]) {
        w.burn[r * COLS + c] = 1;
        pushLog(w, "You lit a fire.");
      }
      break;
    }
    case "blight": {
      for (const p of w.plants) if (dist2(p.x, p.y, x, y) < (radius * 2.2) ** 2) p.alive = false;
      const c0 = Math.floor((x - radius * 2) / CELL), c1 = Math.floor((x + radius * 2) / CELL);
      const r0 = Math.floor((y - radius * 2) / CELL), r1 = Math.floor((y + radius * 2) / CELL);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        w.grass[r * COLS + c] = 0;
      }
      pushLog(w, "A blight swept across part of the valley.");
      break;
    }
    case "plague": {
      // Strikes whatever is nearest the cursor, thinning the local population.
      let hit = 0;
      for (const a of w.animals) {
        if (dist2(a.x, a.y, x, y) < (radius * 3.5) ** 2 && rand() < 0.55) {
          kill(w, a, "plague");
          hit++;
        }
      }
      pushLog(w, hit > 0 ? `A sickness took ${hit} animals.` : "A sickness passed through, finding nothing.");
      break;
    }
    case "pond": {
      if (w.ponds.length < 6 && !inWater(w, x, y)) {
        w.ponds.push({ x, y, r: 34 + rand() * 20 });
        rebuildWaterMask(w);
        for (const p of w.plants) if (inWater(w, p.x, p.y)) p.alive = false;
        pushLog(w, "A new pond fills a hollow.");
      }
      break;
    }
  }
  w.plants = w.plants.filter((p) => p.alive);
}

export function clearPonds(w: World) {
  w.ponds = [];
  rebuildWaterMask(w);
}
