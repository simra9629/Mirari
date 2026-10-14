import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./City.module.css";
import { hashSeed, makeRng } from "../../lib/rng";

type BuiltType = "road" | "bridge" | "building" | "park" | "plaza" | "school" | "hospital" | "factory";
type CellType = BuiltType | "empty" | "water";
type Use = "residential" | "commercial";

interface Cell {
  type: CellType;
  level: number; // building level 1-3
  age: number;
  factoryCapped: boolean; // buildings grown next to a factory never reach level 3
  use: Use;
}

type Tool = "road" | "park" | "plaza" | "school" | "hospital" | "factory" | "bulldoze";

// Soft practical ceiling so an endless session can't grow the sparse map
// without bound — comfortably beyond anything a normal session reaches.
const MAX_DIM = 64;
const EXPAND_MARGIN = 3;
const EXPAND_STEP = 4;
// Fraction of the current grid that must already hold a road, building, or
// other placed cell before the grid is allowed to expand further.
const MIN_OCCUPANCY_TO_EXPAND = 0.22;


/** A per-cell hash in [0,1), independent of iteration order — used for
 * terrain and stable color variants so any cell anywhere can be computed
 * on demand as the city expands, with no need to remember it. */
function cellHash(r: number, c: number, salt: number): number {
  return hashSeed(hashSeed(r * 92821 + c * 1000003) ^ salt) / 4294967295;
}

interface WorldShape {
  base: number;
  amp1: number;
  freq1: number;
  phase1: number;
  amp2: number;
  freq2: number;
  phase2: number;
}

function makeWorldShape(seed: number): WorldShape {
  const rand = makeRng(seed);
  return {
    base: rand() * 4 - 2,
    amp1: 2 + rand() * 2,
    freq1: 0.12 + rand() * 0.08,
    phase1: rand() * Math.PI * 2,
    amp2: 1 + rand() * 1.5,
    freq2: 0.3 + rand() * 0.15,
    phase2: rand() * Math.PI * 2,
  };
}

/** The river's row at any column — a smooth deterministic function, not a
 * random walk, so it can be evaluated for new columns in either direction
 * as the city's bounds expand. */
function riverRowAt(col: number, shape: WorldShape): number {
  return shape.base + Math.sin(col * shape.freq1 + shape.phase1) * shape.amp1 + Math.sin(col * shape.freq2 + shape.phase2) * shape.amp2;
}

function newBuilding(use: Use, factoryCapped: boolean): Cell {
  return { type: "building", level: 1, age: 0, factoryCapped, use };
}

function builtCell(type: BuiltType): Cell {
  return { type, level: 0, age: 0, factoryCapped: false, use: "residential" };
}

function terrainCell(type: "empty" | "water"): Cell {
  return { type, level: 0, age: 0, factoryCapped: false, use: "residential" };
}

interface Bounds {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
}

const RESIDENTIAL_COLORS = [
  ["#c9a15a", "#d9b26e", "#b88f4a"],
  ["#e0b877", "#eec78d", "#cca464"],
  ["#f0c88a", "#f7d79e", "#dcb570"],
];
const COMMERCIAL_COLORS = [
  ["#6f8fae", "#7fa0bc", "#5f7c96"],
  ["#7fa8c9", "#8fb8d6", "#6f92ae"],
  ["#8fd6e0", "#a6e2ea", "#78bfc9"],
];

export function City() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldSeedRef = useRef(9001);
  const shapeRef = useRef(makeWorldShape(9001));
  const cellsRef = useRef(new Map<string, Cell>());
  const boundsRef = useRef<Bounds>({ minR: -5, maxR: 5, minC: -7, maxC: 7 });
  const placedRef = useRef<Bounds>({ minR: Infinity, maxR: -Infinity, minC: Infinity, maxC: -Infinity });
  const [tool, setTool] = useState<Tool>("road");
  const [population, setPopulation] = useState(0);
  const [jobs, setJobs] = useState(0);
  const [ticks, setTicks] = useState(0);
  const [gridLabel, setGridLabel] = useState("11 × 15 blocks");
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

    function key(r: number, c: number) {
      return `${r},${c}`;
    }

    function isWater(r: number, c: number) {
      const row = riverRowAt(c, shapeRef.current);
      return r >= Math.floor(row) && r <= Math.floor(row) + 1;
    }

    function getCell(r: number, c: number): Cell {
      const found = cellsRef.current.get(key(r, c));
      if (found) return found;
      return terrainCell(isWater(r, c) ? "water" : "empty");
    }

    function setCell(r: number, c: number, cell: Cell) {
      cellsRef.current.set(key(r, c), cell);
      const p = placedRef.current;
      p.minR = Math.min(p.minR, r);
      p.maxR = Math.max(p.maxR, r);
      p.minC = Math.min(p.minC, c);
      p.maxC = Math.max(p.maxC, c);
    }

    function clearCell(r: number, c: number) {
      cellsRef.current.delete(key(r, c));
    }

    function recomputeLayout() {
      const b = boundsRef.current;
      const gridW = b.maxC - b.minC + 1;
      const gridH = b.maxR - b.minR + 1;
      const pad = 16;
      cellSize = Math.min((width - pad * 2) / gridW, (height - pad * 2) / gridH);
      offsetX = (width - cellSize * gridW) / 2;
      offsetY = (height - cellSize * gridH) / 2;
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      recomputeLayout();
    }

    function maybeExpand() {
      const b = boundsRef.current;
      const p = placedRef.current;
      // Placed cells are a sparse, branching shape (roads and the buildings
      // that grow along them) inside a rectangular grid. A single road tile
      // near one edge used to expand that whole edge, ballooning the grid
      // into mostly-empty space far from anywhere the city had reached.
      // Require the current grid to already be reasonably built out before
      // it's allowed to grow again, so the grid tracks the city rather than
      // outrunning it.
      const gridW = b.maxC - b.minC + 1;
      const gridH = b.maxR - b.minR + 1;
      const occupancy = cellsRef.current.size / (gridW * gridH);
      if (occupancy < MIN_OCCUPANCY_TO_EXPAND) return;
      let changed = false;
      if (p.minR - b.minR <= EXPAND_MARGIN && b.maxR - b.minR < MAX_DIM) { b.minR -= EXPAND_STEP; changed = true; }
      if (b.maxR - p.maxR <= EXPAND_MARGIN && b.maxR - b.minR < MAX_DIM) { b.maxR += EXPAND_STEP; changed = true; }
      if (p.minC - b.minC <= EXPAND_MARGIN && b.maxC - b.minC < MAX_DIM) { b.minC -= EXPAND_STEP; changed = true; }
      if (b.maxC - p.maxC <= EXPAND_MARGIN && b.maxC - b.minC < MAX_DIM) { b.maxC += EXPAND_STEP; changed = true; }
      if (changed) {
        recomputeLayout();
        setGridLabel(`${b.maxR - b.minR + 1} × ${b.maxC - b.minC + 1} blocks`);
      }
    }

    function isRoadLike(cell: Cell) {
      return cell.type === "road" || cell.type === "bridge";
    }

    function neighborCount(r: number, c: number, radius: number, predicate: (cell: Cell) => boolean) {
      let count = 0;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (radius === 1 && Math.abs(dr) + Math.abs(dc) > 1) continue; // 4-directional at radius 1
          if (predicate(getCell(r + dr, c + dc))) count++;
        }
      }
      return count;
    }

    function tick() {
      const rand = rngRef.current;
      const b = boundsRef.current;

      // Age existing buildings and consider upgrades, over the current view.
      for (const [k, cell] of cellsRef.current) {
        if (cell.type !== "building") continue;
        cell.age++;
        const [r, c] = k.split(",").map(Number);
        if (cell.level === 1 && cell.age > 3) {
          const density = neighborCount(r, c, 1, (n) => n.type === "building" || isRoadLike(n));
          const schoolBoost = neighborCount(r, c, 1, (n) => n.type === "school") > 0 ? 0.12 : 0;
          if (density >= 2 && rand() < 0.14 + schoolBoost) {
            cell.level = 2;
            cell.age = 0;
          }
        } else if (cell.level === 2 && cell.age > 4 && !cell.factoryCapped) {
          const density = neighborCount(r, c, 1, (n) => n.type === "building" || isRoadLike(n));
          const hospitalBoost = neighborCount(r, c, 1, (n) => n.type === "hospital") > 0 ? 0.12 : 0;
          if (density >= 3 && rand() < 0.1 + hospitalBoost) {
            cell.level = 3;
            cell.age = 0;
          }
        }
      }

      // New growth, scanning the current view for empty, road-adjacent land.
      for (let r = b.minR; r <= b.maxR; r++) {
        for (let c = b.minC; c <= b.maxC; c++) {
          if (cellsRef.current.has(key(r, c))) continue;
          if (isWater(r, c)) continue;
          const roadAdjacent = neighborCount(r, c, 1, isRoadLike) > 0;
          if (!roadAdjacent) continue;
          const parkAdjacent = neighborCount(r, c, 1, (n) => n.type === "park") > 0;
          const plazaNearby = neighborCount(r, c, 2, (n) => n.type === "plaza") > 0;
          const factoryAdjacent = neighborCount(r, c, 1, (n) => n.type === "factory") > 0;
          const chance = 0.05 + (parkAdjacent ? 0.06 : 0) + (plazaNearby ? 0.08 : 0) + (factoryAdjacent ? 0.15 : 0);
          if (rand() < chance) {
            const commercialChance = 0.25 + (plazaNearby ? 0.25 : 0);
            const use: Use = rand() < commercialChance ? "commercial" : "residential";
            setCell(r, c, newBuilding(use, factoryAdjacent));
          }
        }
      }

      let pop = 0;
      let jobCount = 0;
      for (const cell of cellsRef.current.values()) {
        if (cell.type === "building") {
          if (cell.use === "residential") pop += cell.level * 40;
          else jobCount += cell.level * 35;
        }
        if (cell.type === "factory") jobCount += 55;
      }
      setPopulation(pop);
      setJobs(jobCount);
      setTicks((n) => n + 1);

      maybeExpand();
    }

    function cellAt(clientX: number, clientY: number) {
      const b = boundsRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (width / rect.width);
      const y = (clientY - rect.top) * (height / rect.height);
      const c = Math.floor((x - offsetX) / cellSize) + b.minC;
      const r = Math.floor((y - offsetY) / cellSize) + b.minR;
      if (r < b.minR || r > b.maxR || c < b.minC || c > b.maxC) return null;
      return { r, c };
    }

    function applyTool(r: number, c: number) {
      const cell = getCell(r, c);
      const t = toolRef.current;

      if (t === "bulldoze") {
        if (cell.type !== "water" && cell.type !== "empty") clearCell(r, c);
        return;
      }

      if (t === "road") {
        if (cell.type === "water") setCell(r, c, builtCell("bridge"));
        else if (cell.type === "road") clearCell(r, c);
        else if (cell.type === "empty") setCell(r, c, builtCell("road"));
        return;
      }

      const targetType: BuiltType = t;
      if (cell.type === targetType) clearCell(r, c);
      else if (cell.type === "empty") setCell(r, c, builtCell(targetType));
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
      ctx.fillStyle = isBridge ? "#8a6a45" : "#4a4d55";
      ctx.fillRect(x, y, cellSize, cellSize);
      const connectsUp = isRoadLike(getCell(r - 1, c));
      const connectsDown = isRoadLike(getCell(r + 1, c));
      const connectsLeft = isRoadLike(getCell(r, c - 1));
      const connectsRight = isRoadLike(getCell(r, c + 1));
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

    function drawBuilding(cell: Cell, r: number, c: number, x: number, y: number) {
      const pad = cellSize * (cell.level === 1 ? 0.26 : cell.level === 2 ? 0.15 : 0.05);
      const w = cellSize - pad * 2;
      const h = cellSize - pad * 2;
      const bx = x + pad;
      const by = y + pad;
      const palette = cell.use === "commercial" ? COMMERCIAL_COLORS : RESIDENTIAL_COLORS;
      const colors = palette[cell.level - 1];
      const tint = Math.floor(cellHash(r, c, 771) * colors.length);
      const color = colors[tint % colors.length];

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(bx + 1.5, by + 1.5, w, h);

      ctx.fillStyle = color;
      ctx.fillRect(bx, by, w, h);

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

    function drawPark(x: number, y: number, r: number, c: number) {
      ctx.fillStyle = "#3f6b45";
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      const variant = Math.floor(cellHash(r, c, 331) * 3);
      const spots: [number, number][] = variant === 0 ? [[0.5, 0.5]] : variant === 1 ? [[0.35, 0.4], [0.65, 0.65]] : [[0.3, 0.6], [0.6, 0.35], [0.7, 0.7]];
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

    function drawSchool(x: number, y: number) {
      const pad = cellSize * 0.14;
      ctx.fillStyle = "#c9b896";
      ctx.fillRect(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2);
      ctx.fillStyle = "#9a7fc9";
      ctx.beginPath();
      ctx.moveTo(x + cellSize / 2, y + pad * 0.6);
      ctx.lineTo(x + cellSize - pad, y + pad * 1.6);
      ctx.lineTo(x + pad, y + pad * 1.6);
      ctx.closePath();
      ctx.fill();
    }

    function drawHospital(x: number, y: number) {
      const pad = cellSize * 0.14;
      ctx.fillStyle = "#e6e6e0";
      ctx.fillRect(x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2);
      ctx.fillStyle = "#c96a6a";
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const s = cellSize * 0.09;
      ctx.fillRect(cx - s * 0.3, cy - s, s * 0.6, s * 2);
      ctx.fillRect(cx - s, cy - s * 0.3, s * 2, s * 0.6);
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

      const b = boundsRef.current;
      for (let r = b.minR; r <= b.maxR; r++) {
        for (let c = b.minC; c <= b.maxC; c++) {
          const cell = getCell(r, c);
          const x = offsetX + (c - b.minC) * cellSize;
          const y = offsetY + (r - b.minR) * cellSize;

          if (cell.type === "empty") {
            const parity = Math.floor(cellHash(r, c, 12) * 2);
            ctx.fillStyle = parity === 0 ? "#25301f" : "#26321f";
            ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
          } else if (cell.type === "water") {
            drawWater(x, y, t);
          } else if (cell.type === "road" || cell.type === "bridge") {
            drawRoad(r, c, x, y, cell.type === "bridge");
          } else if (cell.type === "park") {
            drawPark(x, y, r, c);
          } else if (cell.type === "plaza") {
            drawPlaza(x, y, t);
          } else if (cell.type === "school") {
            drawSchool(x, y);
          } else if (cell.type === "hospital") {
            drawHospital(x, y);
          } else if (cell.type === "factory") {
            drawFactory(x, y, t);
          } else if (cell.type === "building") {
            drawBuilding(cell, r, c, x, y);
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
    shapeRef.current = makeWorldShape(worldSeedRef.current);
    cellsRef.current = new Map();
    boundsRef.current = { minR: -5, maxR: 5, minC: -7, maxC: 7 };
    placedRef.current = { minR: Infinity, maxR: -Infinity, minC: Infinity, maxC: -Infinity };
    rngRef.current = makeRng(4242 + worldSeedRef.current);
    setPopulation(0);
    setJobs(0);
    setTicks(0);
    setGridLabel("11 × 15 blocks");
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
            Draw roads — bridge the river if you need to. Parks, a plaza,
            a school, a hospital, and factories each shape growth
            differently nearby. The city has no edge — it just keeps
            expanding as it fills in.
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
            <button type="button" className={`${styles.toolButton} ${tool === "school" ? styles.toolActive : ""}`} onClick={() => setTool("school")}>
              School
            </button>
            <button type="button" className={`${styles.toolButton} ${tool === "hospital" ? styles.toolActive : ""}`} onClick={() => setTool("hospital")}>
              Hospital
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
          <div className={styles.readout}>{gridLabel}</div>
          {commute && <div className={styles.commute}>{commute}</div>}
          <button type="button" className={styles.resetButton} onClick={resetCity}>
            Start over
          </button>
        </div>
      </div>
    </ExperienceLayout>
  );
}
