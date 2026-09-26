import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateMaze } from "./maze";
import { DECOY_LINES, FOUND_LINES } from "./data";
import styles from "./TheSock.module.css";

type Dir = "top" | "right" | "bottom" | "left";

// Scrambles the seed before it enters the LCG below. A plain LCG's very
// first output is a smooth function of the seed, so sequential seeds
// (level * k + c) would otherwise produce long runs of near-identical
// early results — this hash breaks that up.
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

function cellKey(row: number, col: number) {
  return `${row},${col}`;
}

const STATIC_TIERS = [
  "No static at all yet.",
  "The faintest crackle of static.",
  "Static's building — you're headed the right way.",
  "Strong static now. Close.",
  "Crackling. It's right nearby.",
];

export function TheSock() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [searchCount, setSearchCount] = useState(1);
  const [found, setFound] = useState(false);
  const [decoyCaption, setDecoyCaption] = useState<string | null>(null);
  const [decoysSeen, setDecoysSeen] = useState(0);
  const [staticLevel, setStaticLevel] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const maze = useMemo(() => {
    const size = Math.min(7 + searchCount, 13);
    return generateMaze(size, size, searchCount * 7919 + 13);
  }, [searchCount]);

  const decoyCells = useMemo(() => {
    const rand = makeRng(searchCount * 104729 + 51);
    const shuffled = [...maze.deadEnds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(3, shuffled.length));
  }, [maze, searchCount]);

  const playerCell = useRef({ row: maze.start.row, col: maze.start.col });
  const playerPos = useRef({ x: maze.start.col, y: maze.start.row });
  const foundRef = useRef(false);
  const collectedDecoys = useRef<Set<string>>(new Set());
  const visitedCells = useRef<Set<string>>(new Set([cellKey(maze.start.row, maze.start.col)]));

  useEffect(() => {
    playerCell.current = { row: maze.start.row, col: maze.start.col };
    playerPos.current = { x: maze.start.col, y: maze.start.row };
    foundRef.current = false;
    collectedDecoys.current = new Set();
    visitedCells.current = new Set([cellKey(maze.start.row, maze.start.col)]);
    setFound(false);
    setDecoyCaption(null);
    setDecoysSeen(0);
    setStaticLevel(0);
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
    let sparks: { x: number; y: number; a: number; vx: number; vy: number }[] = [];

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 30;
      cellSize = Math.min((width - pad * 2) / maze.cols, (height - pad * 2) / maze.rows);
      offsetX = (width - cellSize * maze.cols) / 2;
      offsetY = (height - cellSize * maze.rows) / 2;
    }

    function canMove(dir: Dir) {
      const cell = maze.cells[playerCell.current.row][playerCell.current.col];
      return !cell[dir];
    }

    function markVisited(row: number, col: number) {
      visitedCells.current.add(cellKey(row, col));
      const cell = maze.cells[row][col];
      // Touching a cell also reveals what's directly through any open doorway,
      // the way feeling around a corner tells you a little about the next room.
      if (!cell.top && row > 0) visitedCells.current.add(cellKey(row - 1, col));
      if (!cell.right && col < maze.cols - 1) visitedCells.current.add(cellKey(row, col + 1));
      if (!cell.bottom && row < maze.rows - 1) visitedCells.current.add(cellKey(row + 1, col));
      if (!cell.left && col > 0) visitedCells.current.add(cellKey(row, col - 1));
    }

    function move(dir: Dir) {
      if (foundRef.current) return;
      if (!canMove(dir)) return;
      const { row, col } = playerCell.current;
      const next =
        dir === "top" ? { row: row - 1, col } : dir === "bottom" ? { row: row + 1, col } : dir === "left" ? { row, col: col - 1 } : { row, col: col + 1 };
      playerCell.current = next;
      markVisited(next.row, next.col);

      const closeness = 1 - maze.distanceToGoal[next.row][next.col] / Math.max(1, maze.maxDistance);
      const tier = Math.min(STATIC_TIERS.length - 1, Math.floor(closeness * STATIC_TIERS.length));
      setStaticLevel(tier);

      const decoyHit = decoyCells.find((d) => d.row === next.row && d.col === next.col);
      if (decoyHit) {
        const key = cellKey(decoyHit.row, decoyHit.col);
        if (!collectedDecoys.current.has(key)) {
          collectedDecoys.current.add(key);
          const line = DECOY_LINES[Math.floor(Math.random() * DECOY_LINES.length)];
          setDecoyCaption(line);
          setDecoysSeen(collectedDecoys.current.size);
        }
      }

      if (next.row === maze.goal.row && next.col === maze.goal.col) {
        foundRef.current = true;
        setFound(true);
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
      ctx.fillStyle = "#0c0e13";
      ctx.fillRect(0, 0, width, height);

      const px = offsetX + (playerPos.current.x + 0.5) * cellSize;
      const py = offsetY + (playerPos.current.y + 0.5) * cellSize;
      const closeness = Math.max(
        0,
        1 - maze.distanceToGoal[playerCell.current.row][playerCell.current.col] / Math.max(1, maze.maxDistance),
      );

      // Walls: touched cells stay in memory (dim); the current cell and its
      // immediate doorways are drawn brighter, like feeling the room by hand.
      ctx.lineCap = "round";
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          const key = cellKey(r, c);
          if (!visitedCells.current.has(key)) continue;
          const isCurrent = r === playerCell.current.row && c === playerCell.current.col;
          const isAdjacent = Math.abs(r - playerCell.current.row) + Math.abs(c - playerCell.current.col) === 1;
          const alpha = isCurrent || isAdjacent ? 0.6 : 0.22;
          const cell = maze.cells[r][c];
          const x0 = offsetX + c * cellSize;
          const y0 = offsetY + r * cellSize;
          ctx.strokeStyle = `rgba(180, 190, 210, ${alpha})`;
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

          // The other sock, only once you've actually reached that spot.
          if (r === maze.goal.row && c === maze.goal.col) {
            drawSock(ctx, x0 + cellSize / 2, y0 + cellSize / 2, cellSize * 0.32, "#e6b968", isCurrent || isAdjacent ? 1 : 0.4);
          }

          const decoy = decoyCells.find((d) => d.row === r && d.col === c);
          if (decoy) {
            const collected = collectedDecoys.current.has(cellKey(r, c));
            drawSock(ctx, x0 + cellSize / 2, y0 + cellSize / 2, cellSize * 0.26, collected ? "#5a6272" : "#8b93a3", alpha + 0.3);
          }
        }
      }

      // Static sparks, more frequent the closer you are.
      if (!reducedMotion.current && closeness > 0.4 && Math.random() < closeness * 0.35) {
        const a = Math.random() * Math.PI * 2;
        sparks.push({ x: px, y: py, a: 1, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 });
      }
      sparks = sparks.filter((s) => s.a > 0.02);
      for (const s of sparks) {
        s.x += s.vx * 0.016;
        s.y += s.vy * 0.016;
        s.a -= 0.04;
        ctx.fillStyle = `rgba(230, 185, 104, ${Math.max(0, s.a)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // A static-cling glow around your own sock — the closer, the warmer.
      if (closeness > 0.02) {
        const glow = ctx.createRadialGradient(px, py, 0, px, py, cellSize * 1.8);
        glow.addColorStop(0, `rgba(230, 185, 104, ${closeness * 0.3})`);
        glow.addColorStop(1, "rgba(230, 185, 104, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Your sock.
      drawSock(ctx, px, py, cellSize * 0.3, "#8fa6c9", 1);

      raf = requestAnimationFrame(draw);
    }

    function drawSock(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.beginPath();
      // A simple rounded sock silhouette: a leg and a foot.
      c.moveTo(x - r * 0.35, y - r);
      c.lineTo(x + r * 0.35, y - r);
      c.lineTo(x + r * 0.35, y + r * 0.1);
      c.quadraticCurveTo(x + r * 0.35, y + r * 0.75, x + r * 1.05, y + r * 0.75);
      c.quadraticCurveTo(x + r * 1.25, y + r * 0.75, x + r * 1.1, y + r * 1.05);
      c.quadraticCurveTo(x + r * 0.6, y + r * 1.15, x - r * 0.35, y + r * 0.9);
      c.closePath();
      c.fill();
      c.restore();
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
  }, [maze, searchCount, decoyCells]);

  function searchAnotherDrawer() {
    setSearchCount((s) => s + 1);
  }

  const foundLine = FOUND_LINES[(searchCount - 1) % FOUND_LINES.length];

  return (
    <ExperienceLayout title="The Sock" category="Strange Thing" accent="#8fa6c9" background="#0c0e13">
      <div className={styles.stage} tabIndex={-1}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.levelBadge}>Drawer {searchCount}</div>

        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>You are a sock. Somewhere in here is your other half.</div>
          <p className={styles.hudPrompt}>
            Arrow keys or WASD to move — or swipe. There's no light down
            here — you're feeling your way by touch, and by static.
          </p>
          <div className={styles.staticMeter}>
            <div className={styles.staticBar}>
              <div className={styles.staticFill} style={{ width: `${(staticLevel / (STATIC_TIERS.length - 1)) * 100}%` }} />
            </div>
            <div className={styles.staticLabel}>{STATIC_TIERS[staticLevel]}</div>
          </div>
          {decoysSeen > 0 && (
            <div className={styles.readout}>{decoysSeen} other lost sock{decoysSeen === 1 ? "" : "s"} found along the way</div>
          )}
        </div>

        {decoyCaption && !found && (
          <button type="button" className={styles.decoyToast} onClick={() => setDecoyCaption(null)}>
            {decoyCaption}
          </button>
        )}

        {found && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>Found each other.</div>
              <p className={styles.completeText}>{foundLine}</p>
              <button type="button" className={styles.nextButton} onClick={searchAnotherDrawer}>
                Search a new drawer →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
