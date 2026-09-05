import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Constellation.module.css";

interface Star {
  x: number;
  y: number;
  size: number;
  twinklePhase: number;
}

interface Line {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  bornAt: number;
}

const LINE_LIFETIME = 26000;
const STAR_COUNT = 55;
const CATCH_RADIUS = 26;

export function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudFaded, setHudFaded] = useState(false);
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
    let stars: Star[] = [];
    const lines: Line[] = [];
    let dragStart: Star | null = null;
    let dragCurrent: { x: number; y: number } | null = null;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seed() {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: rand(0.05, 0.95) * width,
        y: rand(0.05, 0.95) * height,
        size: rand(1.4, 3.2),
        twinklePhase: Math.random() * Math.PI * 2,
      }));
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (stars.length === 0) seed();
    }

    function nearestStar(x: number, y: number): Star | null {
      let best: Star | null = null;
      let bestDist = CATCH_RADIUS;
      for (const s of stars) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      return best;
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height);

      // Stars.
      for (const s of stars) {
        const twinkle = reducedMotion.current ? 0.8 : 0.6 + Math.sin(t * 0.0012 + s.twinklePhase) * 0.35;
        ctx.fillStyle = `rgba(220, 226, 250, ${Math.max(0.2, twinkle)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Drawn lines, fading over time.
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const age = t - line.bornAt;
        if (age > LINE_LIFETIME) {
          lines.splice(i, 1);
          continue;
        }
        const alpha = 1 - age / LINE_LIFETIME;
        ctx.strokeStyle = `rgba(150, 165, 255, ${alpha * 0.65})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(line.ax, line.ay);
        ctx.lineTo(line.bx, line.by);
        ctx.stroke();
      }

      // Live preview line while dragging.
      if (dragStart && dragCurrent) {
        ctx.strokeStyle = "rgba(182, 185, 255, 0.5)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(dragCurrent.x, dragCurrent.y);
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
      const star = nearestStar(p.x, p.y);
      if (star) {
        dragStart = star;
        dragCurrent = p;
        setHudFaded(true);
      }
    }
    function onMove(e: PointerEvent) {
      if (!dragStart) return;
      dragCurrent = toLocal(e.clientX, e.clientY);
    }
    function onUp(e: PointerEvent) {
      if (!dragStart) return;
      const p = toLocal(e.clientX, e.clientY);
      const target = nearestStar(p.x, p.y);
      if (target && target !== dragStart) {
        lines.push({ ax: dragStart.x, ay: dragStart.y, bx: target.x, by: target.y, bornAt: performance.now() });
        if (lines.length > 60) lines.shift();
      }
      dragStart = null;
      dragCurrent = null;
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
    <ExperienceLayout title="Constellation" category="Interactive Art" accent="#718DFF" background="#05060f">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>A drawing made of light</div>
          <p className={styles.hudPrompt}>
            Drag from one star to another to connect them. Nothing you draw
            is right or wrong — and nothing stays for very long.
          </p>
        </div>
      </div>
    </ExperienceLayout>
  );
}
