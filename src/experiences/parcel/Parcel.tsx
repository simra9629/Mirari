import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateDeliveryGrid, parcelFacts } from "./data";
import styles from "./Parcel.module.css";

interface Pos {
  row: number;
  col: number;
}

function sameCell(a: Pos, b: Pos) {
  return a.row === b.row && a.col === b.col;
}

export function Parcel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const grid = useMemo(() => generateDeliveryGrid(level), [level]);
  const [path, setPath] = useState<Pos[]>([grid.start]);
  const [carrying, setCarrying] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setPath([grid.start]);
    setCarrying(false);
    setComplete(false);
  }, [grid]);

  function reset() {
    setPath([grid.start]);
    setCarrying(false);
    setComplete(false);
  }

  function tryMoveTo(cell: Pos) {
    if (complete) return;
    if (grid.blocked[cell.row][cell.col]) return;

    const last = path[path.length - 1];
    const second = path.length > 1 ? path[path.length - 2] : null;

    if (second && sameCell(cell, second)) {
      const removed = path[path.length - 1];
      setPath((p) => p.slice(0, -1));
      if (sameCell(removed, grid.pickup)) setCarrying(false);
      return;
    }

    const adjacent = Math.abs(cell.row - last.row) + Math.abs(cell.col - last.col) === 1;
    if (!adjacent) return;
    if (path.some((p) => sameCell(p, cell))) return;

    const nextPath = [...path, cell];
    setPath(nextPath);
    if (sameCell(cell, grid.pickup)) setCarrying(true);
    if (sameCell(cell, grid.dropoff) && (carrying || sameCell(cell, grid.pickup))) {
      setComplete(true);
    }
  }

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let cellSize = 50;
    let width = 0;
    let height = 0;

    function resize() {
      const wrap = canvas.parentElement!;
      const available = Math.min(wrap.clientWidth, wrap.clientHeight);
      cellSize = Math.floor(available / Math.max(grid.cols, grid.rows));
      width = cellSize * grid.cols;
      height = cellSize * grid.rows;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const x0 = c * cellSize;
          const y0 = r * cellSize;
          if (grid.blocked[r][c]) {
            ctx.fillStyle = "#241512";
            ctx.fillRect(x0 + 1, y0 + 1, cellSize - 2, cellSize - 2);
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.035)";
            ctx.fillRect(x0 + 1, y0 + 1, cellSize - 2, cellSize - 2);
          }
        }
      }

      // Path line.
      if (path.length > 1) {
        ctx.strokeStyle = "#e6a06e";
        ctx.lineWidth = Math.max(4, cellSize * 0.14);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        path.forEach((p, i) => {
          const x = p.col * cellSize + cellSize / 2;
          const y = p.row * cellSize + cellSize / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // Start / depot.
      const sx = grid.start.col * cellSize + cellSize / 2;
      const sy = grid.start.row * cellSize + cellSize / 2;
      ctx.fillStyle = "#8fa6c4";
      ctx.fillRect(sx - cellSize * 0.18, sy - cellSize * 0.18, cellSize * 0.36, cellSize * 0.36);

      // Pickup.
      const pu = grid.pickup;
      const pux = pu.col * cellSize + cellSize / 2;
      const puy = pu.row * cellSize + cellSize / 2;
      const pickedUp = carrying || path.some((p) => sameCell(p, pu));
      ctx.fillStyle = pickedUp ? "rgba(230, 160, 110, 0.35)" : "#c77352";
      ctx.beginPath();
      ctx.arc(pux, puy, cellSize * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Dropoff.
      const dr = grid.dropoff;
      const drx = dr.col * cellSize + cellSize / 2;
      const dry = dr.row * cellSize + cellSize / 2;
      ctx.strokeStyle = complete ? "rgba(143, 209, 138, 0.9)" : "#e6a06e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(drx, dry - cellSize * 0.22);
      ctx.lineTo(drx + cellSize * 0.2, dry);
      ctx.lineTo(drx, dry + cellSize * 0.22);
      ctx.lineTo(drx - cellSize * 0.2, dry);
      ctx.closePath();
      ctx.stroke();

      // Truck (current path end).
      const end = path[path.length - 1];
      const ex = end.col * cellSize + cellSize / 2;
      const ey = end.row * cellSize + cellSize / 2;
      ctx.fillStyle = carrying ? "#e6a06e" : "#dfe4ea";
      ctx.beginPath();
      ctx.arc(ex, ey, cellSize * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    function onClick(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const c = Math.floor(x / cellSize);
      const r = Math.floor(y / cellSize);
      if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) return;
      tryMoveTo({ row: r, col: c });
    }
    canvas.addEventListener("pointerdown", onClick);
    draw();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, path, carrying, complete]);

  const fact = parcelFacts[(level - 1) % parcelFacts.length];

  return (
    <ExperienceLayout title="Parcel" category="Game" accent="#E64D4D" background="#140a09">
      <div className={styles.stage}>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.levelBadge}>Route {level}</div>
        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>Plan the route</div>
          <p className={styles.hudPrompt}>
            Click adjacent open cells to build a path — click back one step
            to undo. Reach the copper circle first, then the flag.
          </p>
        </div>
        <div className={styles.resetRow}>
          <button type="button" className={styles.resetButton} onClick={reset}>
            Reset route
          </button>
        </div>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>Delivered.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={() => setLevel((l) => l + 1)}>
                Next route →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
