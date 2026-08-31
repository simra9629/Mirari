import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Gravity.module.css";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
}

const BODIES: { name: string; g: number }[] = [
  { name: "the Moon", g: 1.62 },
  { name: "Mars", g: 3.71 },
  { name: "Earth", g: 9.8 },
  { name: "Saturn", g: 10.44 },
  { name: "Neptune", g: 11.15 },
  { name: "Jupiter", g: 24.79 },
];

function nearestBody(g: number) {
  let best = BODIES[0];
  let bestDiff = Infinity;
  for (const b of BODIES) {
    const diff = Math.abs(b.g - g);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = b;
    }
  }
  return best;
}

export function Gravity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gravity, setGravity] = useState(9.8);
  const gravityRef = useRef(9.8);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const clearSignal = useRef(0);

  useEffect(() => {
    gravityRef.current = gravity;
  }, [gravity]);

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
    let balls: Ball[] = [];
    let lastClearSignal = clearSignal.current;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let lastT = performance.now();
    const PIXELS_PER_METER = 60;
    const RESTITUTION = 0.62;

    function draw(t: number) {
      if (clearSignal.current !== lastClearSignal) {
        balls = [];
        lastClearSignal = clearSignal.current;
      }
      const dt = Math.min((t - lastT) / 1000, 0.032);
      lastT = t;

      ctx.clearRect(0, 0, width, height);

      // Floor line.
      ctx.strokeStyle = "rgba(124, 130, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 2);
      ctx.lineTo(width, height - 2);
      ctx.stroke();

      for (const ball of balls) {
        if (!reducedMotion.current) {
          ball.vy += gravityRef.current * PIXELS_PER_METER * dt;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          if (ball.y + ball.r > height) {
            ball.y = height - ball.r;
            ball.vy = -ball.vy * RESTITUTION;
            ball.vx *= 0.985;
            if (Math.abs(ball.vy) < 12) ball.vy = 0;
          }
          if (ball.x - ball.r < 0) {
            ball.x = ball.r;
            ball.vx = -ball.vx * RESTITUTION;
          }
          if (ball.x + ball.r > width) {
            ball.x = width - ball.r;
            ball.vx = -ball.vx * RESTITUTION;
          }
        }

        const gradient = ctx.createRadialGradient(
          ball.x - ball.r * 0.3,
          ball.y - ball.r * 0.3,
          0,
          ball.x,
          ball.y,
          ball.r,
        );
        gradient.addColorStop(0, `hsla(${ball.hue}, 85%, 78%, 1)`);
        gradient.addColorStop(1, `hsla(${ball.hue}, 75%, 55%, 1)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    function toLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function onClick(e: PointerEvent) {
      const p = toLocal(e.clientX, e.clientY);
      balls.push({
        x: p.x,
        y: p.y,
        vx: rand(-40, 40),
        vy: 0,
        r: rand(10, 20),
        hue: rand(230, 280),
      });
      if (balls.length > 80) balls.shift();
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, []);

  const nearest = nearestBody(gravity);
  const isCloseMatch = Math.abs(nearest.g - gravity) < 0.3;

  return (
    <ExperienceLayout
      title="What If Gravity Were Weaker?"
      category="Experiment"
      accent="#7C82FF"
      background="#0a0812"
    >
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>Click to drop something</div>
          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={0.5}
              max={30}
              step={0.1}
              value={gravity}
              onChange={(e) => setGravity(parseFloat(e.target.value))}
              aria-label="Gravity strength"
            />
            <span className={styles.gravityValue}>{gravity.toFixed(1)} m/s²</span>
          </div>
          <p className={styles.comparison}>
            {isCloseMatch
              ? `That's about the pull of ${nearest.name}.`
              : `Closest real match: ${nearest.name} (${nearest.g} m/s²).`}
          </p>
        </div>

        <div className={styles.resetRow}>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              clearSignal.current += 1;
            }}
          >
            Clear the field
          </button>
        </div>
      </div>
    </ExperienceLayout>
  );
}
