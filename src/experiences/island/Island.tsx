import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Island.module.css";
import { makeRng } from "../../lib/rng";

const GRID_W = 26;
const GRID_H = 18;

/** 0 sand, 1 sprout, 2 scrub, 3 grown, 4 lush, 5 ancient grove (interior only). */
interface LandCell {
  isLand: boolean;
  elevation: number; // 0 (coast) .. 1 (interior high ground)
  stage: number;
  age: number;
}

interface Bird {
  x: number; y: number; vx: number; vy: number; wing: number; landedAt: number | null;
}
interface Crab {
  x: number; y: number; tx: number; ty: number; pause: number;
}
interface Fish {
  x: number; y: number; t: number; dur: number; dir: number;
}
interface Toast {
  id: number; text: string; born: number;
}

const FLAVOR_EVENTS = [
  "A bottle washes ashore. Empty.",
  "Driftwood settles on the beach, salt-bleached and silent.",
  "A gull circles twice, decides against landing, and leaves.",
  "The tide pulls back further than usual, then returns as if nothing happened.",
  "Something glints in the shallows. Just a shell.",
  "A single seed pod drifts in from somewhere else entirely.",
];

function shapeParams(seed: number) {
  const rand = makeRng(seed);
  return {
    base: 0.52 + rand() * 0.14,
    a1: 0.1 + rand() * 0.14, f1: 2 + Math.floor(rand() * 3), p1: rand() * Math.PI * 2,
    a2: 0.04 + rand() * 0.08, f2: 5 + Math.floor(rand() * 4), p2: rand() * Math.PI * 2,
    squash: 1.1 + rand() * 0.4,
  };
}

function buildGrid(seed: number): LandCell[][] {
  const sp = shapeParams(seed);
  const grid: LandCell[][] = [];
  for (let r = 0; r < GRID_H; r++) {
    const row: LandCell[] = [];
    for (let c = 0; c < GRID_W; c++) {
      const nx = (c / (GRID_W - 1)) * 2 - 1;
      const ny = ((r / (GRID_H - 1)) * 2 - 1) * sp.squash;
      const radius = Math.hypot(nx, ny);
      const angle = Math.atan2(ny, nx);
      const threshold = sp.base + Math.sin(angle * sp.f1 + sp.p1) * sp.a1 + Math.sin(angle * sp.f2 + sp.p2) * sp.a2;
      const isLand = radius < threshold;
      const elevation = isLand ? Math.max(0, 1 - radius / Math.max(0.001, threshold)) : 0;
      row.push({ isLand, elevation, stage: 0, age: 0 });
    }
    grid.push(row);
  }
  return grid;
}

const STAGE_COLORS = ["#d9c48a", "#b8c98a", "#8fb26a", "#5f8f4e", "#3f7a45", "#2c5a37"];

export function Island() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [islandSeed, setIslandSeed] = useState(555);
  const gridRef = useRef<LandCell[][]>(buildGrid(islandSeed));
  const [raining, setRaining] = useState(false);
  const rainingRef = useRef(false);
  const [sunny, setSunny] = useState(false);
  const sunnyRef = useRef(false);
  const [windy, setWindy] = useState(false);
  const windyRef = useRef(false);
  const [lushPercent, setLushPercent] = useState(0);
  const [ancientCount, setAncientCount] = useState(0);
  const [seeded, setSeeded] = useState(0);
  const [stormsWeathered, setStormsWeathered] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Recomputed per render (cheap: a few hundred cells) rather than memoized,
  // since it depends on the mutable grid ref rather than a tracked value.
  let landCount = 0;
  for (const row of gridRef.current) for (const cell of row) if (cell.isLand) landCount++;

  useEffect(() => { rainingRef.current = raining; }, [raining]);
  useEffect(() => { sunnyRef.current = sunny; }, [sunny]);
  useEffect(() => { windyRef.current = windy; }, [windy]);

  function pushToast(text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, born: performance.now() }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6200);
  }

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let cellSize = 12;
    let offsetX = 0;
    let offsetY = 0;
    let raf = 0;
    const rand = makeRng(islandSeed * 7 + 3);
    let birds: Bird[] = [];
    let crabs: Crab[] = Array.from({ length: 3 }, () => ({ x: 0, y: 0, tx: 0, ty: 0, pause: rand() * 4 }));
    let fish: Fish[] = [];
    let stormTimer = 20 + rand() * 30;
    let stormActive = 0;
    let flavorTimer = 40 + rand() * 40;
    let dayClock = rand() * 500;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 12;
      cellSize = Math.min((width - pad * 2) / GRID_W, (height - pad * 2) / GRID_H);
      offsetX = (width - cellSize * GRID_W) / 2;
      offsetY = (height - cellSize * GRID_H) / 2;
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

    function onClick(e: MouseEvent) {
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) return;
      const gc = gridRef.current[cell.r][cell.c];
      if (gc.isLand && gc.stage === 0) {
        gc.stage = 1;
        gc.age = 0;
        setSeeded((n) => n + 1);
      }
    }

    let tickAccum = 0;

    function tick(dt: number) {
      const grid = gridRef.current;
      const wet = rainingRef.current || stormActive > 0;
      const rainBoost = wet ? 2.4 : 1;
      const dryPenalty = sunnyRef.current && !wet ? 0.6 : 1;
      const windBoost = windyRef.current ? 1.7 : 1;
      // Interior (high elevation) cells reach the top tier; a thin coastal
      // ring never grows past scrub, so a lush island still shows a beach.
      const stageThresholds = [0, 8, 14, 20, 60];

      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const cell = grid[r][c];
          if (!cell.isLand || cell.stage === 0) continue;
          const maxStage = cell.elevation > 0.45 ? 5 : cell.elevation > 0.15 ? 4 : 2;
          cell.age++;
          if (cell.stage < maxStage) {
            const needed = (stageThresholds[Math.min(cell.stage, stageThresholds.length - 1)] / rainBoost) * dryPenalty;
            if (cell.age > needed) {
              cell.stage++;
              cell.age = 0;
            }
          }
          if (cell.stage >= 2 && cell.stage < 5) {
            const spreadChance = (cell.stage >= 3 ? 0.03 : 0.015) * rainBoost;
            if (rand() < spreadChance) {
              const reach = windyRef.current ? 2 : 1;
              const dr = Math.floor(rand() * (2 * reach + 1)) - reach;
              const dc = Math.floor(rand() * (2 * reach + 1)) - reach;
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < GRID_H && nc >= 0 && nc < GRID_W && (dr !== 0 || dc !== 0)) {
                const neighbor = grid[nr][nc];
                if (neighbor.isLand && neighbor.stage === 0 && rand() < windBoost / (Math.abs(dr) + Math.abs(dc))) {
                  neighbor.stage = 1;
                  neighbor.age = 0;
                }
              }
            }
          }
        }
      }

      let lush = 0, vegetated = 0, ancient = 0;
      for (const row of grid) {
        for (const cell of row) {
          if (!cell.isLand) continue;
          if (cell.stage >= 4) lush++;
          if (cell.stage === 5) ancient++;
          if (cell.stage >= 2) vegetated++;
        }
      }
      setLushPercent(landCount > 0 ? Math.round((lush / landCount) * 100) : 0);
      setAncientCount(ancient);

      if (birds.length < 5 && vegetated / Math.max(1, landCount) > 0.2 && rand() < 0.3) {
        birds.push({ x: width / 2, y: height / 2, vx: (rand() - 0.5) * 30, vy: (rand() - 0.5) * 30, wing: rand() * Math.PI, landedAt: null });
      }
      if (fish.length < 3 && rand() < 0.5) {
        fish.push({ x: rand() * width, y: 0, t: 0, dur: 0.9 + rand() * 0.6, dir: rand() < 0.5 ? -1 : 1 });
      }

      stormTimer -= dt * 20;
      if (stormTimer <= 0 && stormActive <= 0) {
        stormActive = 6 + rand() * 6;
        stormTimer = 45 + rand() * 60;
      }
      if (stormActive > 0) {
        stormActive -= dt * 20;
        if (stormActive <= 0) setStormsWeathered((n) => n + 1);
      }

      flavorTimer -= dt * 20;
      if (flavorTimer <= 0) {
        flavorTimer = 45 + rand() * 55;
        pushToast(FLAVOR_EVENTS[Math.floor(rand() * FLAVOR_EVENTS.length)]);
      }
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (!reducedMotion.current) {
        tickAccum += dt;
        if (tickAccum > 0.5) {
          tickAccum = 0;
          tick(0.5);
        }
        dayClock += dt;

        for (const b of birds) {
          b.wing += dt * 14;
          if (b.landedAt !== null) {
            if (rand() < dt * 0.15) b.landedAt = null;
          } else {
            b.vx += (rand() - 0.5) * 6 * dt;
            b.vy += (rand() - 0.5) * 6 * dt;
            const speed = Math.hypot(b.vx, b.vy);
            if (speed > 40) { b.vx = (b.vx / speed) * 40; b.vy = (b.vy / speed) * 40; }
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.x < 0 || b.x > width) b.vx *= -1;
            if (b.y < 0 || b.y > height) b.vy *= -1;
            b.x = Math.max(0, Math.min(width, b.x));
            b.y = Math.max(0, Math.min(height, b.y));
            if (rand() < dt * 0.02) b.landedAt = performance.now();
          }
        }

        for (const cr of crabs) {
          cr.pause -= dt;
          if (cr.pause <= 0 && Math.hypot(cr.tx - cr.x, cr.ty - cr.y) < 2) {
            // pick a new spot on the beach ring
            let placed = false;
            for (let tries = 0; tries < 10 && !placed; tries++) {
              const r = Math.floor(rand() * GRID_H);
              const c = Math.floor(rand() * GRID_W);
              const cell = gridRef.current[r]?.[c];
              if (cell?.isLand && cell.elevation < 0.35) {
                cr.tx = offsetX + (c + 0.5) * cellSize;
                cr.ty = offsetY + (r + 0.5) * cellSize;
                placed = true;
              }
            }
            cr.pause = 3 + rand() * 6;
          }
          const dx = cr.tx - cr.x, dy = cr.ty - cr.y;
          const d = Math.hypot(dx, dy);
          if (d > 1) {
            cr.x += (dx / d) * 14 * dt;
            cr.y += (dy / d) * 14 * dt;
          }
        }

        fish = fish.filter((f) => f.t < f.dur);
        for (const f of fish) f.t += dt;
      }

      const dayT = (Math.sin(dayClock / 45) + 1) / 2; // 0 night .. 1 day
      const stormT = Math.min(1, Math.max(0, stormActive) / 4);
      const skyDark = stormT * 0.6;
      const wet = rainingRef.current || stormActive > 0;
      const waterBase = { r: 13 + dayT * 8, g: 31 + dayT * 30, b: 46 + dayT * 40 };
      const wR = Math.max(6, waterBase.r * (1 - skyDark));
      const wG = Math.max(10, waterBase.g * (1 - skyDark));
      const wB = Math.max(16, waterBase.b * (1 - skyDark));

      ctx.fillStyle = `rgb(${wR | 0},${wG | 0},${wB | 0})`;
      ctx.fillRect(0, 0, width, height);

      const grid = gridRef.current;
      for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
          const cell = grid[r][c];
          const x = offsetX + c * cellSize;
          const y = offsetY + r * cellSize;
          if (!cell.isLand) {
            const shimmer = reducedMotion.current ? 0 : Math.sin(t / 900 + c * 0.3 + r * 0.2) * 6;
            ctx.fillStyle = `rgb(${(wR + 8 + shimmer) | 0},${(wG + 12 + shimmer) | 0},${(wB + 14 + shimmer) | 0})`;
            ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5);
            continue;
          }
          ctx.fillStyle = STAGE_COLORS[cell.stage];
          ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5);
          if (cell.stage >= 3) {
            ctx.fillStyle = cell.stage === 5 ? "#1c3a22" : "#2c4a2f";
            const r2 = cellSize * (cell.stage === 5 ? 0.36 : 0.28);
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2 - (cell.stage === 5 ? 1 : 0), r2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (wet) {
            ctx.fillStyle = "rgba(120,160,200,0.12)";
            ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }

      // Rain streaks
      if ((rainingRef.current || stormActive > 0) && !reducedMotion.current) {
        ctx.strokeStyle = "rgba(200,220,240,0.35)";
        ctx.lineWidth = 1;
        const n = stormActive > 0 ? 70 : 40;
        for (let i = 0; i < n; i++) {
          const rx = (i * 53 + (t / 12) % 400) % width;
          const ry = (i * 91 + (t / 6)) % height;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 3, ry + 9);
          ctx.stroke();
        }
      }

      // Sun glow
      if (sunnyRef.current && stormActive <= 0) {
        const g = ctx.createRadialGradient(width * 0.82, height * 0.14, 2, width * 0.82, height * 0.14, 60);
        g.addColorStop(0, "rgba(255,224,150,0.55)");
        g.addColorStop(1, "rgba(255,224,150,0)");
        ctx.fillStyle = g;
        ctx.fillRect(width * 0.6, 0, width * 0.4, height * 0.4);
      }

      // Crabs
      ctx.fillStyle = "#c9694f";
      for (const cr of crabs) {
        ctx.beginPath();
        ctx.ellipse(cr.x, cr.y, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fish arcs
      ctx.strokeStyle = "rgba(180,210,230,0.7)";
      ctx.lineWidth = 1.4;
      for (const f of fish) {
        const p = f.t / f.dur;
        const fx = f.x + f.dir * p * 26;
        const fy = height * 0.12 + Math.sin(p * Math.PI) * -16 + height * 0.05;
        ctx.beginPath();
        ctx.moveTo(fx - 3, fy + 1);
        ctx.quadraticCurveTo(fx, fy - 3, fx + 3, fy + 1);
        ctx.stroke();
      }

      // Birds
      ctx.strokeStyle = "#e8e3d4";
      ctx.lineWidth = 1.4;
      for (const b of birds) {
        const flap = b.landedAt === null ? Math.sin(b.wing) * 2.5 : 0;
        ctx.beginPath();
        ctx.moveTo(b.x - 4, b.y - flap);
        ctx.lineTo(b.x, b.y - 2.5);
        ctx.lineTo(b.x + 4, b.y - flap);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandSeed]);

  function newIsland() {
    const next = Math.floor(Math.random() * 100000);
    gridRef.current = buildGrid(next);
    setIslandSeed(next);
    setSeeded(0);
    setStormsWeathered(0);
    setToasts([]);
  }

  return (
    <ExperienceLayout title="Island" category="Tiny World" accent="#7fa85f" background="#0d1f2e">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.toasts}>
          {toasts.map((tst) => (
            <div key={tst.id} className={styles.toast}>{tst.text}</div>
          ))}
        </div>

        <div className={styles.hud}>
          <p className={styles.hint}>Click bare land to plant a seed. Everything after that spreads on its own.</p>
          <div className={styles.readout}>
            {lushPercent}% grown &middot; {ancientCount} ancient groves &middot; {seeded} seeds planted &middot; {stormsWeathered} storms weathered
          </div>
          <div className={styles.tools}>
            <button type="button" className={`${styles.toolButton} ${raining ? styles.toolOn : ""}`} onClick={() => setRaining((r) => !r)}>
              {raining ? "Let it clear up" : "Bring the rain"}
            </button>
            <button type="button" className={`${styles.toolButton} ${sunny ? styles.toolOn : ""}`} onClick={() => setSunny((s) => !s)}>
              {sunny ? "Let clouds back in" : "Bring out the sun"}
            </button>
            <button type="button" className={`${styles.toolButton} ${windy ? styles.toolOn : ""}`} onClick={() => setWindy((w) => !w)}>
              {windy ? "Let the wind settle" : "Stir up the wind"}
            </button>
            <button type="button" className={styles.toolButton} onClick={newIsland}>
              A new island
            </button>
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
