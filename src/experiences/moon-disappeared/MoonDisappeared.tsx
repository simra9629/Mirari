import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./MoonDisappeared.module.css";

interface Star {
  x: number;
  y: number;
  r: number;
  faint: boolean;
  phase: number;
}

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

function buildStars(): Star[] {
  const rand = makeRng(4242);
  return Array.from({ length: 130 }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    r: 0.4 + rand() * 1.4,
    faint: rand() < 0.55,
    phase: rand() * Math.PI * 2,
  }));
}

const STARS = buildStars();

export function MoonDisappeared() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [moonPresent, setMoonPresent] = useState(true);
  const moonPresentRef = useRef(true);
  const moonAmountRef = useRef(1);
  const [showMoonCaption, setShowMoonCaption] = useState(true);
  const captionStateRef = useRef(true);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    moonPresentRef.current = moonPresent;
  }, [moonPresent]);

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
    let tideClock = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      const target = moonPresentRef.current ? 1 : 0;
      if (reducedMotion.current) {
        moonAmountRef.current = target;
      } else {
        moonAmountRef.current += (target - moonAmountRef.current) * Math.min(1, dt * 1.6);
      }
      const aboveThreshold = moonAmountRef.current > 0.5;
      if (aboveThreshold !== captionStateRef.current) {
        captionStateRef.current = aboveThreshold;
        setShowMoonCaption(aboveThreshold);
      }
      if (!reducedMotion.current) tideClock += dt;
      else tideClock += 1 / 60;

      const skyH = height * 0.62;
      const moonAmount = moonAmountRef.current;

      // Night sky.
      const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      skyGrad.addColorStop(0, `rgb(${6 + moonAmount * 6},${9 + moonAmount * 10},${20 + moonAmount * 18})`);
      skyGrad.addColorStop(1, `rgb(${12 + moonAmount * 10},${16 + moonAmount * 14},${32 + moonAmount * 22})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, skyH);

      for (const s of STARS) {
        const twinkle = reducedMotion.current ? 1 : 0.7 + Math.sin(t / 900 + s.phase) * 0.3;
        // Moonlight washes out the faintest stars.
        const visibility = s.faint ? Math.max(0, 1 - moonAmount * 0.9) : 1;
        ctx.fillStyle = `rgba(240,244,255,${visibility * twinkle})`;
        ctx.beginPath();
        ctx.arc((s.x / 100) * width, (s.y / 100) * skyH, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (moonAmount > 0.01) {
        const mx = width * 0.72;
        const my = skyH * 0.28;
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 46);
        grad.addColorStop(0, `rgba(214,222,240,${moonAmount * 0.6})`);
        grad.addColorStop(1, "rgba(214,222,240,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(mx - 46, my - 46, 92, 92);
        ctx.fillStyle = `rgba(214,222,240,${moonAmount})`;
        ctx.beginPath();
        ctx.arc(mx, my, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tide gauge.
      const gaugeTop = skyH;
      const gaugeH = height - skyH;
      ctx.fillStyle = "#0d1420";
      ctx.fillRect(0, gaugeTop, width, gaugeH);

      const amplitude = 6 + moonAmount * 30;
      const baseLevel = gaugeTop + gaugeH * 0.5;
      const period = 7; // seconds per tide cycle, purely illustrative
      const level = baseLevel + Math.sin((tideClock / period) * Math.PI * 2) * amplitude;

      ctx.fillStyle = "#3a4a35";
      ctx.beginPath();
      ctx.moveTo(0, gaugeTop);
      ctx.lineTo(width * 0.32, gaugeTop);
      ctx.lineTo(width * 0.1, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(79,145,182,0.55)";
      ctx.fillRect(0, level, width, height - level);
      ctx.strokeStyle = "rgba(143,182,207,0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, level);
      ctx.lineTo(width, level);
      ctx.stroke();

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
  }, []);

  return (
    <ExperienceLayout title="What If the Moon Disappeared?" category="Experiment" accent="#7c82ff" background="#070a15">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <button type="button" className={styles.toggleButton} onClick={() => setMoonPresent((p) => !p)}>
            {moonPresent ? "Remove the Moon" : "Restore the Moon"}
          </button>
          <p className={styles.caption}>
            {showMoonCaption
              ? "The Moon is still here. Tides swing hard, twice a day, and the night sky has real light in it."
              : "No Moon. The night is darker — but look closely, there are more stars visible than before. The tides haven't stopped; they're just much weaker, driven by the Sun alone."}
          </p>
          <p className={styles.footnote}>
            Over a much longer timescale, bigger things would drift — Earth's
            spin, its tilt, its axis. None of that is simulated here. This is
            just the part you'd notice tonight.
          </p>
        </div>
      </div>
    </ExperienceLayout>
  );
}
