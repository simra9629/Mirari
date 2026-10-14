import type { ObjectDef, BalloonDef, ChallengeCondition } from "./engine";

export const OBJECTS: ObjectDef[] = [
  { id: "paper", label: "A sheet of paper", mass: 0.8, halfW: 10, halfH: 7, drag: 0.6, shape: "rect", color: "#f0ede0", detail: "Barely there. Catches the slightest breeze." },
  { id: "leaf", label: "A leaf", mass: 0.5, halfW: 9, halfH: 6, drag: 0.5, shape: "rect", color: "#7fae6a", detail: "Lighter than the paper, if you can believe it." },
  { id: "spoon", label: "A spoon", mass: 1.8, halfW: 4, halfH: 12, drag: 0.2, shape: "rect", color: "#b9c0c6", detail: "Small, dense, not built for flight." },
  { id: "cup", label: "A teacup", mass: 2.8, halfW: 10, halfH: 9, drag: 0.3, shape: "circle", color: "#e6b968", detail: "Try not to spill it. There's nothing in it, but still." },
  { id: "toy-car", label: "A toy car", mass: 4, halfW: 16, halfH: 8, drag: 0.4, shape: "rect", color: "#e64d4d", detail: "Surprisingly aerodynamic for something with wheels." },
  { id: "backpack", label: "A backpack", mass: 6, halfW: 14, halfH: 17, drag: 0.5, shape: "rect", color: "#4e6e91", detail: "Heavier than it looks. Someone left books in it." },
  { id: "bicycle", label: "A bicycle", mass: 9, halfW: 26, halfH: 18, drag: 0.7, shape: "rect", color: "#355a85", detail: "All that empty space between the wheels still catches wind." },
  { id: "sofa", label: "A sofa", mass: 14, halfW: 32, halfH: 16, drag: 0.9, shape: "rect", color: "#9b6fd6", detail: "It must remain, structurally and spiritually, a sofa." },
  { id: "piano", label: "An upright piano", mass: 19, halfW: 22, halfH: 26, drag: 0.6, shape: "rect", color: "#1c1c1c", detail: "This is, by any reasonable measure, a bad idea." },
  { id: "small-house", label: "A small house", mass: 26, halfW: 40, halfH: 34, drag: 1.1, shape: "rect", color: "#c96c55", detail: "It has a chimney. The chimney is judging you." },
  { id: "sand-grain", label: "A suspiciously large grain of sand", mass: 30, halfW: 6, halfH: 6, drag: 0.15, shape: "circle", color: "#d5c48a", detail: "It should not weigh this much. Nobody knows why." },
];

export const BALLOON_TYPES: BalloonDef[] = [
  { id: "standard", label: "Standard", lift: 14, mass: 0.3, color: "#e64d4d", detail: "Reliable. Unremarkable. Does what it says." },
  { id: "heavy", label: "Heavy", lift: 11, mass: 0.5, color: "#4e6e91", detail: "Weaker lift, but its weight helps steady a lopsided rig." },
  { id: "helium", label: "Helium", lift: 22, mass: 0.15, color: "#f2c14e", detail: "Strong lift, barely adds any weight of its own." },
  { id: "rocket", label: "Rocket", lift: 14, mass: 0.3, color: "#ff7e72", detail: "A short, decaying burst of sideways thrust on launch." },
  { id: "quantum", label: "Quantum", lift: 14, mass: 0.3, color: "#9b6fd6", detail: "Nobody knows why it works. Its lift changes every instant." },
];

export const OBJECT_BY_ID: Record<string, ObjectDef> = Object.fromEntries(OBJECTS.map((o) => [o.id, o]));
export const BALLOON_BY_ID: Record<string, BalloonDef> = Object.fromEntries(BALLOON_TYPES.map((b) => [b.id, b]));

export interface Challenge {
  id: string;
  objectId: string;
  title: string;
  detail: string;
  condition: ChallengeCondition;
  unlocksObject?: string;
  unlocksBalloon?: string;
}

export const CHALLENGES: Challenge[] = [
  { id: "c1", objectId: "paper", title: "Get it off the ground", detail: "Just lift the paper clear of the ground.", condition: { minAltitude: 30 }, unlocksObject: "leaf" },
  { id: "c2", objectId: "leaf", title: "Clear the rooftops", detail: "A little higher this time.", condition: { minAltitude: 70 }, unlocksObject: "spoon", unlocksBalloon: "helium" },
  { id: "c3", objectId: "spoon", title: "Straight up", detail: "Keep it from tipping past 20 degrees.", condition: { minAltitude: 60, maxTiltDeg: 20 }, unlocksObject: "cup" },
  { id: "c4", objectId: "cup", title: "Don't spill it", detail: "Higher still, and no more than 15 degrees of tilt.", condition: { minAltitude: 90, maxTiltDeg: 15 }, unlocksObject: "toy-car" },
  { id: "c5", objectId: "toy-car", title: "Reach cruising height", detail: "Get it well above the ground.", condition: { minAltitude: 150 }, unlocksObject: "backpack", unlocksBalloon: "rocket" },
  { id: "c6", objectId: "backpack", title: "Heavier than it looks", detail: "Someone left books in it. Lift it anyway.", condition: { minAltitude: 110 }, unlocksObject: "bicycle" },
  { id: "c7", objectId: "bicycle", title: "Get the bike airborne", detail: "Wheels and all. Keep it under 35 degrees of tilt.", condition: { minAltitude: 130, maxTiltDeg: 35 }, unlocksObject: "sofa" },
  { id: "c8", objectId: "sofa", title: "It must remain a sofa", detail: "Rise, but stay under 25 degrees — a sofa has dignity.", condition: { minAltitude: 100, maxTiltDeg: 25 }, unlocksObject: "piano", unlocksBalloon: "quantum" },
  { id: "c9", objectId: "piano", title: "Lift the piano. Good luck.", detail: "It is exactly as heavy as it looks.", condition: { minAltitude: 90 }, unlocksObject: "small-house" },
  { id: "c10", objectId: "small-house", title: "This should not be possible", detail: "And yet. Get the house off the ground.", condition: { minAltitude: 70 }, unlocksObject: "sand-grain" },
  { id: "c11", objectId: "sand-grain", title: "It's heavier than it looks", detail: "Much, much heavier. Nobody knows why.", condition: { minAltitude: 40 }, },
  { id: "c12", objectId: "paper", title: "Steady in a breeze", detail: "A crosswind is blowing. Keep it under 30 degrees of tilt.", condition: { minAltitude: 40, maxTiltDeg: 30, wind: 12 } },
  { id: "c13", objectId: "cup", title: "Hold it there", detail: "Reach the height, and stay there a couple of seconds — no dipping.", condition: { minAltitude: 70, holdSeconds: 2 } },
  { id: "c14", objectId: "toy-car", title: "Quick liftoff", detail: "Get it up there before the seven seconds run out.", condition: { minAltitude: 100, timeLimit: 7 } },
  { id: "c15", objectId: "backpack", title: "Against the wind", detail: "A steady headwind the whole way up.", condition: { minAltitude: 90, wind: 16 } },
  { id: "c16", objectId: "bicycle", title: "Steady climb", detail: "Under 20 degrees of tilt, and hold it there for a second and a half.", condition: { minAltitude: 130, maxTiltDeg: 20, holdSeconds: 1.5 } },
  { id: "c17", objectId: "sofa", title: "Windy afternoon", detail: "Wind, and only twenty seconds to work with.", condition: { minAltitude: 90, wind: 14, timeLimit: 20 } },
  { id: "c18", objectId: "piano", title: "No time to waste", detail: "Twelve seconds. That's it.", condition: { minAltitude: 80, timeLimit: 12 } },
  { id: "c19", objectId: "small-house", title: "A gust of bad luck", detail: "As if this wasn't hard enough already.", condition: { minAltitude: 60, wind: 18 } },
  { id: "c20", objectId: "sand-grain", title: "The final straw", detail: "Hold it for two seconds. Fifteen seconds on the clock.", condition: { minAltitude: 35, holdSeconds: 2, timeLimit: 15 } },
];

/** Sandbox unlocks partway through, once the player has a feel for the physics. */
export const SANDBOX_UNLOCK_CHALLENGE = "c4";

const STORAGE_KEY = "mirari-up-progress";

export interface Progress {
  completed: string[];
  unlockedObjects: string[];
  unlockedBalloons: string[];
}

function defaultProgress(): Progress {
  return {
    completed: [],
    unlockedObjects: ["paper"],
    unlockedBalloons: ["standard", "heavy"],
  };
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    const base = defaultProgress();
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : base.completed,
      unlockedObjects: Array.isArray(parsed.unlockedObjects) ? parsed.unlockedObjects : base.unlockedObjects,
      unlockedBalloons: Array.isArray(parsed.unlockedBalloons) ? parsed.unlockedBalloons : base.unlockedBalloons,
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
    // best-effort; a full or unavailable localStorage just means progress doesn't persist
  }
}

export function completeChallenge(progress: Progress, challenge: Challenge): Progress {
  if (progress.completed.includes(challenge.id)) return progress;
  const next: Progress = {
    completed: [...progress.completed, challenge.id],
    unlockedObjects: challenge.unlocksObject && !progress.unlockedObjects.includes(challenge.unlocksObject)
      ? [...progress.unlockedObjects, challenge.unlocksObject]
      : progress.unlockedObjects,
    unlockedBalloons: challenge.unlocksBalloon && !progress.unlockedBalloons.includes(challenge.unlocksBalloon)
      ? [...progress.unlockedBalloons, challenge.unlocksBalloon]
      : progress.unlockedBalloons,
  };
  return next;
}
