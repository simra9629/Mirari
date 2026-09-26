export const MORSE_MAP: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};

export function toMorse(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => {
      if (ch === " ") return "/";
      return MORSE_MAP[ch] ?? "";
    })
    .filter((code) => code !== "")
    .join(" ");
}

export interface MorseSymbol {
  kind: "dot" | "dash" | "gap" | "letterGap" | "wordGap";
  duration: number;
}

const UNIT = 140;

/** Flattens a morse string into a timed sequence of on/off symbols for playback. */
export function morseSchedule(morse: string): MorseSymbol[] {
  const symbols: MorseSymbol[] = [];
  const letters = morse.split(" ");
  letters.forEach((letter, li) => {
    if (letter === "/") {
      symbols.push({ kind: "wordGap", duration: UNIT * 7 });
      return;
    }
    letter.split("").forEach((mark, mi) => {
      symbols.push({ kind: mark === "." ? "dot" : "dash", duration: mark === "." ? UNIT : UNIT * 3 });
      if (mi < letter.length - 1) symbols.push({ kind: "gap", duration: UNIT });
    });
    if (li < letters.length - 1 && letters[li + 1] !== "/") {
      symbols.push({ kind: "letterGap", duration: UNIT * 3 });
    }
  });
  return symbols;
}

// A generated symbol cipher: every letter becomes a small frame (some
// combination of the four sides of a box) plus an optional center dot.
// Not a historical cipher — an invented one, in the spirit of Mirari's
// other fictionalized mechanisms — but built the same principled way:
// a small set of visual rules producing 26 unambiguous symbols.
export type Side = "top" | "right" | "bottom" | "left";
const ALL_SIDES: Side[] = ["top", "right", "bottom", "left"];

export interface GlyphShape {
  sides: Side[];
  dot: boolean;
}

function combinations(size: number): Side[][] {
  const results: Side[][] = [];
  function helper(start: number, combo: Side[]) {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < ALL_SIDES.length; i++) {
      combo.push(ALL_SIDES[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

function buildGlyphs(): GlyphShape[] {
  const shapes: GlyphShape[] = [];
  for (const size of [1, 2, 3, 4]) {
    for (const sides of combinations(size)) {
      for (const dot of [false, true]) {
        shapes.push({ sides, dot });
      }
    }
  }
  return shapes.slice(0, 26);
}

/** Index 0 = A, 1 = B, ... 25 = Z. */
export const GLYPHS = buildGlyphs();

export function textToGlyphs(text: string): (GlyphShape | null)[] {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => {
      const idx = ch.charCodeAt(0) - 65;
      if (idx < 0 || idx > 25) return null; // spaces and punctuation render as a gap
      return GLYPHS[idx];
    });
}
