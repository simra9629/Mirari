import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateMaze } from "../last-firefly/maze";
import styles from "./PaperCity.module.css";

type Pattern = [boolean, boolean, boolean, boolean]; // top, right, bottom, left

function rotateCW(p: Pattern, times: number): Pattern {
  let cur = p;
  for (let t = 0; t < ((times % 4) + 4) % 4; t++) {
    cur = [cur[3], cur[0], cur[1], cur[2]];
  }
  return cur;
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FACTS = [
  "Origami engineers now help design real fold-out architecture — solar panels, stents, even emergency shelters that pack flat and pop into shape.",
  "Kirigami — paper craft that allows cuts as well as folds — has inspired flexible solar cells that stretch by folding open like a pop-up book.",
  "The Miura fold, developed for satellite solar panels, unfolds and refolds along a single motion — no panel ever has to twist against another.",
];

export function PaperCity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const [complete, setComplete] = useState(false);

  const size = Math.min(4 + Math.floor((level - 1) / 2), 8);
  const maze = useMemo(() => generateMaze(size, size, level * 6113 + 31), [size, level]);

  const truePatterns = useMemo(() => {
    const patterns: Pattern[][] = [];
    for (let r = 0; r < maze.rows; r++) {
      const row: Pattern[] = [];
      for (let c = 0; c < maze.cols; c++) {
        const cell = maze.cells[r][c];
        row.push([!cell.top, !cell.right, !cell.bottom, !cell.left]);
      }
      patterns.push(row);
    }
    return patterns;
  }, [maze]);

  const [offsets, setOffsets] = useState<number[][]>(() => {
    const rand = makeRng(level * 4177 + 91);
    return truePatterns.map((row) => row.map(() => Math.floor(rand() * 4)));
  });

  useEffect(() => {
    const rand = makeRng(level * 4177 + 91);
    setOffsets(truePatterns.map((row) => row.map(() => Math.floor(rand() * 4))));
    setComplete(false);
  }, [truePatterns, level]);

  useEffect(() => {
    const solved = offsets.every((row) => row.every((o) => o === 0));
    if (solved) setComplete(true);
  }, [offsets]);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    const cols = maze.cols;
    const rows = maze.rows;
    let cellSize = 60;
    let width = 0;
    let height = 0;

    function resize() {
      const wrap = canvas.parentElement!;
      const available = Math.min(wrap.clientWidth, wrap.clientHeight);
      cellSize = Math.floor(available / Math.max(cols, rows));
      width = cellSize * cols;
      height = cellSize * rows;
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
      const currentOffsets = offsets;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = c * cellSize;
          const y0 = r * cellSize;
          const pattern = rotateCW(truePatterns[r][c], currentOffsets[r][c]);
          const solvedTile = currentOffsets[r][c] === 0;

          ctx.fillStyle = solvedTile ? "rgba(127, 160, 201, 0.14)" : "rgba(255,255,255,0.03)";
          ctx.fillRect(x0 + 2, y0 + 2, cellSize - 4, cellSize - 4);
          ctx.strokeStyle = "rgba(127, 160, 201, 0.25)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 + 2, y0 + 2, cellSize - 4, cellSize - 4);
          // Fold crease.
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.beginPath();
          ctx.moveTo(x0 + 2, y0 + 2);
          ctx.lineTo(x0 + cellSize - 2, y0 + cellSize - 2);
          ctx.stroke();

          const cx = x0 + cellSize / 2;
          const cy = y0 + cellSize / 2;
          const roadLen = cellSize * 0.42;
          ctx.strokeStyle = solvedTile ? "#e8c96f" : "#7fa0c9";
          ctx.lineWidth = Math.max(4, cellSize * 0.11);
          ctx.lineCap = "round";
          ctx.beginPath();
          if (pattern[0]) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy - roadLen);
          }
          if (pattern[1]) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + roadLen, cy);
          }
          if (pattern[2]) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy + roadLen);
          }
          if (pattern[3]) {
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx - roadLen, cy);
          }
          ctx.stroke();
          ctx.fillStyle = solvedTile ? "#e8c96f" : "#7fa0c9";
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Connection glow across matched internal edges.
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pattern = rotateCW(truePatterns[r][c], currentOffsets[r][c]);
          if (c < cols - 1) {
            const rightPattern = rotateCW(truePatterns[r][c + 1], currentOffsets[r][c + 1]);
            if (pattern[1] && rightPattern[3]) {
              const x = (c + 1) * cellSize;
              const y = r * cellSize + cellSize / 2;
              ctx.strokeStyle = "rgba(232, 201, 111, 0.6)";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(x - 6, y);
              ctx.lineTo(x + 6, y);
              ctx.stroke();
            }
          }
          if (r < rows - 1) {
            const downPattern = rotateCW(truePatterns[r + 1][c], currentOffsets[r + 1][c]);
            if (pattern[2] && downPattern[0]) {
              const x = c * cellSize + cellSize / 2;
              const y = (r + 1) * cellSize;
              ctx.strokeStyle = "rgba(232, 201, 111, 0.6)";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(x, y - 6);
              ctx.lineTo(x, y + 6);
              ctx.stroke();
            }
          }
        }
      }
    }

    function onClick(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const c = Math.floor(x / cellSize);
      const r = Math.floor(y / cellSize);
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      setOffsets((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = (next[r][c] + 1) % 4;
        return next;
      });
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    canvas.addEventListener("pointerdown", onClick);
    draw();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, [maze, truePatterns, offsets]);

  const fact = FACTS[(level - 1) % FACTS.length];

  return (
    <ExperienceLayout
      title="Paper City"
      category="Game"
      accent="#7FA0C9"
      background="#0c1420"
    >
      <div className={styles.stage}>
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.levelBadge}>Fold {level}</div>
        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>A city, folded wrong</div>
          <p className={styles.hudPrompt}>
            Click a block to rotate it. Connect every road — gold means the
            roads on both sides actually meet.
          </p>
        </div>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>The city reconnects.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={() => setLevel((l) => l + 1)}>
                Unfold the next city →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
