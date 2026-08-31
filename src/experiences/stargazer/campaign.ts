import { constellations } from "./constellations";

export type LevelKind = "find" | "planet";

export interface LevelInstance {
  levelNumber: number;
  kind: LevelKind;
  constellationIds: string[];
  fieldScale: number;
  distractorCount: number;
  prompt: string;
}

// Small seeded RNG — deterministic, so the same level always generates
// the same content, but nothing here is hand-picked per level.
function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffled<T>(arr: T[], seed: number): T[] {
  const rand = makeRng(seed);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const PLANET_INTERVAL = 5; // every 5th level is a "spot the planet" round

const singlePrompts = [
  "A quiet corner of sky. Find {name}.",
  "Just one shape hides here — find {name}.",
  "Look closely. Somewhere in this patch of sky: {name}.",
];

const multiPrompts = [
  "{count} constellations share this stretch of sky. Find them all.",
  "A wider view this time — {count} shapes are hiding in it.",
  "Somewhere in here: {count} constellations. Find every one.",
];

const fullSkyPrompts = [
  "The whole sky, at once. Find all {count}.",
  "Nothing is cropped anymore — {count} constellations, somewhere in all of it.",
];

const planetPrompts = [
  "One of these lights doesn't twinkle. Find the planet.",
  "A busier sky this time. Somewhere in it — a planet.",
  "Stars flicker. Planets don't. Find the one that's steady.",
];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

/**
 * Generates the parameters for any level, on demand. The campaign has
 * no fixed length — call this with any level number and it keeps
 * producing content: small single-constellation fields early on,
 * wide multi-constellation skies later.
 */
export function getLevel(levelNumber: number): LevelInstance {
  if (levelNumber % PLANET_INTERVAL === 0) {
    const distractorCount = Math.min(12 + levelNumber, 30);
    return {
      levelNumber,
      kind: "planet",
      constellationIds: [],
      fieldScale: Math.min(0.55 + levelNumber * 0.02, 1),
      distractorCount,
      prompt: pick(planetPrompts, Math.floor(levelNumber / PLANET_INTERVAL)),
    };
  }

  const numConstellations = Math.max(
    1,
    Math.min(1 + Math.floor((levelNumber - 1) / 3), constellations.length, 4),
  );
  const fieldScale = Math.min(0.42 + levelNumber * 0.035, 1);
  const distractorCount = Math.min(6 + Math.round(levelNumber * 1.6), 30);

  const pool = shuffled(constellations, levelNumber * 911 + 7).slice(0, numConstellations);
  const constellationIds = pool.map((c) => c.id);

  let prompt: string;
  if (numConstellations === 1) {
    prompt = pick(singlePrompts, levelNumber).replace("{name}", pool[0].name);
  } else if (fieldScale >= 0.95) {
    prompt = pick(fullSkyPrompts, levelNumber).replace("{count}", String(numConstellations));
  } else {
    prompt = pick(multiPrompts, levelNumber).replace("{count}", String(numConstellations));
  }

  return { levelNumber, kind: "find", constellationIds, fieldScale, distractorCount, prompt };
}
