import { makeRng } from "../../lib/rng";

export type ClueKind =
  | "coastline"
  | "mountain"
  | "lake"
  | "river"
  | "forest"
  | "hills"
  | "settlement"
  | "second-settlement"
  | "unknown";

export interface Clue {
  kind: ClueKind;
  text: string;
  manual: boolean;
}

export interface Region {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type Side = "west" | "east";
export type SettlementTarget = "mouth" | "upriver";
export type CoastDir = "north" | "south";

export interface Expedition {
  clues: Clue[];
  coastlineRange: [number, number];
  mountainRegion: Region;
  hillsRegion: Region;
  forestSide: Side;
  settlementTarget: SettlementTarget;
  secondSettlementDir: CoastDir;
}

const MOUNTAIN_QUADRANTS: { region: Region; word: string }[] = [
  { region: { minX: 8, maxX: 32, minY: 8, maxY: 26 }, word: "the northwest" },
  { region: { minX: 20, maxX: 46, minY: 6, maxY: 22 }, word: "the north" },
  { region: { minX: 12, maxX: 38, minY: 16, maxY: 34 }, word: "the northwest, further inland" },
];

const HILLS_QUADRANTS: { region: Region; word: string }[] = [
  { region: { minX: 20, maxX: 45, minY: 55, maxY: 74 }, word: "the south" },
  { region: { minX: 10, maxX: 34, minY: 45, maxY: 62 }, word: "the southwest" },
  { region: { minX: 30, maxX: 55, minY: 60, maxY: 78 }, word: "the south, toward the coast" },
];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Builds one expedition's set of reports and the (hidden, generated)
 * regions and rules the player's placements are checked against. Difficulty
 * — feature count and the specificity of what's required — rises with the
 * expedition number; the exact regions, directions, and which optional
 * features appear are re-rolled from the seed each time, so no two
 * expeditions read or play quite the same.
 */
export function generateExpedition(expeditionNumber: number): Expedition {
  const rand = makeRng(expeditionNumber * 104729 + 7919);

  const coastlineRange: [number, number] = [58, 90];
  const mountain = pick(rand, MOUNTAIN_QUADRANTS);
  const hills = pick(rand, HILLS_QUADRANTS);
  const forestSide: Side = rand() < 0.5 ? "west" : "east";
  const settlementTarget: SettlementTarget = rand() < 0.6 ? "mouth" : "upriver";
  const secondSettlementDir: CoastDir = rand() < 0.5 ? "north" : "south";

  // How many optional features this expedition adds on top of the five
  // always present. Caps out once the map is already fairly busy.
  const extraBudget = Math.min(3, Math.max(0, expeditionNumber - 1));
  const pool: ClueKind[] = ["lake", "hills", "second-settlement"];
  // Shuffle the pool, then take the first `extraBudget` of it.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const extras = new Set(pool.slice(0, extraBudget));

  const clues: Clue[] = [
    { kind: "coastline", text: "The coast lies to the east. Beyond it, the sea.", manual: true },
    { kind: "mountain", text: `Mountains rise somewhere in ${mountain.word}.`, manual: true },
  ];

  if (extras.has("lake")) {
    clues.push({
      kind: "lake",
      text: "A lake sits in the foothills below the mountains, feeding the river.",
      manual: true,
    });
  }

  clues.push({
    kind: "river",
    text: "A river runs from the mountains down to the sea. Trace its course.",
    manual: true,
  });

  clues.push({
    kind: "forest",
    text: `Forest grows along the river's ${forestSide === "west" ? "western" : "eastern"} bank.`,
    manual: true,
  });

  if (extras.has("hills")) {
    clues.push({
      kind: "hills",
      text: `Low hills rise to ${hills.word}.`,
      manual: true,
    });
  }

  clues.push({
    kind: "settlement",
    text:
      settlementTarget === "mouth"
        ? "A settlement stands where the river meets the sea."
        : "A settlement stands some way upriver, sheltered from the coast's storms.",
    manual: true,
  });

  if (extras.has("second-settlement")) {
    clues.push({
      kind: "second-settlement",
      text: `A second settlement lies along the coast, a fair distance to the ${secondSettlementDir}.`,
      manual: true,
    });
  }

  clues.push({
    kind: "unknown",
    text: "Beyond what's mapped, sailors say there's more. No one has confirmed it.",
    manual: false,
  });

  return { clues, coastlineRange, mountainRegion: mountain.region, hillsRegion: hills.region, forestSide, settlementTarget, secondSettlementDir };
}
