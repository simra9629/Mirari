import { makeRng } from "../../lib/rng";

/** A few starting points, not a limit \u2014 the case can set any short phrase. */
export const SUGGESTED_PHRASES = [
  "MIRARI",
  "SMALL IDEA",
  "ONE WORLD",
  "STILL WONDER",
  "COMPLETE WONDER",
  "WORTH REMEMBER",
];

/**
 * A California job case doesn't hold just the letters of today's job — it
 * holds a whole alphabet, with more copies of common letters than rare
 * ones. This is that case: fixed compartments, fixed counts, the same
 * every page, exactly like a real one on a real composing frame. The
 * player finds each letter among the case rather than picking from an
 * already-curated handful — and can set any phrase the case can hold.
 */
export const CASE_COUNTS: { letter: string; count: number }[] = [
  { letter: "E", count: 10 },
  { letter: "T", count: 8 },
  { letter: "A", count: 8 },
  { letter: "O", count: 7 },
  { letter: "I", count: 7 },
  { letter: "N", count: 6 },
  { letter: "S", count: 6 },
  { letter: "R", count: 6 },
  { letter: "H", count: 5 },
  { letter: "L", count: 5 },
  { letter: "D", count: 4 },
  { letter: "C", count: 4 },
  { letter: "U", count: 4 },
  { letter: "M", count: 4 },
  { letter: "W", count: 3 },
  { letter: "F", count: 3 },
  { letter: "G", count: 3 },
  { letter: "Y", count: 3 },
  { letter: "P", count: 3 },
  { letter: "B", count: 3 },
  { letter: "V", count: 2 },
  { letter: "K", count: 2 },
  { letter: "J", count: 2 },
  { letter: "X", count: 2 },
  { letter: "Q", count: 2 },
  { letter: "Z", count: 2 },
];

export interface TypeTile {
  id: number;
  letter: string;
}

let nextId = 0;
export const CASE_TILES: TypeTile[] = CASE_COUNTS.flatMap(({ letter, count }) =>
  Array.from({ length: count }, () => ({ id: nextId++, letter })),
);

const CASE_MAX: Record<string, number> = Object.fromEntries(CASE_COUNTS.map((c) => [c.letter, c.count]));

export const MAX_PHRASE_LENGTH = 32;

/** Keeps free-typed input to what the case can actually set: A\u2013Z and spaces. */
export function sanitizePhrase(input: string): string {
  return input.toUpperCase().replace(/[^A-Z ]/g, "").slice(0, MAX_PHRASE_LENGTH);
}

/**
 * Checks the case actually has enough of every letter the phrase needs.
 * Real cases ran short on common sorts too \u2014 "out of sorts" comes from
 * exactly this problem in an actual print shop.
 */
export function checkCaseCapacity(phrase: string): { ok: boolean; shortLetter?: string } {
  const counts: Record<string, number> = {};
  for (const ch of phrase) {
    if (ch === " ") continue;
    counts[ch] = (counts[ch] ?? 0) + 1;
    if (counts[ch] > (CASE_MAX[ch] ?? 0)) return { ok: false, shortLetter: ch };
  }
  return { ok: true };
}

export interface PressPage {
  phrase: string;
  /** Small per-letter jitter, seeded from the phrase itself so it's stable but varies letter to letter. */
  jitter: Record<number, { rot: number; ink: number; base: number }>;
}

function hashPhrase(phrase: string): number {
  let h = 0;
  for (let i = 0; i < phrase.length; i++) h = (h * 31 + phrase.charCodeAt(i)) | 0;
  return h;
}

export function buildPage(phrase: string): PressPage {
  const rand = makeRng(hashPhrase(phrase) + 7);
  const jitter: PressPage["jitter"] = {};
  for (let i = 0; i < phrase.length; i++) {
    jitter[i] = {
      rot: (rand() - 0.5) * 7,
      ink: 0.72 + rand() * 0.3,
      base: (rand() - 0.5) * 3,
    };
  }
  return { phrase, jitter };
}
