import { makeRng } from "../../lib/rng";

export interface ObjectDef {
  id: string;
  label: string;
  mass: number;
  halfW: number;
  halfH: number;
  drag: number;
  shape: "rect" | "circle";
  color: string;
  detail: string;
}

export interface BalloonDef {
  id: string;
  label: string;
  lift: number;
  mass: number;
  color: string;
  detail: string;
}

export interface PlacedBalloon {
  id: number;
  type: string;
  /** Offset from the object's center of mass, in the object's own unrotated frame. */
  lx: number;
  ly: number;
}

export interface Body {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  omega: number;
}

export interface SimState {
  body: Body;
  objectId: string;
  balloons: PlacedBalloon[];
  grounded: boolean;
  launched: boolean;
  time: number;
  maxAltitude: number;
  maxTilt: number;
  crashed: boolean;
  holdTimer: number;
}

export const GROUND_Y = 0;
export const GRAVITY = 10; // world units / s^2

export function createSim(objectId: string, balloons: PlacedBalloon[]): SimState {
  return {
    body: { x: 0, y: GROUND_Y, angle: 0, vx: 0, vy: 0, omega: 0 },
    objectId,
    balloons,
    grounded: true,
    launched: false,
    time: 0,
    maxAltitude: 0,
    maxTilt: 0,
    crashed: false,
    holdTimer: 0,
  };
}

function rotate(lx: number, ly: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}

interface Environment {
  wind: number; // world units / s^2, applied as a horizontal force
  gravity: number;
}

/**
 * One physics step. Balloons apply lift at their attach point, which
 * contributes both a net upward force and (if off-center) a torque, so a
 * lopsided rig visibly tips instead of just rising straight up. The
 * simulation favors readable, fun behavior over strict realism.
 */
export function step(
  sim: SimState,
  dt: number,
  objects: Record<string, ObjectDef>,
  balloonDefs: Record<string, BalloonDef>,
  env: Environment,
  rand: () => number,
) {
  const obj = objects[sim.objectId];
  if (!obj || sim.crashed) return;

  let totalMass = obj.mass;
  for (const b of sim.balloons) totalMass += balloonDefs[b.type]?.mass ?? 0;

  let fx = 0;
  let fy = totalMass * env.gravity;
  let torque = 0;

  for (const b of sim.balloons) {
    const def = balloonDefs[b.type];
    if (!def) continue;
    const world = rotate(b.lx, b.ly, sim.body.angle);

    let liftForce = def.lift;
    if (b.type === "quantum") {
      liftForce *= 0.4 + rand() * 1.4;
    }
    let bfx = 0;
    const bfy = -liftForce;
    if (b.type === "rocket" && sim.time < 1.4) {
      bfx += 18 - sim.time * 11; // a decaying rightward push, good for crossing gaps
    }

    fx += bfx;
    fy += bfy;
    torque += world.x * bfy - world.y * bfx;
  }

  // Wind pushes on the whole body; drag opposes whatever it's currently doing.
  fx += env.wind * totalMass;
  const speed = Math.hypot(sim.body.vx, sim.body.vy);
  const dragK = obj.drag * (1 + speed * 0.01);
  fx -= sim.body.vx * dragK;
  fy -= sim.body.vy * dragK;
  torque -= sim.body.omega * (obj.halfW + obj.halfH) * 4;

  const inertia = totalMass * (obj.halfW * obj.halfW + obj.halfH * obj.halfH) * 0.5 + 4;
  const footprint = Math.max(obj.halfW, obj.halfH);
  const netUp = -fy; // positive means net upward force exceeds weight

  if (sim.grounded) {
    if (netUp > 1) {
      sim.grounded = false;
    } else {
      sim.body.vx *= 0.8;
      sim.body.vy = 0;
      sim.body.omega *= 0.7;
      sim.body.y = GROUND_Y;
      sim.time += dt;
      return;
    }
  }

  sim.body.vx += (fx / totalMass) * dt;
  sim.body.vy += (fy / totalMass) * dt;
  sim.body.omega += (torque / inertia) * dt;

  sim.body.x += sim.body.vx * dt;
  sim.body.y += sim.body.vy * dt;
  sim.body.angle += sim.body.omega * dt;

  if (sim.body.y > GROUND_Y - footprint * 0.4 && sim.body.vy > 0) {
    sim.body.y = GROUND_Y;
    sim.body.vy *= -0.15;
    sim.body.vx *= 0.6;
    sim.body.omega *= 0.5;
    sim.grounded = Math.abs(sim.body.vy) < 4;
  }

  const altitude = Math.max(0, GROUND_Y - sim.body.y);
  sim.maxAltitude = Math.max(sim.maxAltitude, altitude);
  sim.maxTilt = Math.max(sim.maxTilt, Math.abs(sim.body.angle));
  sim.time += dt;

  if (Math.abs(sim.body.x) > 900 || altitude > 4000) {
    sim.crashed = true;
  }
}

export interface ChallengeCondition {
  minAltitude: number;
  maxTiltDeg?: number;
  /** Must sustain the altitude/tilt requirements for this many continuous seconds, not just touch them once. */
  holdSeconds?: number;
  /** Must succeed within this many seconds of launch. */
  timeLimit?: number;
  /** A fixed crosswind applied for this challenge, independent of the sandbox wind control. */
  wind?: number;
}

export function checkChallenge(sim: SimState, cond: ChallengeCondition, dt: number): "flying" | "success" | "failed" {
  const altitude = Math.max(0, GROUND_Y - sim.body.y);
  const tiltDeg = (Math.abs(sim.body.angle) * 180) / Math.PI;
  if (cond.maxTiltDeg !== undefined && sim.maxTilt * (180 / Math.PI) > cond.maxTiltDeg) {
    return "failed";
  }
  const inState = altitude >= cond.minAltitude && tiltDeg <= (cond.maxTiltDeg ?? 999);
  if (cond.holdSeconds) {
    sim.holdTimer = inState ? sim.holdTimer + dt : 0;
    if (sim.holdTimer >= cond.holdSeconds) return "success";
  } else if (inState) {
    return "success";
  }
  if (cond.timeLimit !== undefined && sim.time > cond.timeLimit) return "failed";
  return "flying";
}

export function makeSeededRand(seed: number) {
  return makeRng(seed);
}
