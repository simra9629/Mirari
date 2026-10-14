export const WORLD_W = 700;
export const WORLD_H = 440;

/* ------------------------------------------------------------------ *
 * Shared free-flight movement, used by the flight/speed/rescue lessons
 * ------------------------------------------------------------------ */
export interface FlightBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface FlightInput {
  ax: number; // -1..1
  ay: number; // -1..1
}

const THRUST = 620;
const DRAG = 2.4;
const MAX_SPEED = 230;

export function stepFlight(body: FlightBody, input: FlightInput, dt: number) {
  const len = Math.hypot(input.ax, input.ay) || 1;
  const nx = len > 1 ? input.ax / len : input.ax;
  const ny = len > 1 ? input.ay / len : input.ay;
  body.vx += nx * THRUST * dt;
  body.vy += ny * THRUST * dt;
  const decay = Math.max(0, 1 - DRAG * dt);
  body.vx *= decay;
  body.vy *= decay;
  const speed = Math.hypot(body.vx, body.vy);
  if (speed > MAX_SPEED) {
    body.vx = (body.vx / speed) * MAX_SPEED;
    body.vy = (body.vy / speed) * MAX_SPEED;
  }
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.x = Math.max(16, Math.min(WORLD_W - 16, body.x));
  body.y = Math.max(16, Math.min(WORLD_H - 16, body.y));
}

/* ------------------------------------------------------------------ *
 * Flight & Speed: fly through a sequence of rings
 * ------------------------------------------------------------------ */
export interface Ring {
  x: number;
  y: number;
  r: number;
}

export interface RingLevel {
  rings: Ring[];
  ordered: boolean; // Speed lessons require rings in sequence; Flight lessons don't
  timeLimit: number;
  startX: number;
  startY: number;
}

export interface RingRunState {
  body: FlightBody;
  hit: boolean[];
  time: number;
  done: boolean;
  failed: boolean;
}

export function createRingRun(level: RingLevel): RingRunState {
  return {
    body: { x: level.startX, y: level.startY, vx: 0, vy: 0 },
    hit: level.rings.map(() => false),
    time: 0,
    done: false,
    failed: false,
  };
}

export function stepRingRun(state: RingRunState, level: RingLevel, input: FlightInput, dt: number) {
  if (state.done || state.failed) return;
  stepFlight(state.body, input, dt);
  state.time += dt;

  const nextIndex = level.ordered ? state.hit.findIndex((h) => !h) : -1;
  level.rings.forEach((ring, i) => {
    if (state.hit[i]) return;
    if (level.ordered && i !== nextIndex) return;
    const d = Math.hypot(state.body.x - ring.x, state.body.y - ring.y);
    if (d < ring.r) state.hit[i] = true;
  });

  if (state.hit.every(Boolean)) state.done = true;
  else if (state.time > level.timeLimit) state.failed = true;
}

/* ------------------------------------------------------------------ *
 * Fire Breathing: aim and hold to breathe fire at targets
 * ------------------------------------------------------------------ */
export interface FireTarget {
  x: number;
  y: number;
  r: number;
  vx: number;
  appearAt: number;
  hitAt: number | null;
}

export interface FireLevel {
  targets: FireTarget[];
  timeLimit: number;
  requiredHits: number;
}

export interface FireRunState {
  targets: FireTarget[];
  time: number;
  hits: number;
  done: boolean;
  failed: boolean;
  aimX: number;
  aimY: number;
  breathing: boolean;
}

export function createFireRun(level: FireLevel): FireRunState {
  return {
    targets: level.targets.map((t) => ({ ...t })),
    time: 0,
    hits: 0,
    done: false,
    failed: false,
    aimX: WORLD_W / 2,
    aimY: WORLD_H / 2,
    breathing: false,
  };
}

const FLAME_HALF_ANGLE = 0.34; // radians
const FLAME_RANGE = 340;
const MOUTH_X = WORLD_W / 2;
const MOUTH_Y = WORLD_H - 40;

export function stepFireRun(state: FireRunState, level: FireLevel, dt: number) {
  if (state.done || state.failed) return;
  state.time += dt;

  for (const t of state.targets) {
    if (t.hitAt !== null) continue;
    if (state.time < t.appearAt) continue;
    t.x += t.vx * dt;
    if (t.x < 20 || t.x > WORLD_W - 20) t.vx *= -1;
  }

  if (state.breathing) {
    const aimAngle = Math.atan2(state.aimY - MOUTH_Y, state.aimX - MOUTH_X);
    for (const t of state.targets) {
      if (t.hitAt !== null || state.time < t.appearAt) continue;
      const d = Math.hypot(t.x - MOUTH_X, t.y - MOUTH_Y);
      if (d > FLAME_RANGE) continue;
      const angleTo = Math.atan2(t.y - MOUTH_Y, t.x - MOUTH_X);
      let diff = Math.abs(angleTo - aimAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < FLAME_HALF_ANGLE) {
        t.hitAt = state.time;
        state.hits++;
      }
    }
  }

  if (state.hits >= level.requiredHits) state.done = true;
  else if (state.time > level.timeLimit) state.failed = true;
}

/* ------------------------------------------------------------------ *
 * Precision: descend and land on a sequence of pads
 * ------------------------------------------------------------------ */
export interface Pad {
  x: number;
  y: number;
  halfW: number;
}

export interface LandingLevel {
  pads: Pad[];
  fallSpeed: number;
}

export interface LandingRunState {
  padIndex: number;
  x: number;
  y: number;
  vy: number;
  landed: number;
  done: boolean;
  failed: boolean;
  bestOffsets: number[];
}

export function createLandingRun(level: LandingLevel): LandingRunState {
  return {
    padIndex: 0,
    x: WORLD_W / 2,
    y: 40,
    vy: level.fallSpeed,
    landed: 0,
    done: false,
    failed: false,
    bestOffsets: [],
  };
}

export function stepLandingRun(state: LandingRunState, level: LandingLevel, steerX: number, dt: number) {
  if (state.done || state.failed) return;
  state.x += steerX * 160 * dt;
  state.x = Math.max(16, Math.min(WORLD_W - 16, state.x));
  state.y += state.vy * dt;

  const pad = level.pads[state.padIndex];
  if (!pad) return;

  if (state.y >= pad.y) {
    const offset = Math.abs(state.x - pad.x);
    const onPad = offset < pad.halfW;
    if (onPad) {
      state.bestOffsets.push(offset);
      state.padIndex++;
      state.landed++;
      if (state.padIndex >= level.pads.length) {
        state.done = true;
      } else {
        state.y = 40;
        state.vy = level.fallSpeed;
      }
    } else {
      state.failed = true;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Rescue: carry a student from a start point to a safe zone, dodging hazards
 * ------------------------------------------------------------------ */
export interface Hazard {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

export interface RescueLevel {
  studentX: number;
  studentY: number;
  safeX: number;
  safeY: number;
  hazards: Hazard[];
  timeLimit: number;
}

export interface RescueRunState {
  body: FlightBody;
  hazards: Hazard[];
  carrying: boolean;
  delivered: boolean;
  time: number;
  done: boolean;
  failed: boolean;
  drops: number;
}

export function createRescueRun(level: RescueLevel): RescueRunState {
  return {
    body: { x: 40, y: WORLD_H / 2, vx: 0, vy: 0 },
    hazards: level.hazards.map((h) => ({ ...h })),
    carrying: false,
    delivered: false,
    time: 0,
    done: false,
    failed: false,
    drops: 0,
  };
}

export function stepRescueRun(state: RescueRunState, level: RescueLevel, input: FlightInput, dt: number) {
  if (state.done || state.failed) return;
  stepFlight(state.body, input, dt);
  state.time += dt;

  for (const h of state.hazards) {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (h.x < 20 || h.x > WORLD_W - 20) h.vx *= -1;
    if (h.y < 20 || h.y > WORLD_H - 20) h.vy *= -1;
  }

  if (!state.carrying && !state.delivered) {
    const d = Math.hypot(state.body.x - level.studentX, state.body.y - level.studentY);
    if (d < 22) state.carrying = true;
  }

  if (state.carrying) {
    for (const h of state.hazards) {
      const d = Math.hypot(state.body.x - h.x, state.body.y - h.y);
      if (d < h.r + 14) {
        state.carrying = false;
        state.drops++;
        break;
      }
    }
  }

  if (state.carrying) {
    const d = Math.hypot(state.body.x - level.safeX, state.body.y - level.safeY);
    if (d < 26) {
      state.delivered = true;
      state.done = true;
    }
  }

  if (state.time > level.timeLimit && !state.done) state.failed = true;
}
