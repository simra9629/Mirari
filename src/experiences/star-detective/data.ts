import { makeRng } from "../../lib/rng";
export interface StarColor {
  name: string;
  hex: string;
  tempDesc: string;
}

export const COLORS: StarColor[] = [
  { name: "blue-white", hex: "#bcd4ff", tempDesc: "one of the hottest stars there is" },
  { name: "white", hex: "#f2f4ff", tempDesc: "hot, but not the hottest" },
  { name: "yellow", hex: "#ffe29a", tempDesc: "a middling temperature, much like the Sun" },
  { name: "orange", hex: "#ffb46b", tempDesc: "cooler than average" },
  { name: "red", hex: "#ff8a72", tempDesc: "one of the coolest stars there is" },
];

export interface MotionType {
  name: string;
  desc: string;
  pulseSeconds: number;
}

export const MOTIONS: MotionType[] = [
  { name: "steady", desc: "barely seems to move at all", pulseSeconds: 3.6 },
  { name: "drifting", desc: "drifts at a moderate pace", pulseSeconds: 2.0 },
  { name: "restless", desc: "has a noticeably fast, restless motion", pulseSeconds: 0.9 },
];

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

export interface StarCandidate {
  id: number;
  colorIndex: number;
  motionIndex: number;
  brightness: number; // unique across the whole field
}

export interface DetectiveCase {
  stars: StarCandidate[];
  targetOrder: number[]; // ids, in the order they must be found
  cluesByTarget: Record<number, string[]>;
}

// Scrambles the seed before it enters the LCG below. A plain LCG's very
// first output is a smooth function of the seed, so sequential seeds
// (level * k + c) would otherwise produce long runs of near-identical
// early results — this hash breaks that up.

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function brightnessClue(candidates: StarCandidate[], target: StarCandidate): string {
  const sorted = [...candidates].sort((a, b) => a.brightness - b.brightness);
  const rank = sorted.findIndex((s) => s.id === target.id);
  if (rank === sorted.length - 1) return "Among those, it's the brightest.";
  if (rank === 0) return "Among those, it's the dimmest.";
  const brightRank = sorted.length - 1 - rank;
  return `Among those, it's the ${ORDINALS[brightRank]}-brightest of ${sorted.length}.`;
}

function buildClues(target: StarCandidate, pool: StarCandidate[]): string[] {
  const clues: string[] = [];
  const color = COLORS[target.colorIndex];
  clues.push(`It's ${color.name} — ${color.tempDesc}.`);
  let candidates = pool.filter((s) => s.colorIndex === target.colorIndex);

  if (candidates.length > 1) {
    const motion = MOTIONS[target.motionIndex];
    clues.push(`It ${motion.desc}.`);
    const narrowed = candidates.filter((s) => s.motionIndex === target.motionIndex);
    if (narrowed.length > 0) candidates = narrowed;
  }

  if (candidates.length > 1) {
    clues.push(brightnessClue(candidates, target));
  }

  return clues;
}

function fieldSizeForLevel(level: number): number {
  return Math.min(24, 9 + (level - 1) * 3);
}

function targetsForLevel(level: number): number {
  if (level < 3) return 1;
  if (level < 6) return 2;
  return 3;
}

export function generateCase(level: number): DetectiveCase {
  const rand = makeRng(level * 6113 + 29);
  const size = fieldSizeForLevel(level);
  const brightnessValues = shuffle(
    Array.from({ length: size }, (_, i) => i + 1),
    rand,
  );

  const stars: StarCandidate[] = Array.from({ length: size }, (_, i) => ({
    id: i,
    colorIndex: Math.floor(rand() * COLORS.length),
    motionIndex: Math.floor(rand() * MOTIONS.length),
    brightness: brightnessValues[i],
  }));

  const numTargets = Math.min(targetsForLevel(level), size);
  const targetOrder = shuffle(stars.map((s) => s.id), rand).slice(0, numTargets);

  const cluesByTarget: Record<number, string[]> = {};
  let remainingPool = [...stars];
  for (const id of targetOrder) {
    const target = stars.find((s) => s.id === id)!;
    cluesByTarget[id] = buildClues(target, remainingPool);
    remainingPool = remainingPool.filter((s) => s.id !== id);
  }

  return { stars, targetOrder, cluesByTarget };
}
