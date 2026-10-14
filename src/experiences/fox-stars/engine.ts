export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type StarKind = "light" | "wind" | "gravity" | "water";

export interface Platform extends Rect {
  /** Hidden platforms are invisible and non-solid until the Light star is collected. */
  hidden?: boolean;
}

export interface Hazard extends Rect {
  /** Water is deadly until the Water star is collected, after which it's swimmable. */
  kind: "spike" | "water";
  /** Optional horizontal oscillation: the hazard slides between x-moveRange and x+moveRange. */
  moveRange?: number;
  moveSpeed?: number;
}

/** The hazard's current rect, accounting for any horizontal oscillation. */
export function hazardRectAt(h: Hazard, t: number): Rect {
  if (!h.moveRange || !h.moveSpeed) return h;
  const offset = Math.sin(t * h.moveSpeed) * h.moveRange;
  return { x: h.x + offset, y: h.y, w: h.w, h: h.h };
}

export interface StarPickup {
  id: StarKind;
  x: number;
  y: number;
  r: number;
  collected: boolean;
  /** Horizontal catch half-width. Generated levels set this to half the star's platform width, so being over that platform collects it. */
  catchHalfW?: number;
}

export interface Checkpoint extends Rect {
  x: number;
  y: number;
}

export interface Level {
  width: number;
  height: number;
  groundY: number;
  platforms: Platform[];
  hazards: Hazard[];
  stars: StarPickup[];
  checkpoints: { x: number; y: number }[];
  goal: { x: number; y: number };
  startX: number;
  startY: number;
}

/* ------------------------------------------------------------------ *
 * Physics constants
 * ------------------------------------------------------------------ */
const GRAVITY = 1400;
const GRAVITY_BOOSTED = 950; // after the Gravity star
const JUMP_V = 520;
const MOVE_ACCEL = 1800;
const MOVE_MAX = 240;
const FRICTION = 2200;
const DASH_VX = 470;
const DASH_DURATION = 0.35;
const DASH_COOLDOWN = 0.9;
const SWIM_SPEED = 130;

export interface FoxState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: 1 | -1;
  swimming: boolean;
  dashCooldown: number;
  dashTimeLeft: number;
  powers: Record<StarKind, boolean>;
  checkpoint: { x: number; y: number };
  respawns: number;
  dead: boolean; // brief death flag, cleared on respawn
  finished: boolean;
  levelTime: number;
}

export interface FoxInput {
  left: boolean;
  right: boolean;
  jumpPressed: boolean; // edge-triggered: true only on the frame the key was pressed
  dashPressed: boolean; // edge-triggered
}

/** Resets a level's mutable pickup state, so replaying starts fresh. */
export function resetLevel(level: Level) {
  for (const star of level.stars) star.collected = false;
}

export function createFox(level: Level): FoxState {
  return {
    x: level.startX, y: level.startY, w: 20, h: 16,
    vx: 0, vy: 0, grounded: false, facing: 1, swimming: false,
    dashCooldown: 0, dashTimeLeft: 0,
    powers: { light: false, wind: false, gravity: false, water: false },
    checkpoint: { x: level.startX, y: level.startY },
    respawns: 0, dead: false, finished: false, levelTime: 0,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidPlatforms(level: Level, fox: FoxState): Platform[] {
  return level.platforms.filter((p) => !p.hidden || fox.powers.light);
}

export function step(fox: FoxState, level: Level, input: FoxInput, dt: number) {
  if (fox.finished) return;
  fox.dead = false;
  fox.levelTime += dt;

  const gravity = fox.powers.gravity ? GRAVITY_BOOSTED : GRAVITY;
  const solids = solidPlatforms(level, fox);

  // Horizontal input & friction (skipped while a dash burst is still active)
  if (fox.dashTimeLeft > 0) {
    fox.dashTimeLeft = Math.max(0, fox.dashTimeLeft - dt);
  } else if (input.left && !input.right) {
    fox.vx -= MOVE_ACCEL * dt;
    fox.facing = -1;
  } else if (input.right && !input.left) {
    fox.vx += MOVE_ACCEL * dt;
    fox.facing = 1;
  } else {
    const sign = Math.sign(fox.vx);
    fox.vx -= sign * Math.min(Math.abs(fox.vx), FRICTION * dt);
  }
  if (fox.dashTimeLeft <= 0) {
    const maxSpeed = fox.swimming ? SWIM_SPEED : MOVE_MAX;
    fox.vx = Math.max(-maxSpeed, Math.min(maxSpeed, fox.vx));
  }

  // Jump
  if (input.jumpPressed && fox.grounded && !fox.swimming) {
    fox.vy = -JUMP_V;
    fox.grounded = false;
  }

  // Dash (Wind star): a brief horizontal-only burst, protected from the
  // normal speed clamp for its duration; vertical motion is untouched.
  fox.dashCooldown = Math.max(0, fox.dashCooldown - dt);
  if (input.dashPressed && fox.powers.wind && fox.dashCooldown <= 0) {
    fox.vx = fox.facing * DASH_VX;
    fox.dashTimeLeft = DASH_DURATION;
    fox.dashCooldown = DASH_COOLDOWN;
  }

  // Swimming: check whether the fox is inside a water hazard the player can swim through.
  const foxRect = () => ({ x: fox.x - fox.w / 2, y: fox.y - fox.h / 2, w: fox.w, h: fox.h });
  const inSwimmableWater = level.hazards.some(
    (h) => h.kind === "water" && fox.powers.water && rectsOverlap(foxRect(), hazardRectAt(h, fox.levelTime)),
  );
  fox.swimming = inSwimmableWater;

  // Vertical physics
  if (fox.swimming) {
    if (input.jumpPressed || input.dashPressed) fox.vy = -SWIM_SPEED * 0.7;
    else fox.vy += gravity * 0.15 * dt;
    fox.vy = Math.max(-SWIM_SPEED, Math.min(SWIM_SPEED, fox.vy));
  } else {
    fox.vy += gravity * dt;
  }

  // Move X, resolve collisions
  fox.x += fox.vx * dt;
  {
    const r = foxRect();
    for (const p of solids) {
      if (!rectsOverlap(r, p)) continue;
      if (fox.vx > 0) fox.x = p.x - fox.w / 2;
      else if (fox.vx < 0) fox.x = p.x + p.w + fox.w / 2;
      fox.vx = 0;
      r.x = fox.x - fox.w / 2;
    }
  }
  fox.x = Math.max(fox.w / 2, Math.min(level.width - fox.w / 2, fox.x));

  // Move Y, resolve collisions
  fox.grounded = false;
  fox.y += fox.vy * dt;
  {
    const r = foxRect();
    for (const p of solids) {
      if (!rectsOverlap(r, p)) continue;
      if (fox.vy > 0) {
        fox.y = p.y - fox.h / 2;
        fox.grounded = true;
      } else if (fox.vy < 0) {
        fox.y = p.y + p.h + fox.h / 2;
      }
      fox.vy = 0;
      r.y = fox.y - fox.h / 2;
    }
  }
  // Ground floor
  if (fox.y + fox.h / 2 > level.groundY) {
    fox.y = level.groundY - fox.h / 2;
    fox.vy = 0;
    fox.grounded = true;
  }

  // Hazards: spikes always kill; water only kills without the Water star.
  const r = foxRect();
  for (const h of level.hazards) {
    if (!rectsOverlap(r, hazardRectAt(h, fox.levelTime))) continue;
    if (h.kind === "spike" || (h.kind === "water" && !fox.powers.water)) {
      respawn(fox);
      return;
    }
  }

  // Fell off the bottom of the level
  if (fox.y > level.height + 40) {
    respawn(fox);
    return;
  }

  // Stars
  // Stars: an asymmetric catch zone. Vertical tolerance is generous because
  // jump-arc height varies a lot (and, in generated levels, so does platform
  // height); horizontal tolerance stays modest so it still means something
  // to be "near" the star.
  for (const star of level.stars) {
    if (star.collected) continue;
    const dx = Math.abs(fox.x - star.x);
    const dy = Math.abs(fox.y - star.y);
    if (dx < Math.max(star.r + 34, star.catchHalfW ?? 0) && dy < 170) {
      star.collected = true;
      fox.powers[star.id] = true;
    }
  }

  // Checkpoints: the most recent one the fox has passed, in level order.
  for (const cp of level.checkpoints) {
    if (fox.x >= cp.x && cp.x > fox.checkpoint.x) fox.checkpoint = cp;
  }

  // Goal: reaching the far edge of the level finishes it. This is checked
  // as "gone far enough right", not "standing on one exact point" — a fox
  // mid-jump when crossing that x would otherwise sail past a small target
  // without ever registering it.
  if (fox.x >= level.goal.x - 30) fox.finished = true;
}

function respawn(fox: FoxState) {
  fox.x = fox.checkpoint.x;
  fox.y = fox.checkpoint.y;
  fox.vx = 0;
  fox.vy = 0;
  fox.dead = true;
  fox.respawns++;
}
