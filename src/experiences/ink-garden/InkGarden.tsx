import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./InkGarden.module.css";
import { makeRng } from "../../lib/rng";

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  order: number;
  color: string;
}

interface Flower {
  x: number;
  y: number;
  order: number;
  color: string;
  r: number;
}

interface Plant {
  segments: Segment[];
  flowers: Flower[];
  total: number;
  startTime: number;
}

const STEM_COLORS = ["#173b32", "#547b58"];
const FLOWER_COLORS = ["#9270b7", "#d67574", "#d7af5b"];

// Scrambles the seed before it enters the LCG below. A plain LCG's very
// first output is a smooth function of the seed, so sequential seeds
// (level * k + c) would otherwise produce long runs of near-identical
// early results — this hash breaks that up.

interface Archetype {
  name: string;
  depth: number;
  branchChance: number;
  branches: number; // max branches per fork
  lengthMul: number;
  angleSpread: number;
  baseAngle: number; // radians; -PI/2 is straight up
  angleJitter: number; // random spread added around baseAngle for the trunk
  flowerChance: number; // some tips end in a bare bud instead of a flower
}

const ARCHETYPES: Archetype[] = [
  { name: "sprout", depth: 1, branchChance: 0.3, branches: 1, lengthMul: 0.55, angleSpread: 0.25, baseAngle: -Math.PI / 2, angleJitter: 0.3, flowerChance: 0.7 },
  { name: "shrub", depth: 3, branchChance: 0.82, branches: 2, lengthMul: 1, angleSpread: 0.5, baseAngle: -Math.PI / 2, angleJitter: 0.35, flowerChance: 1 },
  { name: "tree", depth: 4, branchChance: 0.88, branches: 2, lengthMul: 1.35, angleSpread: 0.32, baseAngle: -Math.PI / 2, angleJitter: 0.2, flowerChance: 0.85 },
  { name: "thicket", depth: 3, branchChance: 0.9, branches: 3, lengthMul: 0.85, angleSpread: 0.6, baseAngle: -Math.PI / 2, angleJitter: 0.4, flowerChance: 0.9 },
  { name: "vine", depth: 3, branchChance: 0.55, branches: 1, lengthMul: 0.9, angleSpread: 0.5, baseAngle: -Math.PI * 0.15, angleJitter: 0.8, flowerChance: 0.6 },
];

function growPlant(x: number, y: number, seed: number): Plant {
  const rand = makeRng(seed);
  const archetype = ARCHETYPES[Math.floor(rand() * ARCHETYPES.length)];
  const stemColor = STEM_COLORS[Math.floor(rand() * STEM_COLORS.length)];
  const segments: Segment[] = [];
  const flowers: Flower[] = [];
  let order = 0;

  function branch(sx: number, sy: number, angle: number, length: number, depth: number, width: number) {
    const steps = 7;
    let cx = sx;
    let cy = sy;
    let a = angle;
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * archetype.angleSpread * 0.6;
      const nx = cx + Math.cos(a) * (length / steps);
      const ny = cy + Math.sin(a) * (length / steps);
      segments.push({ x1: cx, y1: cy, x2: nx, y2: ny, width: width * (1 - (i / steps) * 0.35), order: order++, color: stemColor });
      cx = nx;
      cy = ny;
    }
    if (depth <= 0) {
      if (rand() < archetype.flowerChance) {
        flowers.push({ x: cx, y: cy, order: order++, color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)], r: 3 + rand() * 3.5 });
      }
      return;
    }
    const branchCount = depth > 1 && rand() < archetype.branchChance ? 1 + Math.floor(rand() * archetype.branches) : 1;
    for (let b = 0; b < branchCount; b++) {
      const side = branchCount === 1 ? (rand() < 0.5 ? -1 : 1) : b === 0 ? -1 : b === branchCount - 1 ? 1 : rand() < 0.5 ? -1 : 1;
      const branchAngle = a + side * (0.3 + rand() * archetype.angleSpread);
      branch(cx, cy, branchAngle, length * (0.55 + rand() * 0.22) * archetype.lengthMul, depth - 1, width * 0.62);
    }
  }

  const startLength = (26 + rand() * 30) * archetype.lengthMul;
  const startWidth = 3 + rand() * 2.2;
  branch(x, y, archetype.baseAngle + (rand() - 0.5) * archetype.angleJitter, startLength, archetype.depth, startWidth);

  return { segments, flowers, total: order, startTime: performance.now() };
}

export function InkGarden() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plantsRef = useRef<Plant[]>([]);
  const [plantCount, setPlantCount] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let raf = 0;
    let seedCounter = 1;
    let lastSpawn = 0;
    let dragging = false;
    const GROW_DURATION = 1500;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (width / rect.width);
      const y = (clientY - rect.top) * (height / rect.height);
      plantsRef.current.push(growPlant(x, y, seedCounter++));
      setPlantCount((n) => n + 1);
    }

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      spawn(e.clientX, e.clientY);
      lastSpawn = performance.now();
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const now = performance.now();
      if (now - lastSpawn > 170) {
        spawn(e.clientX, e.clientY);
        lastSpawn = now;
      }
    }
    function onPointerUp() {
      dragging = false;
    }

    function drawPlant(p: Plant) {
      const progress = reducedMotion.current ? 1 : Math.min(1, (performance.now() - p.startTime) / GROW_DURATION);
      const cutoff = progress * p.total;

      for (const seg of p.segments) {
        if (seg.order >= cutoff) continue;
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = seg.width;
        ctx.lineCap = "round";
        let { x2, y2 } = seg;
        if (seg.order + 1 > cutoff) {
          const frac = cutoff - seg.order;
          x2 = seg.x1 + (seg.x2 - seg.x1) * frac;
          y2 = seg.y1 + (seg.y2 - seg.y1) * frac;
        }
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      for (const f of p.flowers) {
        if (f.order > cutoff) continue;
        const bloom = Math.min(1, (cutoff - f.order) / 4 + 0.3);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * bloom, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function draw() {
      ctx.fillStyle = "#f0f1ed";
      ctx.fillRect(0, 0, width, height);
      for (const p of plantsRef.current) drawPlant(p);
      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  function clearGarden() {
    plantsRef.current = [];
    setPlantCount(0);
  }

  return (
    <ExperienceLayout title="Ink Garden" category="Interactive Art" accent="#9270b7" background="#f0f1ed" light>
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <p className={styles.hint}>
            Touch the page to grow something. A gentle tap makes something
            delicate; dragging around makes a denser forest of ink.
          </p>
          <div className={styles.readoutRow}>
            <span className={styles.readout}>{plantCount} grown</span>
            <button type="button" className={styles.clearButton} onClick={clearGarden}>
              New page
            </button>
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
