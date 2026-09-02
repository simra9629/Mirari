import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateLightCurve, planetHunterFacts } from "./data";
import styles from "./PlanetHunter.module.css";

export function PlanetHunter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(1);
  const curve = useMemo(() => generateLightCurve(level), [level]);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [missId, setMissId] = useState<number | null>(null);

  useEffect(() => {
    setConfirmed(new Set());
    setMissId(null);
  }, [curve]);

  const complete = confirmed.size === curve.transitCenters.length;

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    const minV = 1 - 0.09;
    const maxV = 1 + 0.03;

    function toY(v: number) {
      return height - ((v - minV) / (maxV - minV)) * height;
    }
    function toX(i: number) {
      return (i / (curve.samples.length - 1)) * width;
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.fillStyle = "#0a0f20";
      ctx.fillRect(0, 0, width, height);

      // Baseline.
      ctx.strokeStyle = "rgba(166, 188, 224, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, toY(1));
      ctx.lineTo(width, toY(1));
      ctx.stroke();

      // Confirmed transit highlight bands.
      for (const c of curve.transitCenters) {
        if (!confirmed.has(c)) continue;
        ctx.fillStyle = "rgba(143, 209, 138, 0.12)";
        ctx.fillRect(toX(c - curve.tolerance), 0, toX(c + curve.tolerance) - toX(c - curve.tolerance), height);
      }
      if (missId !== null) {
        ctx.fillStyle = "rgba(230, 100, 100, 0.14)";
        ctx.fillRect(toX(missId - curve.tolerance), 0, toX(missId + curve.tolerance) - toX(missId - curve.tolerance), height);
      }

      // Light curve.
      ctx.strokeStyle = "#5f9bff";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      curve.samples.forEach((v, i) => {
        const x = toX(i);
        const y = toY(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      for (const c of curve.transitCenters) {
        if (!confirmed.has(c)) continue;
        const x = toX(c);
        const y = toY(curve.samples[c]);
        ctx.fillStyle = "#8fd18a";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function onClick(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.round((x / rect.width) * (curve.samples.length - 1));

      let best: number | null = null;
      let bestDist = Infinity;
      for (const c of curve.transitCenters) {
        if (confirmed.has(c)) continue;
        const d = Math.abs(idx - c);
        if (d <= curve.tolerance && d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
      if (best !== null) {
        setConfirmed((prev) => new Set(prev).add(best!));
        return;
      }

      // Clicked near a decoy dip — give feedback so misses feel informative, not silent.
      for (const c of curve.decoyCenters) {
        if (Math.abs(idx - c) <= curve.tolerance) {
          setMissId(c);
          window.setTimeout(() => setMissId((cur) => (cur === c ? null : cur)), 500);
          break;
        }
      }
    }
    canvas.addEventListener("pointerdown", onClick);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, [curve, confirmed, missId]);

  const fact = planetHunterFacts[(level - 1) % planetHunterFacts.length];

  return (
    <ExperienceLayout title="Planet Hunter" category="Science · Observation" accent="#5F9BFF" background="#060a16">
      <div className={styles.stage}>
        <div className={styles.levelBadge}>Star {level}</div>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <p className={styles.progress}>
          {confirmed.size} / {curve.transitCenters.length} transits confirmed
        </p>
        <p className={styles.hint}>
          This star's brightness is mostly noise, and more than one dip will
          catch your eye — only the one that repeats at a steady interval is
          real. Click through a few repeats of the same gap to be sure.
        </p>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>Planet confirmed.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={() => setLevel((l) => l + 1)}>
                Point at the next star →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
