import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateSignalPuzzle, patternBit, signalFacts } from "./data";
import styles from "./Signal.module.css";

export function Signal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const puzzle = useMemo(() => generateSignalPuzzle(level), [level]);
  const [freq, setFreq] = useState(50);
  const freqRef = useRef(freq);
  freqRef.current = freq;
  const [complete, setComplete] = useState(false);
  const completeRef = useRef(false);
  useEffect(() => {
    completeRef.current = complete;
  }, [complete]);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    setFreq(50);
    setComplete(false);
  }, [puzzle]);

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
    let cellW = 10;
    let cellH = 10;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellW = width / puzzle.cols;
      cellH = height / puzzle.rows;
    }

    function draw() {
      const alignment = Math.max(0, 1 - Math.abs(freqRef.current - puzzle.target) / puzzle.tolerance);
      const locked = alignment >= 0.97;
      if (locked !== completeRef.current) {
        completeRef.current = locked;
        setComplete(locked);
      }

      for (let y = 0; y < puzzle.rows; y++) {
        for (let x = 0; x < puzzle.cols; x++) {
          const bit = patternBit(x, y, puzzle);
          const trueVal = bit ? 0.85 : 0.15;
          const noiseVal = reducedMotion.current ? 0.5 : Math.random();
          const brightness = trueVal * alignment + noiseVal * (1 - alignment);
          const c = Math.round(brightness * 200 + 20);
          ctx.fillStyle = `rgb(${Math.round(c * 0.35)}, ${Math.round(c * 0.85)}, ${c})`;
          ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }

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
  }, [puzzle]);

  const fact = signalFacts[(level - 1) % signalFacts.length];

  return (
    <ExperienceLayout title="Signal" category="Puzzle" accent="#58D7E8" background="#050710">
      <div className={styles.stage}>
        <div className={styles.levelBadge}>Frequency {level}</div>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <div className={styles.sliderRow}>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={100}
            step={0.2}
            value={freq}
            onChange={(e) => setFreq(parseFloat(e.target.value))}
            aria-label="Tuning frequency"
          />
          <span className={styles.sliderValue}>{freq.toFixed(1)}</span>
        </div>
        <p className={styles.hint}>
          Somewhere in this static is a real, structured pattern. Turn the
          dial until it stops looking like noise.
        </p>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>Signal locked.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={() => setLevel((l) => l + 1)}>
                Scan the next frequency →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
