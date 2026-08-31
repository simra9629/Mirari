export interface DeliveryGrid {
  cols: number;
  rows: number;
  blocked: boolean[][];
  start: { row: number; col: number };
  pickup: { row: number; col: number };
  dropoff: { row: number; col: number };
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function bfsReachable(
  blocked: boolean[][],
  cols: number,
  rows: number,
  from: { row: number; col: number },
): boolean[][] {
  const seen: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  seen[from.row][from.col] = true;
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      const r = cur.row + dr;
      const c = cur.col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols && !blocked[r][c] && !seen[r][c]) {
        seen[r][c] = true;
        queue.push({ row: r, col: c });
      }
    }
  }
  return seen;
}

export function generateDeliveryGrid(level: number): DeliveryGrid {
  const cols = Math.min(6 + Math.floor(level / 2), 10);
  const rows = cols;
  const density = Math.min(0.18 + level * 0.01, 0.3);
  const start = { row: 0, col: 0 };

  for (let attempt = 0; attempt < 60; attempt++) {
    const rand = makeRng(level * 7351 + attempt * 104729 + 3);
    const blocked: boolean[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => rand() < density),
    );
    blocked[start.row][start.col] = false;

    const reachable = bfsReachable(blocked, cols, rows, start);
    const candidates: { row: number; col: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (reachable[r][c] && (r !== start.row || c !== start.col)) candidates.push({ row: r, col: c });
      }
    }
    if (candidates.length < 4) continue;

    const far = candidates
      .map((p) => ({ p, d: Math.abs(p.row - start.row) + Math.abs(p.col - start.col) }))
      .sort((a, b) => b.d - a.d);

    const pickup = far[Math.floor(rand() * Math.min(3, far.length))].p;
    const remaining = far.filter((f) => f.p.row !== pickup.row || f.p.col !== pickup.col);
    if (remaining.length === 0) continue;
    const dropoff = remaining[Math.floor(rand() * Math.min(3, remaining.length))].p;

    return { cols, rows, blocked, start, pickup, dropoff };
  }

  // Fallback: an open grid always works.
  const blocked = Array.from({ length: rows }, () => Array(cols).fill(false));
  return {
    cols,
    rows,
    blocked,
    start,
    pickup: { row: 0, col: cols - 1 },
    dropoff: { row: rows - 1, col: cols - 1 },
  };
}

export const parcelFacts = [
  "Real delivery route planning is a version of the 'traveling salesman problem' — finding the shortest route through a set of stops is so computationally hard that even modern routing software relies on smart approximations, not exact answers.",
  "Postal services once solved routing by pure habit — carriers learned their own routes by heart. Modern systems now recalculate routes in real time as new stops are added mid-shift.",
  "Package sorting hubs use conveyor systems that read a label and physically divert each parcel down a different chute — a real-world maze the parcel solves automatically, once, in transit.",
];
