import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Fireflies.module.css";

interface Fly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  blinkSpeed: number;
  blinkPhase: number;
  hue: number;
  radius: number;
}

interface Pulse {
  x: number;
  y: number;
  bornAt: number;
}

const FLY_COUNT = 120;
const PULSE_LIFETIME = 2600;

export function Fireflies() {
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
    let flies: Fly[] = [];
    const pulses: Pulse[] = [];
    const pointer = { x: -9999, y: -9999, active: false };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seed() {
      flies = Array.from({ length: FLY_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        angle: Math.random() * Math.PI * 2,
        speed: rand(6, 16),
        blinkSpeed: rand(0.6, 1.4),
        blinkPhase: Math.random() * Math.PI * 2,
        hue: rand(52, 84), // warm yellow-green range
        radius: rand(1.6, 3.2),
      }));
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (flies.length === 0) seed();
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      ctx.clearRect(0, 0, width, height);

      // Fade old pulses out.
      for (let i = pulses.length - 1; i >= 0; i--) {
        if (t - pulses[i].bornAt > PULSE_LIFETIME) pulses.splice(i, 1);
      }

      for (const f of flies) {
        if (!reducedMotion.current) {
          // Gentle random wander.
          f.angle += rand(-0.4, 0.4) * dt * 3;
          let ax = Math.cos(f.angle) * f.speed;
          let ay = Math.sin(f.angle) * f.speed;

          // Pointer attraction.
          if (pointer.active) {
            const dx = pointer.x - f.x;
            const dy = pointer.y - f.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 160) {
              const pull = (1 - dist / 160) * 26;
              ax += (dx / dist) * pull;
              ay += (dy / dist) * pull;
            }
          }

          // Pulse attraction — pulls in, then relaxes as it fades.
          for (const p of pulses) {
            const age = t - p.bornAt;
            const strength = Math.max(0, 1 - age / PULSE_LIFETIME);
            const dx = p.x - f.x;
            const dy = p.y - f.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 220) {
              const pull = (1 - dist / 220) * 34 * strength;
              ax += (dx / dist) * pull;
              ay += (dy / dist) * pull;
            }
          }

          f.vx += (ax - f.vx) * Math.min(1, dt * 2);
          f.vy += (ay - f.vy) * Math.min(1, dt * 2);
          f.x += f.vx * dt;
          f.y += f.vy * dt;

          // Wrap around the edges — an endless field.
          if (f.x < -10) f.x = width + 10;
          if (f.x > width + 10) f.x = -10;
          if (f.y < -10) f.y = height + 10;
          if (f.y > height + 10) f.y = -10;
        }

        const blink = 0.35 + Math.abs(Math.sin(t * 0.001 * f.blinkSpeed + f.blinkPhase)) * 0.65;
        const r = f.radius * (0.8 + blink * 0.6);

        const gradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 6);
        gradient.addColorStop(0, `hsla(${f.hue}, 90%, 78%, ${blink})`);
        gradient.addColorStop(0.35, `hsla(${f.hue}, 90%, 65%, ${blink * 0.35})`);
        gradient.addColorStop(1, `hsla(${f.hue}, 90%, 55%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${f.hue}, 95%, 88%, ${blink})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    function toLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function onPointerMove(e: PointerEvent) {
      const p = toLocal(e.clientX, e.clientY);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.active = true;
      setHudFaded(true);
    }

    function onPointerLeave() {
      pointer.active = false;
    }

    function onClick(e: PointerEvent) {
      const p = toLocal(e.clientX, e.clientY);
      pulses.push({ x: p.x, y: p.y, bornAt: performance.now() });
      setHudFaded(true);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, []);

  return (
    <ExperienceLayout
      title="Fireflies"
      category="Interactive Art"
      accent="#E6F06C"
      background="#050807"
    >
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>A dark field</div>
          <p className={styles.hudPrompt}>
            Move your light through it. Click to leave one behind for a
            while. There's nothing to win here.
          </p>
        </div>
      </div>
    </ExperienceLayout>
  );
}
