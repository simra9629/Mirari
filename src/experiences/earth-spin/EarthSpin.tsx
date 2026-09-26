import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./EarthSpin.module.css";

const BASE_CYCLE_SECONDS = 16; // real seconds per simulated day at 1x

const TIER_CAPTIONS: Record<number, string> = {
  1: "This is how it already works — a day and a night, each about twelve hours.",
  2: "Every day is about 12 hours now. You'd see a sunrise and sunset twice as often as today.",
  3: "Down to an 8-hour day. Wind patterns would reshape themselves around the added spin.",
  4: "6-hour days. Well past a simplified demonstration now — the planet is spinning hard enough to matter.",
  5: "Under 5 hours a day. The equator is moving fast enough to noticeably fling the atmosphere outward.",
  6: "Just under 4 hours a day. At real speeds anywhere near this, the planet would be reshaping itself.",
};

function skyColor(hourFrac: number): { top: string; bottom: string } {
  // hourFrac: 0 = midnight, 0.5 = noon.
  const daylight = Math.sin(hourFrac * Math.PI * 2 - Math.PI / 2); // -1 at midnight, 1 at noon
  const t = (daylight + 1) / 2;
  const topR = Math.round(10 + t * 70);
  const topG = Math.round(14 + t * 130);
  const topB = Math.round(30 + t * 180);
  const botR = Math.round(20 + t * 160);
  const botG = Math.round(26 + t * 180);
  const botB = Math.round(45 + t * 190);
  return { top: `rgb(${topR},${topG},${topB})`, bottom: `rgb(${botR},${botG},${botB})` };
}

export function EarthSpin() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(1);
  const [hourLabel, setHourLabel] = useState("12:00");
  const [dayCount, setDayCount] = useState(0);
  const speedRef = useRef(speed);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

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
    let elapsed = 0;

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

      if (!reducedMotion.current) {
        elapsed += dt;
      } else {
        elapsed += 1 / 60; // advance a fixed nominal amount so it isn't frozen at noon forever
      }

      const cycleSeconds = BASE_CYCLE_SECONDS / speedRef.current;
      const cycles = elapsed / cycleSeconds;
      const hourFrac = cycles % 1;
      const day = Math.floor(cycles);

      const hr = Math.floor(hourFrac * 24);
      const min = Math.floor((hourFrac * 24 * 60) % 60);
      setHourLabel(`${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
      setDayCount(day);

      const groundY = height * 0.78;
      const { top, bottom } = skyColor(hourFrac);
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, top);
      sky.addColorStop(1, bottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, groundY);

      // Sun/moon arc: noon at hourFrac 0.5 (top of arc), midnight at 0 (below horizon).
      const angle = hourFrac * Math.PI * 2 - Math.PI / 2;
      const arcX = width / 2 + Math.cos(angle) * width * 0.4;
      const arcY = groundY - Math.sin(angle) * groundY * 0.75;
      const isDay = Math.sin(angle) > -0.15;
      if (isDay) {
        const grad = ctx.createRadialGradient(arcX, arcY, 0, arcX, arcY, 60);
        grad.addColorStop(0, "rgba(255,226,154,0.9)");
        grad.addColorStop(1, "rgba(255,226,154,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(arcX - 60, arcY - 60, 120, 120);
        ctx.fillStyle = "#ffe29a";
        ctx.beginPath();
        ctx.arc(arcX, arcY, 16, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#d6dcec";
        ctx.beginPath();
        ctx.arc(arcX, arcY, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ground and a small hill silhouette.
      ctx.fillStyle = "#1b2a20";
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= width; x += 20) {
        ctx.lineTo(x, groundY - 14 * Math.sin(x / 160 + 1));
      }
      ctx.lineTo(width, groundY);
      ctx.closePath();
      ctx.fillStyle = "#243a2c";
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
  }, []);

  const dayHours = (24 / speed).toFixed(1);

  return (
    <ExperienceLayout title="What If Earth Rotated Twice as Fast?" category="Experiment" accent="#5f9bff" background="#0b0f18">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <div className={styles.clock}>{hourLabel}</div>
          <div className={styles.dayReadout}>Day {dayCount} · {dayHours}-hour days</div>
          <p className={styles.caption}>{TIER_CAPTIONS[speed]}</p>
          <input
            type="range"
            className={styles.slider}
            min={1}
            max={6}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            aria-label="Rotation speed"
          />
          <div className={styles.sliderLabel}>Rotation speed: {speed}×</div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
