import type { ConstellationDef } from "./constellations";

export interface PlacedStar {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  target: boolean;
  constellationId?: string;
}

export interface Anchor {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** Lay out `n` anchor boxes in a roughly even grid, with padding between them. */
export function getAnchors(n: number): Anchor[] {
  if (n <= 1) return [{ x0: 0.08, y0: 0.08, w: 0.84, h: 0.84 }];
  if (n === 2) {
    return [
      { x0: 0.03, y0: 0.08, w: 0.44, h: 0.84 },
      { x0: 0.53, y0: 0.08, w: 0.44, h: 0.84 },
    ];
  }
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const pad = 0.02;
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  const anchors: Anchor[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    anchors.push({
      x0: col * cellW + pad,
      y0: row * cellH + pad,
      w: cellW - pad * 2,
      h: cellH - pad * 2,
    });
  }
  return anchors;
}

export function placeConstellation(
  def: ConstellationDef,
  anchor: Anchor,
): { stars: PlacedStar[]; edges: [string, string][] } {
  const stars = def.stars.map((s) => ({
    id: `${def.id}:${s.id}`,
    name: s.name,
    x: anchor.x0 + s.x * anchor.w,
    y: anchor.y0 + s.y * anchor.h,
    size: s.size,
    target: true,
    constellationId: def.id,
  }));
  const edges: [string, string][] = def.edges.map(([a, b]) => [
    `${def.id}:${a}`,
    `${def.id}:${b}`,
  ]);
  return { stars, edges };
}

/** Deterministic pseudo-random distractor stars, scattered across the whole field. */
export function generateDistractors(count: number, seed: number): PlacedStar[] {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: `distractor-${seed}-${i}`,
    name: "",
    x: rand(),
    y: rand(),
    size: rand() * 2 + 1,
    target: false,
  }));
}
