/**
 * The town, built once from the authored data. Static geometry only — the
 * engine adds everything that moves.
 */
import {
  DISTRICT, GROUND, LANDMARKS, LOC, WORLD_H, WORLD_W,
  type DistrictId, type LocId, type Landmark,
} from "./data";

export interface Rect { x: number; y: number; w: number; h: number }
export interface Building {
  id: number; x: number; w: number; h: number; baseY: number; district: DistrictId;
  style: Landmark["style"] | "tall" | "pine" | "hut"; color: string; roof: string; lm?: LocId; seed: number;
  chimney?: number; roofTop: number; noDoor?: boolean;
}
export interface Tree { x: number; w: number; topY: number; canopy: number; seed: number; giant?: boolean }
export interface Pad { x: number; y: number; r: number }
export interface Portal { id: string; x: number; y: number; to: string; mouthY: number }
export interface Ring { id: number; x: number; y: number; r: number; lane: boolean }
export interface FlockDef { cx: number; cy: number; ax: number; ay: number; sp: number; n: number; kind: "crow" | "gull" | "sparrow"; ph: number }
export interface Tunnel { id: string; x0: number; x1: number; sh1: [number, number]; sh2: [number, number]; top: number; bottom: number }

export interface World {
  buildings: Building[]; trees: Tree[]; solids: Rect[]; buckets: number[][];
  pads: Record<LocId, Pad>; portals: Portal[]; rings: Ring[]; flocks: FlockDef[];
  updrafts: Rect[]; windTunnels: Rect[]; drags: Rect[]; tunnels: Tunnel[];
  towerHole: Rect; fountain: Rect; bridges: Rect[]; river: [number, number]; sea: [number, number];
  books: { cx: number; cy: number; ax: number; ay: number; sp: number; ph: number }[];
  cells: { cx: number; cy: number; ax: number; sp: number; ph: number }[];
  crane: { x: number; y: number; len: number };
  chimneyTops: { x: number; y: number }[];
}

function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RIVER: [number, number] = [2200, 2800];
export const SEA: [number, number] = [8330, 9230];
const HILL: [number, number] = [6500, 7600];
const BUCKET = 200;

export function inRiver(x: number) { return x > RIVER[0] && x < RIVER[1]; }
export function inSea(x: number) { return x > SEA[0] && x < SEA[1]; }
export function isWaterX(x: number) { return inRiver(x) || inSea(x); }

export function terrainY(x: number): number {
  if (isWaterX(x)) return GROUND + 6;
  if (x > HILL[0] && x < HILL[1]) {
    const t = (x - HILL[0]) / (HILL[1] - HILL[0]);
    return GROUND - 340 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * t));
  }
  if (x >= 9230) return GROUND - 70;
  return GROUND;
}

export const TUNNELS: Tunnel[] = [
  { id: "drain", x0: 1160, x1: 2140, sh1: [1180, 1260], sh2: [2010, 2090], top: 1170, bottom: 1270 },
  { id: "roots", x0: 3640, x1: 4560, sh1: [3660, 3740], sh2: [4470, 4550], top: 1170, bottom: 1270 },
];
export function inTunnelX(x: number) { return TUNNELS.some((t) => x > t.x0 - 6 && x < t.x1 + 6); }

export function buildWorld(seed = 11): World {
  const rnd = mulberry(seed);
  const rr = (a: number, b: number) => a + rnd() * (b - a);
  const pickOf = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  let nextId = 1;
  const buildings: Building[] = [];
  const solids: Rect[] = [];
  const trees: Tree[] = [];
  const pads = {} as Record<LocId, Pad>;
  const chimneyTops: { x: number; y: number }[] = [];
  const portals: Portal[] = [];

  const roofExtra = (style: Building["style"], w: number) =>
    style === "tower" ? 80 : style === "dome" ? w * 0.32 : style === "lighthouse" ? 46 : style === "tree" ? 40 : style === "well" || style === "stall" || style === "dock" ? 24 : style === "pine" ? 0 : Math.min(60, w * 0.3);

  function addBuilding(district: DistrictId, cx: number, w: number, h: number, style: Building["style"], color?: string, lm?: LocId, extra: Partial<Building> = {}): Building {
    const d = DISTRICT[district];
    const baseY = extra.baseY ?? terrainY(cx);
    const top = baseY - h;
    const re = roofExtra(style, w);
    const b: Building = {
      id: nextId++, x: cx - w / 2, w, h, baseY, district, style,
      color: color ?? pickOf(d.palette.wall), roof: pickOf(d.palette.roof), lm, seed: rnd(), roofTop: top - re, ...extra,
    };
    buildings.push(b);
    solids.push({ x: b.x, y: top, w, h });
    if (re > 0 && style !== "pine") solids.push({ x: b.x + w * (style === "tower" ? 0.3 : 0.2), y: top - re * 0.75, w: w * (style === "tower" ? 0.4 : 0.6), h: re * 0.75 });
    if (lm) pads[lm] = { x: cx, y: b.roofTop - 42, r: 56 };
    return b;
  }

  /* ---------- forced buildings (landmarks & set pieces) ---------- */
  const forced: { d: DistrictId; x: number; w: number }[] = [];
  const reserve = (d: DistrictId, x: number, w: number) => forced.push({ d, x, w });

  // Old Town
  for (const lm of LANDMARKS) {
    if (lm.id === "clock" || lm.id === "lighthouse" || lm.id === "oak" || lm.id === "observatory") continue;
    addBuilding(lm.district, lm.x, lm.w, lm.h, lm.style, lm.color, lm.id, lm.id === "fishdock" ? { chimney: 0 } : {});
    reserve(lm.district, lm.x, lm.w + 30);
  }
  // clocktower (with a hole to fly through)
  {
    const lm = LOC.clock;
    const b: Building = { id: nextId++, x: lm.x - lm.w / 2, w: lm.w, h: lm.h, baseY: GROUND, district: "old", style: "tower", color: lm.color, roof: "#5d4a6b", lm: "clock", seed: rnd(), roofTop: GROUND - lm.h - 90 };
    buildings.push(b);
    solids.push({ x: b.x, y: GROUND - 290, w: lm.w, h: 290 });
    solids.push({ x: b.x, y: GROUND - lm.h, w: lm.w, h: lm.h - 352 });
    solids.push({ x: b.x + lm.w * 0.3, y: GROUND - lm.h - 66, w: lm.w * 0.4, h: 66 });
    pads.clock = { x: lm.x, y: b.roofTop - 42, r: 56 };
    reserve("old", lm.x, lm.w + 30);
  }
  // oak
  {
    const lm = LOC.oak;
    addBuilding("wood", lm.x, lm.w, lm.h, "tree", lm.color, "oak");
    reserve("wood", lm.x, lm.w + 40);
  }
  // lighthouse (on its rock)
  {
    const lm = LOC.lighthouse;
    const baseY = GROUND - 70;
    const b = addBuilding("harbor", lm.x, lm.w, lm.h, "lighthouse", lm.color, "lighthouse", { baseY });
    void b;
  }
  // observatory (on the hilltop)
  {
    const lm = LOC.observatory;
    addBuilding("hill", lm.x, lm.w, lm.h, "dome", lm.color, "observatory", { baseY: terrainY(lm.x) });
    reserve("hill", lm.x, lm.w + 40);
  }
  // garden slot flanks, chimney buildings, no-door house
  addBuilding("old", 285, 100, 300, "tall"); reserve("old", 285, 130);
  addBuilding("old", 455, 110, 310, "tall"); reserve("old", 455, 140);
  const chA = addBuilding("old", 1560, 150, 300, "house", undefined, undefined, { chimney: 1 }); reserve("old", 1560, 180);
  const chB = buildings.find((b) => b.lm === "mill")!; chB.chimney = 1;
  const chC = addBuilding("uni", 4900, 120, 260, "tall", undefined, undefined, { chimney: 1 }); reserve("uni", 4900, 150);
  const manor = buildings.find((b) => b.lm === "manor")!; manor.chimney = 1;
  addBuilding("hill", 7330, 90, 80, "hut", "#d8c4a4", undefined, { noDoor: true }); reserve("hill", 7330, 120);

  // chimney portals: tall hollow stacks with a magic mouth
  const stack = (b: Building, dx: number, id: string, to: string) => {
    const cx = b.x + b.w / 2 + dx, top = b.baseY - b.h - 4;
    const hgt = 130;
    solids.push({ x: cx - 27, y: top - hgt, w: 8, h: hgt });
    solids.push({ x: cx + 19, y: top - hgt, w: 8, h: hgt });
    portals.push({ id, x: cx, y: top - hgt + 14, to, mouthY: top - hgt });
    chimneyTops.push({ x: cx, y: top - hgt });
  };
  stack(chA, 30, "A", "B"); stack(chB, 40, "B", "A"); stack(chC, 20, "C", "D"); stack(manor, 60, "D", "C");
  // reserve for stacks is within the buildings

  /* ---------- fill the gaps ---------- */
  for (const d of Object.values(DISTRICT)) {
    if (d.id === "wood") continue;
    const res = forced.filter((f) => f.d === d.id).map((f) => [f.x - f.w / 2, f.x + f.w / 2] as [number, number]).sort((a, b) => a[0] - b[0]);
    const skip: [number, number][] = [...res];
    if (d.id === "river") skip.push([RIVER[0] - 40, RIVER[1] + 40]);
    if (d.id === "harbor") skip.push([8290 - 60, 9400]);
    if (d.id === "hill") skip.push([6340, 6580]);
    const blocked = (x0: number, x1: number) => skip.some(([a, b]) => x1 > a && x0 < b);
    let x = d.x0 + rr(10, 40);
    while (x < d.x1 - 60) {
      const w = d.id === "uni" ? rr(90, 150) : d.id === "river" ? rr(80, 130) : d.id === "hill" ? rr(70, 110) : d.id === "harbor" ? rr(130, 190) : rr(90, 140);
      const gap = d.id === "old" ? rr(55, 95) : rr(50, 140);
      if (x + w > d.x1 - 10) break;
      if (blocked(x - 10, x + w + 10)) {
        const hit = skip.find(([a, b]) => x + w + 10 > a && x - 10 < b)!;
        x = hit[1] + rr(8, 30);
        continue;
      }
      const h = d.id === "old" ? rr(150, 330) : d.id === "river" ? rr(90, 170) : d.id === "uni" ? rr(220, 520) : d.id === "hill" ? rr(60, 120) : rr(100, 190);
      const style: Building["style"] = d.id === "uni" ? (rnd() < 0.55 ? "tower" : "tall") : d.id === "harbor" ? "warehouse" : rnd() < 0.5 ? "house" : "tall";
      const cxm = x + w / 2;
      if (d.id === "hill" && cxm > 6900 && cxm < 7260) { x += w + gap; continue; }
      addBuilding(d.id, cxm, w, h, style);
      x += w + gap;
    }
  }

  /* ---------- Witchwood trees ---------- */
  const treeSkip: [number, number][] = [[3420, 4100], [4240, 4360], [4540, 4660], [4440, 4580]];
  for (let x = 3330; x < 4780; x += rr(95, 150)) {
    if (treeSkip.some(([a, b]) => x > a - 20 && x < b + 20)) continue;
    const w = rr(28, 46), topY = GROUND - rr(300, 460);
    trees.push({ x, w, topY, canopy: rr(70, 110), seed: rnd() });
    solids.push({ x: x - w / 2, y: topY + 40, w, h: GROUND - topY - 40 });
  }
  // the giant tree (the one with the village in it)
  trees.push({ x: 4300, w: 70, topY: GROUND - 560, canopy: 160, seed: 0.5, giant: true });
  solids.push({ x: 4265, y: GROUND - 520, w: 70, h: 520 });
  // trees near the moonwell edge
  for (const x of [3345, 4740]) { trees.push({ x, w: 34, topY: GROUND - 380, canopy: 90, seed: rnd() }); solids.push({ x: x - 17, y: GROUND - 340, w: 34, h: 340 }); }

  /* ---------- bridges, river ---------- */
  const bridges: Rect[] = [{ x: 2170, y: GROUND - 105, w: 250, h: 16 }, { x: 2420, y: GROUND - 125, w: 410, h: 16 }];
  for (const b of bridges) solids.push(b);
  for (const [px, top] of [[2170, GROUND - 105], [2405, GROUND - 105], [2820, GROUND - 125]] as [number, number][]) solids.push({ x: px, y: top, w: 20, h: GROUND - top });
  solids.push({ x: 2395, y: GROUND - 105, w: 20, h: 111 });

  /* ---------- harbor set pieces ---------- */
  solids.push({ x: 8277, y: GROUND - 480, w: 26, h: 480 }); // crane tower
  solids.push({ x: 8180, y: GROUND - 486, w: 110, h: 10 }); // crane jib
  for (const [x0, x1] of [[8430, 8690], [8810, 9030]]) {
    solids.push({ x: x0, y: GROUND - 52, w: x1 - x0, h: 56 });
    solids.push({ x: (x0 + x1) / 2 - 5, y: GROUND - 330, w: 10, h: 280 });
    solids.push({ x: x0 + 40, y: GROUND - 250, w: 8, h: 200 });
  }
  solids.push({ x: 8330, y: GROUND - 26, w: 80, h: 10 }); // pier

  /* ---------- tunnels (underground) ---------- */
  for (const t of TUNNELS) {
    solids.push({ x: t.x0 - 40, y: GROUND, w: 40, h: WORLD_H - GROUND + 60 });
    solids.push({ x: t.x1, y: GROUND, w: 40, h: WORLD_H - GROUND + 60 });
    solids.push({ x: t.x0, y: GROUND, w: t.sh1[0] - t.x0, h: t.top - GROUND });
    solids.push({ x: t.sh1[1], y: GROUND, w: t.sh2[0] - t.sh1[1], h: t.top - GROUND });
    solids.push({ x: t.sh2[1], y: GROUND, w: t.x1 - t.sh2[1], h: t.top - GROUND });
    solids.push({ x: t.x0, y: t.bottom, w: t.x1 - t.x0, h: WORLD_H - t.bottom + 60 });
  }

  /* ---------- zones ---------- */
  const updrafts: Rect[] = [
    { x: 6560, y: 330, w: 340, h: 520 }, { x: 7020, y: 300, w: 120, h: 300 },
  ];
  const windTunnels: Rect[] = [{ x: 3660, y: GROUND - 235, w: 440, h: 85 }];
  const drags: Rect[] = [{ x: 3300, y: GROUND - 560, w: 120, h: 230 }, { x: 4100, y: GROUND - 560, w: 700, h: 230 }, { x: 4140, y: GROUND - 640, w: 320, h: 200 }];
  const towerHole: Rect = { x: LOC.clock.x - 60, y: GROUND - 352, w: 120, h: 62 };
  const fountain: Rect = { x: 1250, y: GROUND - 56, w: 60, h: 56 };

  /* ---------- rings (floating archways; the high ones are Cloud Lane) ---------- */
  const rings: Ring[] = [];
  let rid = 1;
  for (const [x, y] of [[5400, 600], [5580, 520], [5990, 650]]) rings.push({ id: rid++, x, y, r: 48, lane: false });
  for (const [x, y] of [[2300, 170], [3200, 200], [4100, 150], [5000, 210], [5900, 160], [6800, 220], [7700, 170], [8600, 200]]) rings.push({ id: rid++, x, y, r: 52, lane: true });
  rings.push({ id: rid++, x: 2000, y: 760, r: 48, lane: false }, { id: rid++, x: 3980, y: GROUND - 190, r: 48, lane: false });

  /* ---------- things that move ---------- */
  const flocks: FlockDef[] = [
    { cx: 700, cy: 700, ax: 260, ay: 60, sp: 0.5, n: 6, kind: "crow", ph: 0 }, { cx: 1300, cy: 640, ax: 240, ay: 70, sp: 0.42, n: 5, kind: "crow", ph: 2 },
    { cx: 2450, cy: 880, ax: 300, ay: 50, sp: 0.4, n: 6, kind: "gull", ph: 1 }, { cx: 3050, cy: 760, ax: 200, ay: 60, sp: 0.5, n: 5, kind: "gull", ph: 4 },
    { cx: 4250, cy: 650, ax: 260, ay: 80, sp: 0.38, n: 6, kind: "crow", ph: 3 }, { cx: 5800, cy: 560, ax: 280, ay: 70, sp: 0.46, n: 6, kind: "sparrow", ph: 5 },
    { cx: 6900, cy: 520, ax: 260, ay: 60, sp: 0.44, n: 5, kind: "crow", ph: 2 }, { cx: 7900, cy: 640, ax: 220, ay: 50, sp: 0.5, n: 5, kind: "gull", ph: 6 },
    { cx: 8500, cy: 780, ax: 300, ay: 60, sp: 0.42, n: 6, kind: "gull", ph: 1 }, { cx: 8950, cy: 700, ax: 220, ay: 60, sp: 0.5, n: 5, kind: "gull", ph: 0 },
  ];
  const books = Array.from({ length: 8 }, (_, i) => ({ cx: 5300 + i * 140 + rr(-30, 30), cy: rr(420, 820), ax: rr(30, 70), ay: rr(30, 80), sp: rr(0.5, 1.1), ph: rr(0, 6) }));
  const cells = [{ cx: 5850, cy: 470, ax: 60, sp: 0.4, ph: 0 }, { cx: 5400, cy: 330, ax: 50, sp: 0.5, ph: 2 }];

  const sorted = buildings.sort((a, b) => a.x - b.x);
  void sorted;
  const buckets: number[][] = Array.from({ length: Math.ceil(WORLD_W / BUCKET) + 2 }, () => []);
  solids.forEach((s, i) => {
    for (let b = Math.max(0, Math.floor(s.x / BUCKET)); b <= Math.min(buckets.length - 1, Math.floor((s.x + s.w) / BUCKET)); b++) buckets[b].push(i);
  });

  return {
    buildings, trees, solids, buckets, pads, portals, rings, flocks, updrafts, windTunnels, drags, tunnels: TUNNELS,
    towerHole, fountain, bridges, river: RIVER, sea: SEA, books, cells, crane: { x: 8290, y: GROUND - 486, len: 150 }, chimneyTops,
  };
}

export function solidsNear(w: World, x0: number, x1: number): Rect[] {
  const out: Rect[] = [];
  const seen = new Set<number>();
  for (let b = Math.max(0, Math.floor(x0 / BUCKET)); b <= Math.min(w.buckets.length - 1, Math.floor(x1 / BUCKET)); b++) {
    for (const i of w.buckets[b]) if (!seen.has(i)) { seen.add(i); out.push(w.solids[i]); }
  }
  return out;
}
