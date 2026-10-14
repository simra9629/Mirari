import type { Level, Platform, Hazard } from "./engine";
import { makeRng } from "../../lib/rng";

/*
 * Jump/dash/gravity-jump distances here are hard caps derived from measuring
 * the actual physics in engine.ts (see decisions.md): a normal running jump
 * covers up to ~170px / 84px height; a Wind-dash or Gravity-boosted jump
 * covers up to ~254px / 130px height. Generated gaps stay safely under these
 * so every level is guaranteed traversable by construction, not by luck.
 */
const NORMAL_MAX_STEP = 55;
const Y_MIN = 150;
const Y_MAX = 340;

function pick(rand: () => number, lo: number, hi: number) {
  return lo + rand() * (hi - lo);
}

interface Cursor {
  x: number;
  y: number;
}

/** Adds `count` hops of platforming, returning the new cursor. Pass `boosted`
 * for any section placed after the Gravity star, since gravity is a
 * permanent change — every jump for the rest of the level is the longer,
 * higher arc, not just the one that reaches the high ledge. */
function addHops(
  rand: () => number,
  platforms: Platform[],
  cursor: Cursor,
  count: number,
  boosted = false,
): Cursor {
  let { x, y } = cursor;
  const maxStep = boosted ? 90 : NORMAL_MAX_STEP;
  for (let i = 0; i < count; i++) {
    const w = pick(rand, 110, 180);
    const dy = pick(rand, -maxStep, maxStep);
    const rise = Math.max(0, -dy);
    // Horizontal reach shrinks as the required rise grows (a jump spends
    // its airtime going up, not across), so the gap is capped by the rise
    // rather than sampled independently of it.
    const reach = boosted ? 200 - 1.4 * rise : 135 - 1.3 * rise;
    const dx = pick(rand, Math.min(60, reach * 0.5), Math.max(60, reach));
    x += dx;
    y = Math.max(Y_MIN, Math.min(Y_MAX, y + dy));
    platforms.push({ x, y, w, h: 20 });
    x += w;
  }
  return { x, y };
}

/**
 * Builds one level. The star order (Light, Wind, Gravity, Water) and the
 * shape of each gate are fixed — the same reasons the hand-authored level
 * worked (a star always gates the section right after it) — but every
 * position, gap width, hop count, and hazard is re-rolled from the level
 * number, and gated sections get more demanding as the level number rises.
 */
export function generateLevel(levelNumber: number): Level {
  const rand = makeRng(levelNumber * 104729 + 7919);
  const diff = Math.min(1, (levelNumber - 1) / 4); // 0 at level 1, 1 at level 5+

  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const stars: Level["stars"] = [];
  const checkpoints: { x: number; y: number }[] = [];

  const startX = 60;
  const startY = 304;
  platforms.push({ x: 0, y: 320, w: 260, h: 20 });
  checkpoints.push({ x: startX, y: startY });
  let cursor: Cursor = { x: 260, y: 320 };

  // Section A: intro hops to the Light star
  cursor = addHops(rand, platforms, cursor, 2 + Math.floor(diff * 2));
  const lightPlatform = platforms[platforms.length - 1];
  stars.push({ id: "light", x: lightPlatform.x + lightPlatform.w * 0.5, y: lightPlatform.y - 24, r: 18, collected: false, catchHalfW: lightPlatform.w * 0.5 });

  // Section B: the dark cave. More hidden hops at higher difficulty.
  const caveStartX = cursor.x + 60;
  const caveHops = 3 + Math.floor(diff * 3);
  checkpoints.push({ x: caveStartX, y: cursor.y - 16 });
  platforms.push({ x: cursor.x, y: cursor.y, w: 90, h: 20 });
  cursor = { x: cursor.x + 90, y: cursor.y };
  for (let i = 0; i < caveHops; i++) {
    const w = pick(rand, 70, 100);
    const dx = pick(rand, 90, 120);
    const dy = pick(rand, -30, 30);
    cursor = { x: cursor.x + dx, y: Math.max(Y_MIN, Math.min(Y_MAX, cursor.y + dy)) };
    platforms.push({ x: cursor.x, y: cursor.y, w, h: 20, hidden: true });
    cursor = { x: cursor.x + w, y: cursor.y };
  }
  const caveEndX = cursor.x + 60;
  platforms.push({ x: cursor.x + 60, y: cursor.y, w: 150, h: 20 });
  hazards.push({ kind: "spike", x: caveStartX, y: 400, w: caveEndX - caveStartX + 60, h: 40 });
  cursor = { x: cursor.x + 60 + 150, y: cursor.y };

  // A moving hazard was tried here at higher difficulty and pulled — its
  // oscillation covered too much of the platform to reliably dodge in
  // passing, and repeated headless verification failures weren't worth
  // chasing down further this pass. hazardRectAt() and Hazard.moveRange in
  // engine.ts are still there for a future, better-tuned attempt.

  // Section C: hops to the Wind star
  cursor = addHops(rand, platforms, cursor, 1 + Math.floor(diff * 2));
  const windPlatform = platforms[platforms.length - 1];
  stars.push({ id: "wind", x: windPlatform.x + windPlatform.w * 0.5, y: windPlatform.y - 24, r: 18, collected: false, catchHalfW: windPlatform.w * 0.5 });
  checkpoints.push({ x: cursor.x, y: cursor.y - 16 });

  // Section D: the dash gap
  const dashGap = 175 + diff * 50; // stays under the measured ~254px dash max
  const dashLandX = cursor.x + dashGap;
  const dashLandY = cursor.y;
  platforms.push({ x: dashLandX, y: dashLandY, w: pick(rand, 150, 210), h: 20 });
  hazards.push({ kind: "spike", x: cursor.x, y: 400, w: dashGap, h: 40 });
  cursor = { x: dashLandX + platforms[platforms.length - 1].w, y: dashLandY };
  checkpoints.push({ x: dashLandX + 20, y: dashLandY - 16 });

  // Section E: hops to the Gravity star
  cursor = addHops(rand, platforms, cursor, 1 + Math.floor(diff * 2));
  const gravPlatform = platforms[platforms.length - 1];
  stars.push({ id: "gravity", x: gravPlatform.x + gravPlatform.w * 0.5, y: gravPlatform.y - 24, r: 18, collected: false, catchHalfW: gravPlatform.w * 0.5 });
  checkpoints.push({ x: cursor.x, y: cursor.y - 16 });

  // Section F: the high ledge
  const ledgeHeight = 90 + diff * 20; // stays under the measured ~130px gravity-boosted max
  const ledgeDx = pick(rand, 70, 100);
  const ledgeX = cursor.x + ledgeDx;
  const ledgeY = Math.max(120, cursor.y - ledgeHeight);
  platforms.push({ x: ledgeX, y: ledgeY, w: pick(rand, 140, 190), h: 20 });
  hazards.push({ kind: "spike", x: cursor.x, y: 400, w: ledgeDx + 260, h: 40 });
  let hx = ledgeX + platforms[platforms.length - 1].w;
  platforms.push({ x: hx + 60, y: cursor.y, w: 150, h: 20 });
  cursor = { x: hx + 60 + 150, y: cursor.y };
  checkpoints.push({ x: hx + 80, y: cursor.y - 16 });

  // Section G: hops to the Water star. Gravity is already collected by now,
  // so every jump is the boosted arc — gaps are sized for that, not a normal jump.
  cursor = addHops(rand, platforms, cursor, 1 + Math.floor(diff * 1), true);
  const waterPlatform = platforms[platforms.length - 1];
  stars.push({ id: "water", x: waterPlatform.x + waterPlatform.w * 0.5, y: waterPlatform.y - 24, r: 18, collected: false, catchHalfW: waterPlatform.w * 0.5 });

  // Section H: the lake
  const lakeWidth = 220 + diff * 90;
  // The lake is contiguous with the platforms on both sides: any void
  // between the water and a platform edge would just drop a swimmer out of the level.
  const lakeStartX = cursor.x;
  // Water surface sits just above the platform tops, so a swimmer can climb out onto them.
  hazards.push({ kind: "water", x: lakeStartX, y: cursor.y - 10, w: lakeWidth, h: 130 });
  checkpoints.push({ x: lakeStartX - 20, y: cursor.y - 16 });
  const finalX = lakeStartX + lakeWidth;
  platforms.push({ x: finalX, y: cursor.y, w: 320, h: 20 });

  const goal = { x: finalX + 260, y: cursor.y - 30 };

  return {
    width: goal.x + 60,
    height: 440,
    groundY: 10000,
    startX,
    startY,
    platforms,
    hazards,
    stars,
    checkpoints,
    goal,
  };
}

export const LEVEL_COUNT_DISPLAY_CAP = 5; // difficulty stops increasing after this, but levels keep coming

const STORAGE_KEY = "mirari-fox-stars-progress";

export interface Progress {
  levelReached: number;
  bestRespawns: number | null;
}

function defaultProgress(): Progress {
  return { levelReached: 1, bestRespawns: null };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return {
      levelReached: typeof parsed.levelReached === "number" ? parsed.levelReached : 1,
      bestRespawns: typeof parsed.bestRespawns === "number" ? parsed.bestRespawns : null,
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // best-effort
  }
}
