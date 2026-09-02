export interface Layer {
  panelId: number;
  faceUp: boolean;
}

export type Stack = Layer[]; // index 0 = top
export type Row = Stack[]; // left to right

export interface FoldPuzzle {
  level: number;
  panelCount: number;
  steps: number;
  initialRow: Row;
  target: { panelId: number; faceUp: boolean };
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function initRow(n: number): Row {
  return Array.from({ length: n }, (_, i) => [{ panelId: i, faceUp: true }]);
}

export function foldLeftOverRight(row: Row): Row {
  const half = row.length / 2;
  const left = row.slice(0, half);
  const right = row.slice(half);
  const leftRev = [...left]
    .reverse()
    .map((stack) => [...stack].reverse().map((l) => ({ ...l, faceUp: !l.faceUp })));
  return right.map((rstack, i) => [...leftRev[i], ...rstack]);
}

export function foldRightOverLeft(row: Row): Row {
  const half = row.length / 2;
  const left = row.slice(0, half);
  const right = row.slice(half);
  const rightRev = [...right]
    .reverse()
    .map((stack) => [...stack].reverse().map((l) => ({ ...l, faceUp: !l.faceUp })));
  return left.map((lstack, i) => [...rightRev[i], ...lstack]);
}

/**
 * Generates a puzzle by brute-force enumerating every possible sequence of
 * fold directions, so the chosen target is always guaranteed achievable.
 */
export function generateFoldPuzzle(level: number): FoldPuzzle {
  const panelCount = level % 2 === 1 ? 4 : 8;
  const steps = Math.log2(panelCount);
  const rand = makeRng(level * 6151 + 41);

  const outcomes: { panelId: number; faceUp: boolean }[] = [];
  const combos = 1 << steps;
  for (let mask = 0; mask < combos; mask++) {
    let row = initRow(panelCount);
    for (let s = 0; s < steps; s++) {
      const leftOverRight = ((mask >> s) & 1) === 0;
      row = leftOverRight ? foldLeftOverRight(row) : foldRightOverLeft(row);
    }
    outcomes.push(row[0][0]);
  }

  const target = outcomes[Math.floor(rand() * outcomes.length)];

  return { level, panelCount, steps, initialRow: initRow(panelCount), target };
}

export const foldFact =
  "Strip and map folding are real, still only partly solved, branches of mathematics — nobody knows a general formula for how many distinct ways there are to fold a map with more than about 20 panels.";
