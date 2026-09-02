export type PatternType = "rings" | "grid" | "spiral" | "stripes";

export interface SignalPuzzle {
  level: number;
  cols: number;
  rows: number;
  target: number;
  tolerance: number;
  patternType: PatternType;
  ringWidth: number;
  centerX: number;
  centerY: number;
  cellSize: number;
  spiralArms: number;
  stripeAngle: number;
}

// Proper bit-mixing hash — avoids the linear correlation a raw LCG gives
// when seeded with consecutive/linearly-increasing values (which made
// early levels' targets an almost-predictable arithmetic sequence).
function hash(a: number, b: number, c: number): number {
  let h = a * 374761393 + b * 668265263 + c * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h % 2147483647) + 2147483647) % 2147483647;
}

function hashFloat(a: number, b: number, c: number): number {
  return hash(a, b, c) / 2147483647;
}

const PATTERN_TYPES: PatternType[] = ["rings", "grid", "spiral", "stripes"];

export function generateSignalPuzzle(level: number): SignalPuzzle {
  const cols = 30;
  const rows = 18;
  const target = Math.round(hashFloat(level, 1, 55) * 1000) / 10;
  const tolerance = Math.max(8 - level * 0.35, 3.5);
  const patternType = PATTERN_TYPES[hash(level, 2, 77) % PATTERN_TYPES.length];
  const ringWidth = 1.0 + hashFloat(level, 3, 88) * 0.9;
  const centerX = cols * (0.3 + hashFloat(level, 4, 99) * 0.4);
  const centerY = rows * (0.3 + hashFloat(level, 5, 111) * 0.4);
  const cellSize = 1.6 + hashFloat(level, 6, 122) * 1.4;
  const spiralArms = 2 + Math.floor(hashFloat(level, 7, 133) * 3);
  const stripeAngle = hashFloat(level, 8, 144) * Math.PI;

  return {
    level,
    cols,
    rows,
    target,
    tolerance,
    patternType,
    ringWidth,
    centerX,
    centerY,
    cellSize,
    spiralArms,
    stripeAngle,
  };
}

/** True/false pattern bit for a given grid cell — shape depends on the puzzle's pattern type. */
export function patternBit(x: number, y: number, p: SignalPuzzle): boolean {
  const dx = (x - p.centerX) / 1.4;
  const dy = y - p.centerY;
  const dist = Math.hypot(dx, dy);

  switch (p.patternType) {
    case "rings":
      return Math.floor(dist / p.ringWidth) % 2 === 0;
    case "grid":
      return (Math.floor(x / p.cellSize) + Math.floor(y / p.cellSize)) % 2 === 0;
    case "spiral": {
      const angle = Math.atan2(dy, dx);
      const spiralValue = (angle / (Math.PI * 2)) * p.spiralArms + dist / p.ringWidth;
      return Math.floor(spiralValue) % 2 === 0;
    }
    case "stripes": {
      const rotated = x * Math.cos(p.stripeAngle) + y * Math.sin(p.stripeAngle);
      return Math.floor(rotated / p.cellSize) % 2 === 0;
    }
  }
}

export const signalFacts = [
  "SETI's search for extraterrestrial signals works on exactly this principle — sifting a real, structured pattern out of an ocean of ordinary cosmic noise, using math to tell the difference.",
  "Early radio operators tuned by ear alone — turning a dial through static until a voice or a Morse pattern became distinguishable from the noise around it.",
  "Old analog televisions resolved a picture from static through a similar process — a receiver locking onto a broadcast frequency precisely enough that noise gave way to a stable image.",
];
