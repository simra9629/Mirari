export interface Gear {
  id: string;
  teeth: number;
  step: number;
  target: number;
}

export interface Puzzle {
  level: number;
  gears: Gear[];
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Every gear in the train is driven by the same shared control, at its own
 * fixed ratio (`step` teeth per turn). The puzzle is finding a turn count
 * where every gear's position lands on its own target at once — you can't
 * set any gear individually, unlike a pin or lever.
 */
export function generatePuzzle(level: number): Puzzle {
  const tier = Math.floor((level - 1) / 1) + 1;
  const rand = makeRng(level * 5303 + 17);
  const numGears = Math.min(2 + Math.floor((level - 1) / 2), 5);
  const solutionK = 2 + Math.floor(rand() * (5 + tier));

  const gears: Gear[] = Array.from({ length: numGears }, (_, i) => {
    const teeth = 5 + Math.floor(rand() * 5) + Math.min(Math.floor(tier / 2), 3);
    const step = 1 + Math.floor(rand() * (teeth - 1));
    const target = (solutionK * step) % teeth;
    return { id: `g${i + 1}`, teeth, step, target };
  });

  return { level, gears };
}

export const clockmakerFact =
  "Real gear trains work the same way — one driving gear turns every other gear in the chain at once, each at a ratio fixed by its tooth count. Clockmakers spent centuries choosing tooth counts precisely enough that an hour hand and minute hand would agree, turn after turn, for years.";
