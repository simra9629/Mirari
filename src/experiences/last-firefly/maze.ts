export interface Cell {
  row: number;
  col: number;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface Maze {
  cols: number;
  rows: number;
  cells: Cell[][];
  start: { row: number; col: number };
  goal: { row: number; col: number };
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Generates a perfect maze (exactly one path between any two cells) via recursive backtracking. */
export function generateMaze(cols: number, rows: number, seed: number): Maze {
  const rand = makeRng(seed);
  const cells: Cell[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      top: true,
      right: true,
      bottom: true,
      left: true,
    })),
  );

  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  function neighbors(row: number, col: number) {
    const list: { row: number; col: number; dir: "top" | "right" | "bottom" | "left" }[] = [];
    if (row > 0) list.push({ row: row - 1, col, dir: "top" });
    if (col < cols - 1) list.push({ row, col: col + 1, dir: "right" });
    if (row < rows - 1) list.push({ row: row + 1, col, dir: "bottom" });
    if (col > 0) list.push({ row, col: col - 1, dir: "left" });
    return list;
  }

  const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;

  const stack: { row: number; col: number }[] = [];
  let current = { row: 0, col: 0 };
  visited[0][0] = true;
  stack.push(current);

  while (stack.length > 0) {
    current = stack[stack.length - 1];
    const options = neighbors(current.row, current.col).filter((n) => !visited[n.row][n.col]);
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(rand() * options.length)];
    cells[current.row][current.col][next.dir] = false;
    cells[next.row][next.col][opposite[next.dir]] = false;
    visited[next.row][next.col] = true;
    stack.push({ row: next.row, col: next.col });
  }

  // Find the cell farthest from the start via BFS, for an interesting goal placement.
  const dist: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));
  dist[0][0] = 0;
  const queue: { row: number; col: number }[] = [{ row: 0, col: 0 }];
  let farthest = { row: 0, col: 0 };
  while (queue.length > 0) {
    const c = queue.shift()!;
    const cell = cells[c.row][c.col];
    const steps: [boolean, number, number][] = [
      [!cell.top, c.row - 1, c.col],
      [!cell.right, c.row, c.col + 1],
      [!cell.bottom, c.row + 1, c.col],
      [!cell.left, c.row, c.col - 1],
    ];
    for (const [open, r, cl] of steps) {
      if (open && r >= 0 && r < rows && cl >= 0 && cl < cols && dist[r][cl] === -1) {
        dist[r][cl] = dist[c.row][c.col] + 1;
        queue.push({ row: r, col: cl });
        if (dist[r][cl] > dist[farthest.row][farthest.col]) farthest = { row: r, col: cl };
      }
    }
  }

  return { cols, rows, cells, start: { row: 0, col: 0 }, goal: farthest };
}
