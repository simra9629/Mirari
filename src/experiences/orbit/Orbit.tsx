import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Orbit.module.css";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  trail: { x: number; y: number }[];
}

const GM = 1_800_000; // tuned gravitational parameter for a satisfying pixel-scale orbit
const PLANET_RADIUS = 26;
const TRAIL_LENGTH = 160;
const VELOCITY_SCALE = 2.4;

export function Orbit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudFaded, setHudFaded] = useState(false);
  const [count, setCount] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

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
    let bodies: Body[] = [];
    let planet = { x: 0, y: 0 };
    let drag: { startX: number; startY: number; curX: number; curY: number } | null = null;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      planet = { x: width / 2, y: height / 2 };
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.032);
      lastT = t;

      ctx.clearRect(0, 0, width, height);

      // Planet glow + body.
      const glow = ctx.createRadialGradient(planet.x, planet.y, 0, planet.x, planet.y, PLANET_RADIUS * 4);
      glow.addColorStop(0, "rgba(94, 140, 255, 0.35)");
      glow.addColorStop(1, "rgba(94, 140, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, PLANET_RADIUS * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#5e8cff";
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, PLANET_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      const escapeRadius = Math.max(width, height) * 0.85;

      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];

        if (!reducedMotion.current) {
          const dx = planet.x - b.x;
          const dy = planet.y - b.y;
          const distSq = Math.max(dx * dx + dy * dy, 900);
          const dist = Math.sqrt(distSq);
          const accel = GM / distSq;
          b.vx += (accel * dx) / dist * dt;
          b.vy += (accel * dy) / dist * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > TRAIL_LENGTH) b.trail.shift();

          if (dist < PLANET_RADIUS + b.r) {
            bodies.splice(i, 1);
            continue;
          }
          if (dist > escapeRadius) {
            bodies.splice(i, 1);
            continue;
          }
        }

        // Trail.
        ctx.beginPath();
        for (let p = 0; p < b.trail.length; p++) {
          const pt = b.trail[p];
          if (p === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = `hsla(${b.hue}, 85%, 70%, 0.35)`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = `hsla(${b.hue}, 85%, 72%, 1)`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      setCount(bodies.length);

      // Drag preview.
      if (drag) {
        ctx.beginPath();
        ctx.moveTo(drag.startX, drag.startY);
        ctx.lineTo(drag.curX, drag.curY);
        ctx.strokeStyle = "rgba(219, 228, 251, 0.6)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      raf = requestAnimationFrame(draw);
    }

    function toLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function onDown(e: PointerEvent) {
      const p = toLocal(e.clientX, e.clientY);
      drag = { startX: p.x, startY: p.y, curX: p.x, curY: p.y };
    }

    function onMove(e: PointerEvent) {
      if (!drag) return;
      const p = toLocal(e.clientX, e.clientY);
      drag.curX = p.x;
      drag.curY = p.y;
    }

    function onUp() {
      if (!drag) return;
      const vx = (drag.startX - drag.curX) * VELOCITY_SCALE;
      const vy = (drag.startY - drag.curY) * VELOCITY_SCALE;
      bodies.push({
        x: drag.startX,
        y: drag.startY,
        vx,
        vy,
        r: rand(3, 5.5),
        hue: rand(190, 260),
        trail: [],
      });
      if (bodies.length > 25) bodies.shift();
      drag = null;
      setHudFaded(true);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <ExperienceLayout
      title="Orbit"
      category="Game"
      accent="#5E8CFF"
      background="#04050f"
    >
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>A planet, and empty space</div>
          <p className={styles.hudPrompt}>
            Drag and release to launch something. Aim for orbit, not impact —
            too fast and it escapes, too slow and it falls in.
          </p>
        </div>
        <div className={styles.counter}>{count} in orbit</div>
      </div>
    </ExperienceLayout>
  );
}
