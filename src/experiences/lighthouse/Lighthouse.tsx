import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Lighthouse.module.css";

interface Ship {
  x: number;
  y: number;
  speed: number;
  dir: 1 | -1;
  size: number;
  illumTime: number;
  seen: boolean;
}

const BEAM_HALF_WIDTH = 0.13; // radians
const BEAM_LENGTH_FACTOR = 1.3;
const SEEN_THRESHOLD = 0.5; // seconds of illumination to count as "guided"
const SPAWN_INTERVAL = 2200;

export function Lighthouse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudFaded, setHudFaded] = useState(false);
  const [guided, setGuided] = useState(0);
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
    let lamp = { x: 0, y: 0 };
    let ships: Ship[] = [];
    let dragging = false;
    let manualAngle: number | null = null;
    let lastSpawn = 0;
    let guidedCount = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lamp = { x: width * 0.13, y: height * 0.5 };
    }

    function spawnShip() {
      const fromLeft = Math.random() > 0.5;
      ships.push({
        x: fromLeft ? -20 : width + 20,
        y: rand(height * 0.55, height * 0.86),
        speed: rand(18, 34),
        dir: fromLeft ? 1 : -1,
        size: rand(5, 9),
        illumTime: 0,
        seen: false,
      });
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      // Sea + sky already painted by CSS gradient; draw a horizon + water texture.
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(10, 18, 30, 0.6)";
      ctx.fillRect(0, height * 0.5, width, height * 0.5);
      ctx.strokeStyle = "rgba(216, 189, 130, 0.15)";
      for (let i = 0; i < 6; i++) {
        const y = height * 0.55 + i * (height * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const beamAngle =
        manualAngle !== null
          ? manualAngle
          : Math.PI * 0.15 + Math.sin(t * 0.00025) * (Math.PI * 0.32);

      // Spawn ships.
      if (t - lastSpawn > SPAWN_INTERVAL) {
        lastSpawn = t;
        if (ships.length < 8) spawnShip();
      }

      // Beam cone.
      const beamLen = Math.max(width, height) * BEAM_LENGTH_FACTOR;
      const grad = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, beamLen);
      grad.addColorStop(0, "rgba(240, 220, 160, 0.32)");
      grad.addColorStop(1, "rgba(240, 220, 160, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(lamp.x, lamp.y);
      ctx.arc(lamp.x, lamp.y, beamLen, beamAngle - BEAM_HALF_WIDTH, beamAngle + BEAM_HALF_WIDTH);
      ctx.closePath();
      ctx.fill();

      // Ships.
      for (let i = ships.length - 1; i >= 0; i--) {
        const s = ships[i];
        if (!reducedMotion.current) {
          s.x += s.speed * s.dir * dt;
        }

        const dx = s.x - lamp.x;
        const dy = s.y - lamp.y;
        const dist = Math.hypot(dx, dy);
        const angleToShip = Math.atan2(dy, dx);
        let diff = angleToShip - beamAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const lit = Math.abs(diff) < BEAM_HALF_WIDTH && dist < beamLen;

        if (lit && !reducedMotion.current) {
          s.illumTime += dt;
          if (s.illumTime > SEEN_THRESHOLD && !s.seen) {
            s.seen = true;
            guidedCount += 1;
            setGuided(guidedCount);
          }
        }

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.dir === 1 ? 0 : Math.PI);
        ctx.fillStyle = lit || s.seen ? "#f0d9a0" : "#3d4b5e";
        ctx.beginPath();
        ctx.moveTo(-s.size, s.size * 0.6);
        ctx.lineTo(s.size, 0);
        ctx.lineTo(-s.size, -s.size * 0.6);
        ctx.closePath();
        ctx.fill();
        if (lit) {
          ctx.strokeStyle = "rgba(240, 217, 160, 0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, s.size * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        if (s.x < -60 || s.x > width + 60) ships.splice(i, 1);
      }

      // Lighthouse tower.
      ctx.fillStyle = "#1c2530";
      ctx.beginPath();
      ctx.moveTo(lamp.x - 10, lamp.y + 140);
      ctx.lineTo(lamp.x - 6, lamp.y);
      ctx.lineTo(lamp.x + 6, lamp.y);
      ctx.lineTo(lamp.x + 10, lamp.y + 140);
      ctx.closePath();
      ctx.fill();
      const lampGlow = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 22);
      lampGlow.addColorStop(0, "rgba(255, 236, 190, 0.95)");
      lampGlow.addColorStop(1, "rgba(255, 236, 190, 0)");
      ctx.fillStyle = lampGlow;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 22, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    }

    function toLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function aimAt(clientX: number, clientY: number) {
      const p = toLocal(clientX, clientY);
      manualAngle = Math.atan2(p.y - lamp.y, p.x - lamp.x);
    }

    function onDown(e: PointerEvent) {
      dragging = true;
      aimAt(e.clientX, e.clientY);
      setHudFaded(true);
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      aimAt(e.clientX, e.clientY);
    }
    function onUp() {
      dragging = false;
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
      title="The Lighthouse"
      category="History · Coastal Watch"
      accent="#F0C76A"
      background="#050a12"
    >
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>Keep the light</div>
          <p className={styles.hudPrompt}>
            Drag anywhere to aim the beam. Real lighthouses each flash in a
            unique timed pattern, so sailors could tell exactly which one
            they were looking at.
          </p>
        </div>
        <div className={styles.counter}>{guided} ships guided</div>
      </div>
    </ExperienceLayout>
  );
}
