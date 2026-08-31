import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { TOWN_NAMES, RAIL_FACTS, cellRandom } from "./data";
import styles from "./Railway.module.css";

interface Piece {
  x: number;
  y: number;
  heading: number;
}

const DIRS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
];

type TurnOption = { delta: -1 | 0 | 1; label: string };
const ALL_OPTIONS: TurnOption[] = [
  { delta: -1, label: "Curve left" },
  { delta: 0, label: "Straight" },
  { delta: 1, label: "Curve right" },
];

function pickTwo(): TurnOption[] {
  const shuffled = [...ALL_OPTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

function shuffledBag<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const MILESTONE_INTERVAL = 6;

export function Railway() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [track, setTrack] = useState<Piece[]>([{ x: 0, y: 0, heading: 0 }]);
  const [choices, setChoices] = useState<TurnOption[]>(pickTwo);
  const [milestone, setMilestone] = useState<{ town: string; fact: string } | null>(null);

  const townBag = useRef<string[]>([]);
  const factBag = useRef<string[]>([]);

  function place(delta: -1 | 0 | 1) {
    if (milestone) return;
    setTrack((prev) => {
      const last = prev[prev.length - 1];
      const heading = ((last.heading + delta) % 4 + 4) % 4;
      const dir = DIRS[heading];
      const next = [...prev, { x: last.x + dir.dx, y: last.y + dir.dy, heading }];
      const placedCount = next.length - 1;
      if (placedCount > 0 && placedCount % MILESTONE_INTERVAL === 0) {
        if (townBag.current.length === 0) townBag.current = shuffledBag(TOWN_NAMES);
        if (factBag.current.length === 0) factBag.current = shuffledBag(RAIL_FACTS);
        setMilestone({ town: townBag.current.pop()!, fact: factBag.current.pop()! });
      }
      return next;
    });
    setChoices(pickTwo());
  }

  function continueBuilding() {
    setMilestone(null);
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
    let raf = 0;
    const cellSize = 44;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const last = track[track.length - 1];
      const camX = width * 0.5;
      const camY = height * 0.6;

      ctx.clearRect(0, 0, width, height);

      function toScreen(x: number, y: number) {
        return { sx: camX + (x - last.x) * cellSize, sy: camY + (y - last.y) * cellSize };
      }

      // Deterministic scattered terrain around the visible window.
      const viewCells = Math.ceil(Math.max(width, height) / cellSize / 2) + 2;
      for (let dx = -viewCells; dx <= viewCells; dx++) {
        for (let dy = -viewCells; dy <= viewCells; dy++) {
          const wx = last.x + dx;
          const wy = last.y + dy;
          const r = cellRandom(wx, wy);
          const { sx, sy } = toScreen(wx, wy);
          if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
          if (r < 0.05) {
            ctx.fillStyle = "rgba(90, 140, 100, 0.35)";
            ctx.beginPath();
            ctx.moveTo(sx, sy - 6);
            ctx.lineTo(sx + 5, sy + 4);
            ctx.lineTo(sx - 5, sy + 4);
            ctx.closePath();
            ctx.fill();
          } else if (r > 0.96) {
            ctx.fillStyle = "rgba(120, 130, 90, 0.25)";
            ctx.beginPath();
            ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Track.
      ctx.strokeStyle = "#c54c4b";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      track.forEach((p, i) => {
        const { sx, sy } = toScreen(p.x, p.y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      // Ties.
      ctx.strokeStyle = "rgba(232, 220, 214, 0.5)";
      ctx.lineWidth = 2;
      for (let i = 1; i < track.length; i++) {
        const a = toScreen(track[i - 1].x, track[i - 1].y);
        const b = toScreen(track[i].x, track[i].y);
        const dx = b.sx - a.sx;
        const dy = b.sy - a.sy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const ties = 3;
        for (let t = 1; t <= ties; t++) {
          const px = a.sx + (dx * t) / (ties + 1);
          const py = a.sy + (dy * t) / (ties + 1);
          ctx.beginPath();
          ctx.moveTo(px - nx * 8, py - ny * 8);
          ctx.lineTo(px + nx * 8, py + ny * 8);
          ctx.stroke();
        }
      }

      // Start marker.
      const startScreen = toScreen(track[0].x, track[0].y);
      ctx.fillStyle = "#8fa6c4";
      ctx.beginPath();
      ctx.arc(startScreen.sx, startScreen.sy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Train at the frontier.
      ctx.fillStyle = "#e8dcd6";
      ctx.beginPath();
      ctx.arc(camX, camY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c54c4b";
      ctx.beginPath();
      ctx.arc(camX, camY, 4, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [track]);

  const placedCount = track.length - 1;

  return (
    <ExperienceLayout title="The Railway" category="Game" accent="#C64C4B" background="#0c1710">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.milestoneBadge}>{placedCount} miles of track laid</div>
        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>Build as you go</div>
          <p className={styles.hudPrompt}>
            Pick the next stretch of track. There's no fixed destination —
            just the next town, and the one after that.
          </p>
        </div>

        {!milestone && (
          <div className={styles.choiceRow}>
            {choices.map((opt) => (
              <button key={opt.label} type="button" className={styles.choiceButton} onClick={() => place(opt.delta)}>
                <span className={styles.choiceLabel}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {milestone && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>You've reached {milestone.town}.</div>
              <p className={styles.completeFact}>{milestone.fact}</p>
              <button type="button" className={styles.nextButton} onClick={continueBuilding}>
                Keep building →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
