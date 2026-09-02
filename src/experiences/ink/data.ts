export interface InkPuzzle {
  cols: number;
  rows: number;
  mask: boolean[][];
  dropBudget: number;
  revealRadius: number;
  shapeType: "blob" | "ring" | "zigzag";
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateBlobMask(cols: number, rows: number, rand: () => number, level: number): boolean[][] {
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const circleCount = Math.min(4 + Math.floor(level / 2), 9);
  // Individual circles shrink as level rises, so the whole shape gets harder to land on.
  const maxR = Math.max(1.1, 2.6 - level * 0.11);
  const minR = Math.max(0.7, 1.4 - level * 0.06);

  let cx = cols * (0.3 + rand() * 0.4);
  let cy = rows * (0.3 + rand() * 0.4);
  const circles: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < circleCount; i++) {
    const r = minR + rand() * (maxR - minR);
    circles.push({ x: cx, y: cy, r });
    const angle = rand() * Math.PI * 2;
    cx += Math.cos(angle) * r * 1.1;
    cy += Math.sin(angle) * r * 1.1;
    cx = Math.max(2, Math.min(cols - 2, cx));
    cy = Math.max(2, Math.min(rows - 2, cy));
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const circle of circles) {
        if (Math.hypot(c - circle.x, r - circle.y) <= circle.r) {
          mask[r][c] = true;
          break;
        }
      }
    }
  }
  return mask;
}

function generateRingMask(cols: number, rows: number, rand: () => number, level: number): boolean[][] {
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const cx = cols * (0.35 + rand() * 0.3);
  const cy = rows * (0.35 + rand() * 0.3);
  const outerR = Math.max(3.5, 7.5 - level * 0.3);
  const thickness = Math.max(1.0, 2.2 - level * 0.1);
  const innerR = Math.max(0.5, outerR - thickness);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.hypot(c - cx, r - cy);
      if (d <= outerR && d >= innerR) mask[r][c] = true;
    }
  }
  return mask;
}

function generateZigzagMask(cols: number, rows: number, rand: () => number, level: number): boolean[][] {
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const thickness = Math.max(0.9, 2.0 - level * 0.09);
  const segments = 4 + Math.min(Math.floor(level / 2), 4);

  const points: { x: number; y: number }[] = [];
  let x = cols * (0.15 + rand() * 0.15);
  let y = rows * (0.2 + rand() * 0.2);
  points.push({ x, y });
  for (let i = 0; i < segments; i++) {
    x += cols * (0.5 / segments) * (0.6 + rand() * 0.6);
    y += (rand() - 0.5) * rows * 0.5;
    x = Math.max(1, Math.min(cols - 1, x));
    y = Math.max(1, Math.min(rows - 1, y));
    points.push({ x, y });
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy || 1;
        let t = ((c - a.x) * dx + (r - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t * dx;
        const py = a.y + t * dy;
        if (Math.hypot(c - px, r - py) <= thickness) {
          mask[r][c] = true;
          break;
        }
      }
    }
  }
  return mask;
}

const SHAPE_TYPES: InkPuzzle["shapeType"][] = ["blob", "ring", "zigzag"];

export function generateInkPuzzle(level: number): InkPuzzle {
  const cols = 26;
  const rows = 22;
  const rand = makeRng(level * 9241 + 5);
  const shapeType = SHAPE_TYPES[(level - 1) % SHAPE_TYPES.length];

  const mask =
    shapeType === "blob"
      ? generateBlobMask(cols, rows, rand, level)
      : shapeType === "ring"
        ? generateRingMask(cols, rows, rand, level)
        : generateZigzagMask(cols, rows, rand, level);

  const dropBudget = Math.max(6, 11 - Math.floor(level / 3));
  // Drops shrink as levels rise — no more clearing the whole shape in one click.
  const revealRadius = Math.max(1.35, 2.7 - (level - 1) * 0.16);

  return { cols, rows, mask, dropBudget, revealRadius, shapeType };
}

export const inkFacts = [
  "Sgraffito, an old ceramic and fresco technique, works by the same idea in reverse — scratching away a top layer to reveal a different color hidden underneath.",
  "Invisible ink made from lemon juice or milk works because it's colorless until heated — the acid weakens the paper fibers just enough that they scorch first and darken before the rest of the page.",
  "Thermochromic ink, used in some novelty mugs and forms, is engineered to be one color cold and shift to another entirely once warmed — a hidden image with no scratching or heat gun required.",
];
