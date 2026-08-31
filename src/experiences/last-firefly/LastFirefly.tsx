import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateMaze } from "./maze";
import styles from "./LastFirefly.module.css";

type Dir = "top" | "right" | "bottom" | "left";

const FACTS = [
  "Fireflies don't glow to find their way — the light is a signal, usually to attract a mate, with each species flashing its own distinct pattern.",
  "A firefly's light is one of the most efficient light sources known — nearly 100% of the energy becomes light, almost none becomes heat.",
  "Firefly larvae glow too, long before they can fly — some call them 'glowworms' at that stage of their lives.",
];

export function LastFirefly() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const [complete, setComplete] = useState(false);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const maze = useMemo(() => {
    const size = Math.min(7 + level, 16);
    return generateMaze(size, size, level * 7919 + 13);
  }, [level]);

  const playerCell = useRef({ row: maze.start.row, col: maze.start.col });
  const playerPos = useRef({ x: maze.start.col, y: maze.start.row });
  const completeRef = useRef(false);

  useEffect(() => {
    playerCell.current = { row: maze.start.row, col: maze.start.col };
    playerPos.current = { x: maze.start.col, y: maze.start.row };
    completeRef.current = false;
    setComplete(false);
  }, [maze]);

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
    let cellSize = 20;
    let offsetX = 0;
    let offsetY = 0;
    const lightRadius = Math.max(2.6 - level * 0.05, 1.9);

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 40;
      cellSize = Math.min((width - pad * 2) / maze.cols, (height - pad * 2) / maze.rows);
      offsetX = (width - cellSize * maze.cols) / 2;
      offsetY = (height - cellSize * maze.rows) / 2;
    }

    function canMove(dir: Dir) {
      const cell = maze.cells[playerCell.current.row][playerCell.current.col];
      return !cell[dir];
    }

    function move(dir: Dir) {
      if (completeRef.current) return;
      if (!canMove(dir)) return;
      const { row, col } = playerCell.current;
      const next =
        dir === "top" ? { row: row - 1, col } : dir === "bottom" ? { row: row + 1, col } : dir === "left" ? { row, col: col - 1 } : { row, col: col + 1 };
      playerCell.current = next;
      if (next.row === maze.goal.row && next.col === maze.goal.col) {
        completeRef.current = true;
        setComplete(true);
      }
    }

    function draw() {
      if (!reducedMotion.current) {
        playerPos.current.x += (playerCell.current.col - playerPos.current.x) * 0.25;
        playerPos.current.y += (playerCell.current.row - playerPos.current.y) * 0.25;
      } else {
        playerPos.current.x = playerCell.current.col;
        playerPos.current.y = playerCell.current.row;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#030402";
      ctx.fillRect(0, 0, width, height);

      const px = offsetX + (playerPos.current.x + 0.5) * cellSize;
      const py = offsetY + (playerPos.current.y + 0.5) * cellSize;

      // Faint distant hint of the goal, visible even through the dark.
      const goalX = offsetX + (maze.goal.col + 0.5) * cellSize;
      const goalY = offsetY + (maze.goal.row + 0.5) * cellSize;
      const goalDist = Math.hypot(goalX - px, goalY - py) / cellSize;
      const distantAlpha = Math.max(0, 0.16 - goalDist * 0.006);
      if (distantAlpha > 0.01) {
        ctx.fillStyle = `rgba(255, 216, 107, ${distantAlpha})`;
        ctx.beginPath();
        ctx.arc(goalX, goalY, cellSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Maze walls, lit only near the player.
      ctx.lineCap = "round";
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          const dist = Math.hypot(c - playerPos.current.x, r - playerPos.current.y);
          if (dist > lightRadius + 0.7) continue;
          const alpha = Math.max(0, Math.min(1, 1 - (dist - lightRadius + 0.7) / 1.4));
          const cell = maze.cells[r][c];
          const x0 = offsetX + c * cellSize;
          const y0 = offsetY + r * cellSize;
          ctx.strokeStyle = `rgba(216, 224, 200, ${0.5 * alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (cell.top) {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + cellSize, y0);
          }
          if (cell.right) {
            ctx.moveTo(x0 + cellSize, y0);
            ctx.lineTo(x0 + cellSize, y0 + cellSize);
          }
          if (cell.bottom) {
            ctx.moveTo(x0, y0 + cellSize);
            ctx.lineTo(x0 + cellSize, y0 + cellSize);
          }
          if (cell.left) {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0, y0 + cellSize);
          }
          ctx.stroke();

          if (r === maze.goal.row && c === maze.goal.col && alpha > 0) {
            ctx.fillStyle = `rgba(255, 216, 107, ${0.6 * alpha})`;
            ctx.beginPath();
            ctx.arc(x0 + cellSize / 2, y0 + cellSize / 2, cellSize * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // The firefly.
      const glow = ctx.createRadialGradient(px, py, 0, px, py, cellSize * lightRadius * 0.9);
      glow.addColorStop(0, "rgba(255, 226, 154, 0.16)");
      glow.addColorStop(1, "rgba(255, 226, 154, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, cellSize * lightRadius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffe29a";
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.14, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") move("top");
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") move("bottom");
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") move("left");
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") move("right");
      else return;
      e.preventDefault();
    }

    let touchStart: { x: number; y: number } | null = null;
    function onPointerDown(e: PointerEvent) {
      touchStart = { x: e.clientX, y: e.clientY };
    }
    function onPointerUp(e: PointerEvent) {
      if (!touchStart) return;
      const dx = e.clientX - touchStart.x;
      const dy = e.clientY - touchStart.y;
      touchStart = null;
      if (Math.hypot(dx, dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
      else move(dy > 0 ? "bottom" : "top");
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, [maze, level]);

  function nextDarkness() {
    setLevel((l) => l + 1);
  }

  const fact = FACTS[(level - 1) % FACTS.length];

  return (
    <ExperienceLayout
      title="The Last Firefly"
      category="Game"
      accent="#FFD86B"
      background="#030402"
    >
      <div ref={containerRef} className={styles.stage} tabIndex={-1}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.levelBadge}>Darkness {level}</div>
        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>Carry the light home</div>
          <p className={styles.hudPrompt}>
            Arrow keys or WASD to move — or swipe. Your light only reaches so
            far. Somewhere out there, very faint, is home.
          </p>
        </div>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>You made it home.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={nextDarkness}>
                Into the next darkness →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
