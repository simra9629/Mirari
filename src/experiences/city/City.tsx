import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./City.module.css";

type CellType = "empty" | "road" | "bridge" | "water" | "building" | "park" | "plaza" | "factory";

interface Cell {
  type: CellType;
  level: number; // building level 1-3, unused otherwise
  age: number;
  factoryCapped: boolean; // buildings grown next to a factory never reach level 3
  tint: number; // 0-2, a stable per-cell color variant so the city isn't monotone
}

type Tool = "road" | "park" | "plaza" | "factory" | "bulldoze";

const GRID_W = 16;
const GRID_H = 11;

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

function emptyCell(): Cell {
  return { type: "empty", level: 0, age: 0, factoryCapped: false, tint: 0 };
}

function makeGrid(worldSeed: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => emptyCell()));
  const rand = makeRng(worldSeed);

  // A gently wandering river, left to right.
  let riverRow = 2 + Math.floor(rand() * (GRID_H - 4));
  for (let c = 0; c < GRID_W; c++) {
    riverRow += Math.floor(rand() * 3) - 1;
    riverRow = Math.max(1, Math.min(GRID_H - 2, riverRow));
    grid[riverRow][c].type = "water";
    if (rand() < 0.6) grid[Math.min(GRID_H - 1, riverRow + 1)][c].type = "water";
  }

  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      grid[r][c].tint = Math.floor(rand() * 3);
    }
  }

  return grid;
}

function withinRadius(r: number, c: number, radius: number, predicate: (cell: Cell) => boolean, grid: Cell[][]) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
      if (predicate(grid[nr][nc])) return true;
    }
  }
  return false;
}

function neighborCount(r: number, c: number, predicate: (cell: Cell) => boolean, grid: Cell[][]) {
  let count = 0;
  const deltas: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of deltas) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < GRID_H && nc >= 0 && nc < GRID_W && predicate(grid[nr][nc])) count++;
  }
  return count;
}

const BUILDING_COLORS = [
  ["#c9a15a", "#d9b26e", "#b88f4a"],
  ["#e0b877", "#eec78d", "#cca464"],
  ["#8fd6e0", "#a6e2ea", "#78bfc9"],
];

const INITIAL_WORLD_SEED = 9001;

export function City() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldSeedRef = useRef(INITIAL_WORLD_SEED);
  const gridRef = useRef<Cell[][]>(makeGrid(INITIAL_WORLD_SEED));
  const [tool, setTool] = useState<Tool>("road");
  const [population, setPopulation] = useState(0);
  const [jobs, setJobs] = useState(0);
  const [ticks, setTicks] = useState(0);
  const toolRef = useRef(tool);
  const rngRef = useRef(makeRng(4242));
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let cellSize = 20;
    let offsetX = 0;
    let offsetY = 0;
    let raf = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 16;
      cellSize = Math.min((width - pad * 2) / GRID_W, (height - pad * 2) / GRID_H);
      offsetX = (width - cellSize * GRID_W) / 2;
      offsetY = (height - cellSize * GRID_H) / 2;
    }

    function isRoadLike(cell: Cell) {
      return cell.type === "road" || cell.type === "bridge";
    }

    function tick() {
      const rand = rngRef.current;
      const grid = gridRef.current;
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const cell = grid[r][c];
          if (cell.type === "building") cell.age++;

          if (cell.type === "empty") {
            const roadAdjacent = neighborCount(r, c, isRoadLike, grid) > 0;
            if (!roadAdjacent) continue;
            const parkAdjacent = neighborCount(r, c, (n) => n.type === "park", grid) > 0;
            const plazaNearby = withinRadius(r, c, 2, (n) => n.type === "plaza", grid);
            const factoryAdjacent = neighborCount(r, c, (n) => n.type === "factory", grid) > 0;
            const chance = 0.05 + (parkAdjacent ? 0.06 : 0) + (plazaNearby ? 0.08 : 0) + (factoryAdjacent ? 0.15 : 0);
            if (rand() < chance) {
              grid[r][c] = { type: "building", level: 1, age: 0, factoryCapped: factoryAdjacent, tint: cell.tint };
            }
          } else if (cell.type === "building" && cell.level === 1 && cell.age > 3) {
            const density = neighborCount(r, c, (n) => n.type === "building" || isRoadLike(n), grid);
            if (density >= 2 && rand() < 0.14) {
              cell.level = 2;
              cell.age = 0;
            }
          } else if (cell.type === "building" && cell.level === 2 && cell.age > 4 && !cell.factoryCapped) {
            const density = neighborCount(r, c, (n) => n.type === "building" || isRoadLike(n), grid);
            if (density >= 3 && rand() < 0.1) {
              cell.level = 3;
              cell.age = 0;
            }
          }
        }
      }

      let pop = 0;
      let jobCount = 0;
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const cell = grid[r][c];
          if (cell.type === "building") pop += cell.level * 40;
          if (cell.type === "factory") jobCount += 55;
        }
      }
      setPopulation(pop);
      setJobs(jobCount);
      setTicks((t) => t + 1);
    }

    function cellAt(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (width / rect.width);
      const y = (clientY - rect.top) * (height / rect.height);
      const c = Math.floor((x - offsetX) / cellSize);
      const r = Math.floor((y - offsetY) / cellSize);
      if (r < 0 || r >= GRID_H || c < 0 || c >= GRID_W) return null;
      return { r, c };
    }

    function applyTool(r: number, c: number) {
      const grid = gridRef.current;
      const cell = grid[r][c];
      const t = toolRef.current;

      if (t === "bulldoze") {
        if (cell.type === "bridge") grid[r][c] = { ...emptyCell(), type: "water", tint: cell.tint };
        else if (cell.type !== "water") grid[r][c] = { ...emptyCell(), tint: cell.tint };
        return;
      }

      if (t === "road") {
        if (cell.type === "water") grid[r][c] = { ...emptyCell(), type: "bridge", tint: cell.tint };
        else if (cell.type === "road") grid[r][c] = { ...emptyCell(), tint: cell.tint };
        else if (cell.type === "empty") grid[r][c] = { ...emptyCell(), type: "road", tint: cell.tint };
        return;
      }

      const targetType: CellType = t;
      if (cell.type === targetType) grid[r][c] = { ...emptyCell(), tint: cell.tint };
      else if (cell.type === "empty") grid[r][c] = { ...emptyCell(), type: targetType, tint: cell.tint };
    }

    let dragging = false;
    function onDown(e: PointerEvent) {
      dragging = true;
      const cell = cellAt(e.clientX, e.clientY);
      if (cell) applyTool(cell.r, cell.c);
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      const cell = cellAt(e.clientX, e.clientY);
      if (cell) applyTool(cell.r, cell.c);
    }
    function onUp() {
      dragging = false;
    }

    function drawRoad(r: number, c: number, x: number, y: number, isBridge: boolean) {
      const grid = gridRef.current;
      ctx.fillStyle = isBridge ? "#8a6a45" : "#4a4d55";
      ctx.fillRect(x, y, cellSize, cellSize);
      const connectsUp = r > 0 && isRoadLike(grid[r - 1][c]);
      const connectsDown = r < GRID_H - 1 && isRoadLike(grid[r + 1][c]);
      const connectsLeft = c > 0 && isRoadLike(grid[r][c - 1]);
      const connectsRight = c < GRID_W - 1 && isRoadLike(grid[r][c + 1]);
      ctx.strokeStyle = isBridge ? "rgba(230,220,200,0.5)" : "rgba(230,230,235,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      ctx.beginPath();
      if (connectsUp) { ctx.moveTo(cx, y); ctx.lineTo(cx, cy); }
      if (connectsDown) { ctx.moveTo(cx, cy); ctx.lineTo(cx, y + cellSize); }
      if (connectsLeft) { ctx.moveTo(x, cy); ctx.lineTo(cx, cy); }
      if (connectsRight) { ctx.moveTo(cx, cy); ctx.lineTo(x + cellSize, cy); }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawBuilding(cell: Cell, x: number, y: number) {
      const pad = cellSize * (cell.level === 1 ? 0.26 : cell.level === 2 ? 0.15 : 0.05);
      const w = cellSize - pad * 2;
      const h = cellSize - pad * 2;
      const bx = x + pad;
      const by = y + pad;
      const colors = BUILDING_COLORS[cell.level - 1];
      const color = colors[cell.tint % colors.length];

      // Ground shadow for a touch of depth.
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(bx + 1.5, by + 1.5, w, h);

      ctx.fillStyle = color;
      ctx.fillRect(bx, by, w, h);

      // A lighter "sunlit" edge.
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(bx, by, w, Math.max(1.5, h * 0.12));

      if (cell.level >= 2) {
        ctx.fillStyle = "rgba(20,20,25,0.35)";
        const rows = cell.level === 3 ? 3 : 2;
        for (let i = 0; i < rows; i++) {
          ctx.fillRect(bx + w * 0.2, by + h * (0.32 + i * 0.22), w * 0.18, h * 0.1);
          ctx.fillRect(bx + w * 0.58, by + h * (0.32 + i * 0.22), w * 0.18, h * 0.1);
        }
      }
    }

    function drawPark(x: number, y: number, tint: number) {
      ctx.fillStyle = "#3f6b45";
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      const spots: [number, number][] = tint === 0 ? [[0.5, 0.5]] : tint === 1 ? [[0.35, 0.4], [0.65, 0.65]] : [[0.3, 0.6], [0.6, 0.35], [0.7, 0.7]];
      ctx.fillStyle = "#2c4a33";
      for (const [fx, fy] of spots) {
        ctx.beginPath();
        ctx.arc(x + cellSize * fx, y + cellSize * fy, cellSize * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawPlaza(x: number, y: number, t: number) {
      ctx.fillStyle = "#c9beae";
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const pulse = reducedMotion.current ? 0 : Math.sin(t / 500) * 0.15 + 0.85;
      ctx.strokeStyle = `rgba(94,140,255,${0.5 * pulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#8fa6c9";
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawFactory(x: number, y: number, t: number) {
      const pad = cellSize * 0.12;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + pad + 1.5, y + pad + 1.5, cellSize - pad * 2, cellSize - pad * 2);
      ctx.fillStyle = "#6b6558";
      ctx.fillRect(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2);
      ctx.fillStyle = "#4a453c";
      const stackX = x + cellSize * 0.65;
      const stackTop = y + cellSize * 0.05;
      ctx.fillRect(stackX, stackTop, cellSize * 0.12, cellSize * 0.35);
      if (!reducedMotion.current) {
        const puff = (t / 900) % 1;
        ctx.fillStyle = `rgba(180,180,180,${0.4 * (1 - puff)})`;
        ctx.beginPath();
        ctx.arc(stackX + cellSize * 0.06, stackTop - puff * cellSize * 0.6, cellSize * (0.06 + puff * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawWater(x: number, y: number, t: number) {
      const shimmer = reducedMotion.current ? 0 : Math.sin(t / 700 + x * 0.05) * 8;
      ctx.fillStyle = `rgb(${58 + shimmer},${94 + shimmer},${120 + shimmer})`;
      ctx.fillRect(x, y, cellSize, cellSize);
    }

    function draw(t: number) {
      ctx.fillStyle = "#1c2418";
      ctx.fillRect(0, 0, width, height);

      const grid = gridRef.current;
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const cell = grid[r][c];
          const x = offsetX + c * cellSize;
          const y = offsetY + r * cellSize;

          if (cell.type === "empty") {
            ctx.fillStyle = r % 2 === c % 2 ? "#25301f" : "#26321f";
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          } else if (cell.type === "water") {
            drawWater(x, y, t);
          } else if (cell.type === "road" || cell.type === "bridge") {
            drawRoad(r, c, x, y, cell.type === "bridge");
          } else if (cell.type === "park") {
            drawPark(x, y, cell.tint);
          } else if (cell.type === "plaza") {
            drawPlaza(x, y, t);
          } else if (cell.type === "factory") {
            drawFactory(x, y, t);
          } else if (cell.type === "building") {
            drawBuilding(cell, x, y);
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const interval = window.setInterval(tick, 550);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function resetCity() {
    worldSeedRef.current += 1;
    gridRef.current = makeGrid(worldSeedRef.current);
    rngRef.current = makeRng(4242 + worldSeedRef.current);
    setPopulation(0);
    setJobs(0);
    setTicks(0);
  }

  const commute =
    jobs === 0 || population === 0
      ? null
      : jobs > population * 1.3
        ? "More jobs than residents — people commute in."
        : population > jobs * 1.3
          ? "More residents than jobs — people commute out."
          : "Jobs and residents are roughly balanced.";

  return (
    <ExperienceLayout title="City" category="Tiny World" accent="#c9a15a" background="#1c2418">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <p className={styles.hint}>
            Draw roads — bridge the river if you need to. Parks, a civic
            plaza, and factories each shape growth differently nearby.
            Buildings decide for themselves whether, and how tall, to grow.
          </p>
          <div className={styles.tools}>
            <button type="button" className={`${styles.toolButton} ${tool === "road" ? styles.toolActive : ""}`} onClick={() => setTool("road")}>
              Road
            </button>
            <button type="button" className={`${styles.toolButton} ${tool === "park" ? styles.toolActive : ""}`} onClick={() => setTool("park")}>
              Park
            </button>
            <button type="button" className={`${styles.toolButton} ${tool === "plaza" ? styles.toolActive : ""}`} onClick={() => setTool("plaza")}>
              Plaza
            </button>
            <button type="button" className={`${styles.toolButton} ${tool === "factory" ? styles.toolActive : ""}`} onClick={() => setTool("factory")}>
              Factory
            </button>
            <button type="button" className={`${styles.toolButton} ${tool === "bulldoze" ? styles.toolActive : ""}`} onClick={() => setTool("bulldoze")}>
              Clear
            </button>
          </div>
          <div className={styles.readout}>
            Population ~{population.toLocaleString()} · Jobs ~{jobs.toLocaleString()} · {ticks} ticks
          </div>
          {commute && <div className={styles.commute}>{commute}</div>}
          <button type="button" className={styles.resetButton} onClick={resetCity}>
            Start over
          </button>
        </div>
      </div>
    </ExperienceLayout>
  );
}
