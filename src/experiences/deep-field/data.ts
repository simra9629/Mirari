function hash2(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h % 2147483647) + 2147483647) % 2147483647;
}

/** Deterministic 0..1 value for a given galaxy candidate slot. */
export function galaxyBrightness(gx: number, gy: number, seed: number): number {
  return hash2(gx, gy, seed) / 2147483647;
}

export function galaxyHue(gx: number, gy: number, seed: number): number {
  return hash2(gx, gy, seed + 91) % 360;
}

export type GalaxyShape = "point" | "elliptical" | "spiral" | "streak";

export function galaxyShape(gx: number, gy: number, seed: number): GalaxyShape {
  const r = hash2(gx, gy, seed + 271) % 100;
  if (r < 40) return "point";
  if (r < 70) return "elliptical";
  if (r < 90) return "spiral";
  return "streak";
}

export function galaxyOrientation(gx: number, gy: number, seed: number): number {
  return (hash2(gx, gy, seed + 613) % 360) * (Math.PI / 180);
}

export const GRID_SPACING = 15; // world units between galaxy candidate slots
export const STAR_GRID_SPACING = GRID_SPACING * 4.5; // sparser — our own galaxy's foreground stars
export const MAX_ZOOM = 6;

export function visibilityThreshold(zoomLevel: number): number {
  return Math.max(0.05, 0.88 - zoomLevel * 0.145);
}

/** Foreground stars are always visible regardless of zoom — they're already fully resolved, unlike the faint background galaxies zoom reveals. */
export function isForegroundStar(sx: number, sy: number, seed: number): boolean {
  return hash2(sx, sy, seed + 4001) / 2147483647 > 0.82;
}

export function starBrightness(sx: number, sy: number, seed: number): number {
  return hash2(sx, sy, seed + 4001) / 2147483647;
}

export const deepFieldFacts = [
  "In 1995, the Hubble Space Telescope stared at a patch of sky smaller than a grain of sand held at arm's length — a spot chosen specifically because it looked completely empty. It found nearly 3,000 galaxies.",
  "The Hubble Ultra Deep Field looked even deeper into that same kind of 'empty' sky and found galaxies whose light had been traveling for over 13 billion years — nearly as old as the universe itself.",
  "Almost every point of light in a deep field image is an entire galaxy, not a star — each one holding billions of stars of its own, too far away to resolve individually.",
  "The handful of sharp, spiky points of light in any deep field image aren't galaxies at all — they're ordinary stars in our own galaxy, close enough to already be fully resolved, sitting in front of everything else.",
];
