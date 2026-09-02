import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateInkPuzzle, inkFacts } from "./data";
import styles from "./Ink.module.css";

const WIN_THRESHOLD = 0.82;

export function Ink() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const puzzle = useMemo(() => generateInkPuzzle(level), [level]);
  const [revealed, setRevealed] = useState<boolean[][]>(() =>
    Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(false)),
  );
  const [drops, setDrops] = useState(puzzle.dropBudget);

  useEffect(() => {
    setRevealed(Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(false)));
    setDrops(puzzle.dropBudget);
  }, [puzzle]);

  const totalTarget = useMemo(
    () => puzzle.mask.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [puzzle],
  );
  const coveredTarget = useMemo(() => {
    let count = 0;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (puzzle.mask[r][c] && revealed[r][c]) count++;
      }
    }
    return count;
  }, [puzzle, revealed]);

  const coverage = totalTarget > 0 ? coveredTarget / totalTarget : 0;
  const complete = coverage >= WIN_THRESHOLD;

  function reset() {
    setRevealed(Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(false)));
    setDrops(puzzle.dropBudget);
  }

  function drop(r0: number, c0: number) {
    if (complete || drops <= 0) return;
    setRevealed((prev) => {
      const next = prev.map((row) => [...row]);
      for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
          if (Math.hypot(c - c0, r - r0) <= puzzle.revealRadius) next[r][c] = true;
        }
      }
      return next;
    });
    setDrops((d) => d - 1);
  }

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let cellSize = 20;
    let width = 0;
    let height = 0;

    function resize() {
      const wrap = canvas.parentElement!;
      const availW = wrap.clientWidth;
      const availH = wrap.clientHeight;
      cellSize = Math.floor(Math.min(availW / puzzle.cols, availH / puzzle.rows));
      width = cellSize * puzzle.cols;
      height = cellSize * puzzle.rows;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.fillStyle = "#12142a";
      ctx.fillRect(0, 0, width, height);
      for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
          const x = c * cellSize;
          const y = r * cellSize;
          if (revealed[r][c]) {
            if (puzzle.mask[r][c]) {
              ctx.fillStyle = "#e8c96f";
            } else {
              ctx.fillStyle = "#232752";
            }
          } else {
            ctx.fillStyle = "#181b38";
          }
          ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
        }
      }
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
      if (r < 0 || r >= puzzle.rows || c < 0 || c >= puzzle.cols) return;
      drop(r, c);
    }
    canvas.addEventListener("pointerdown", onClick);
    draw();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, revealed]);

  const fact = inkFacts[(level - 1) % inkFacts.length];

  return (
    <ExperienceLayout title="Ink" category="Puzzle" accent="#354D9B" background="#0a0b18">
      <div className={styles.stage}>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.statusRow}>
          <span className={styles.badge}>{drops} drops left</span>
          <span className={styles.badge}>{Math.round(coverage * 100)}% revealed</span>
        </div>
        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>A page, mostly blank</div>
          <p className={styles.hudPrompt}>
            Click to place a drop of ink — it spreads on its own. You have a
            limited supply; spend it where the hidden shape is likely to be.
          </p>
        </div>
        <div className={styles.resetRow}>
          <button type="button" className={styles.resetButton} onClick={reset}>
            Blot the page clean
          </button>
        </div>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>The shape comes through.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={() => setLevel((l) => l + 1)}>
                Turn the page →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
