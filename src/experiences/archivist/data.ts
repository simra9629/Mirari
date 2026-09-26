export type RuleAttribute = "color" | "shape" | "size";

export interface Artifact {
  id: string;
  colorId: number;
  shapeId: number;
  sizeId: number; // index into SIZES; irrelevant unless size is the level's real rule
  category: number; // the value that actually determines a match
}

export interface ArchivistLevel {
  artifacts: Artifact[];
  labels: string[]; // one label per category, revealed once a pair is classified
  ruleAttribute: RuleAttribute; // which visible trait is the real rule (never shown to the player)
  numTraits: 2 | 3;
}

// Every artifact shows visible traits — a colour, a symbol, and (from
// level 3 onward) a size. Only one of them actually determines whether
// two artifacts match; the rest are independently-random decoys.
// Nothing on screen says which is which — the player has to notice
// that pairs sharing (say) a colour keep matching, while pairs only
// sharing a symbol don't, and reason from there. That's the puzzle.
export const PALETTE = [
  "#c8a968", "#6f8fae", "#b06a5a", "#7fae7a",
  "#9a7fc9", "#d68e5a", "#6fae9a", "#c96a8a",
];

export const SHAPES = ["☉", "☽", "☿", "♀", "♂", "♃", "♄", "♆"];

export const SIZES = [0.62, 0.68, 0.76, 0.84, 0.92, 1, 1.08, 1.16];

const LABEL_POOL = [
  "Ceremonial vessels from the same coastal kiln",
  "Trade tokens, all minted the same year",
  "Fragments of a single dismantled instrument",
  "Woven textiles, dyed in one workshop",
  "Bone tools shaped for the same unknown task",
  "Grave goods from a single burial site",
  "Fittings from one collapsed structure",
  "Offerings left at the same shrine",
  "Pieces of a broken navigational set",
  "Objects passed down through one family line",
  "Remnants of a single shipwreck's cargo",
  "Tools bearing the same maker's mark",
];

// Scrambles the seed before it enters the LCG below. A plain LCG's very
// first output is a smooth function of the seed, so sequential seeds
// (level * k + c) would otherwise produce long runs of near-identical
// early results — this hash breaks that up.
function hashSeed(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  x ^= x >>> 16;
  return x >>> 0;
}

function makeRng(seed: number) {
  let s = hashSeed(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateLevel(level: number): ArchivistLevel {
  const rand = makeRng(level * 7727 + 11);
  const numCategories = Math.min(PALETTE.length, 3 + Math.floor((level - 1) / 1));
  const numTraits: 2 | 3 = level < 3 ? 2 : 3;
  const attributePool: RuleAttribute[] = numTraits === 3 ? ["color", "shape", "size"] : ["color", "shape"];
  const ruleAttribute = attributePool[Math.floor(rand() * attributePool.length)];
  const labelPool = shuffle(LABEL_POOL, rand);

  const artifacts: Artifact[] = [];
  for (let cat = 0; cat < numCategories; cat++) {
    for (let member = 0; member < 2; member++) {
      const decoyColor = Math.floor(rand() * numCategories);
      const decoyShape = Math.floor(rand() * numCategories);
      const decoySize = Math.floor(rand() * SIZES.length);
      artifacts.push({
        id: `${level}-${cat}-${member}`,
        colorId: ruleAttribute === "color" ? cat : decoyColor,
        shapeId: ruleAttribute === "shape" ? cat : decoyShape,
        sizeId: numTraits === 3 ? (ruleAttribute === "size" ? cat : decoySize) : 5,
        category: cat,
      });
    }
  }

  return {
    artifacts: shuffle(artifacts, rand),
    labels: labelPool.slice(0, numCategories),
    ruleAttribute,
    numTraits,
  };
}
