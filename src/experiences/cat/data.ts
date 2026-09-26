export type Mood = "napping" | "curious" | "playful" | "aloof";
export type Action = "call" | "toy" | "pet" | "point";

export interface Spot {
  id: string;
  x: number; // percentage
  y: number;
}

export const SPOTS: Record<string, Spot> = {
  box: { id: "box", x: 20, y: 68 },
  window: { id: "window", x: 78, y: 28 },
  couch: { id: "couch", x: 62, y: 62 },
  plant: { id: "plant", x: 15, y: 30 },
  you: { id: "you", x: 50, y: 90 },
};

export const ACTION_TARGET: Record<Action, string | null> = {
  call: "you",
  toy: null, // plays in place
  pet: null, // stays in place if it complies
  point: "box",
};

// Chance the cat complies, by [mood][action].
export const COMPLY: Record<Mood, Record<Action, number>> = {
  napping: { call: 0.08, toy: 0.05, pet: 0.15, point: 0.05 },
  curious: { call: 0.55, toy: 0.5, pet: 0.4, point: 0.6 },
  playful: { call: 0.45, toy: 0.85, pet: 0.35, point: 0.4 },
  aloof: { call: 0.15, toy: 0.2, pet: 0.1, point: 0.15 },
};

export const COMPLY_LINES: Record<Action, string[]> = {
  call: ["Actually comes. Miracles happen.", "Strolls over, unhurried, like it was already the plan."],
  toy: ["Full commitment. This is the most important thing in the world now.", "Pounces like this toy owes it money."],
  pet: ["Allows it. Briefly. Don't push your luck.", "Leans in. This is a good sign and should not be questioned."],
  point: ["Looks at the box. Then gets in the box.", "Investigates the box with great seriousness."],
};

export const IGNORE_LINES: Record<Action, string[]> = {
  call: ["Does not come. Continues existing elsewhere.", "Ears move. Nothing else does."],
  toy: ["Regards the toy with total indifference.", "Not interested. Was never going to be interested."],
  pet: ["Steps just out of reach. This is deliberate.", "Declines, without explanation."],
  point: ["Looks at the box. Looks at you. Does not move.", "Acknowledges the box exists. That's all you get."],
};

export const DEFIANT_LINES = [
  "Walks to the exact opposite side of the room instead.",
  "Knocks something off a nearby surface, maintaining eye contact.",
  "Suddenly very interested in a completely different, unrelated spot.",
  "Sits down precisely where it is standing. A statement.",
];

export const MOOD_LABEL: Record<Mood, string> = {
  napping: "napping",
  curious: "curious",
  playful: "playful",
  aloof: "aloof",
};

// Cats nap a lot. Weighted so autonomous mood changes lean that way.
export const MOOD_WEIGHTS: Record<Mood, number> = {
  napping: 2.2,
  curious: 1,
  playful: 1,
  aloof: 1.1,
};

// If it fits, it sits — the box is disproportionately popular as a
// destination when the cat wanders on its own.
export const WANDER_WEIGHTS: Record<string, number> = {
  box: 2.4,
  window: 1,
  couch: 1,
  plant: 0.8,
};

export function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}
