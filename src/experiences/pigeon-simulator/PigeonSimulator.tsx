import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { EAT_LINES, FLEE_LINES, SIT_LINES } from "./data";
import styles from "./PigeonSimulator.module.css";

interface Crumb {
  x: number;
  y: number;
  taken: boolean;
}

interface Pedestrian {
  x: number;
  y: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  t: number;
  speed: number;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function PigeonSimulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [crumbsEaten, setCrumbsEaten] = useState(0);
  const [caption, setCaption] = useState("Waddle around. Find some crumbs. Live your best life.");
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

    const pigeon = { x: 0.5, y: 0.5, vx: 0, vy: 0, facing: 0, bob: 0, sitTimer: 0, fleeTimer: 0, fleeAngle: 0 };
    const keys = new Set<string>();
    let crumbs: Crumb[] = [];
    let pedestrians: Pedestrian[] = [];
    const benches: { x: number; y: number; w: number; h: number }[] = [
      { x: 0.16, y: 0.28, w: 0.16, h: 0.05 },
      { x: 0.68, y: 0.72, w: 0.16, h: 0.05 },
    ];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seed() {
      crumbs = Array.from({ length: 9 }, () => ({ x: rand(0.08, 0.92), y: rand(0.12, 0.88), taken: false }));
      pedestrians = [
        { x: 0.2, y: 0.5, ax: 0.15, ay: 0.5, bx: 0.85, by: 0.5, t: 0, speed: 0.06 },
        { x: 0.5, y: 0.15, ax: 0.5, ay: 0.12, bx: 0.5, by: 0.88, t: 0.4, speed: 0.05 },
        { x: 0.7, y: 0.3, ax: 0.75, ay: 0.2, bx: 0.3, by: 0.8, t: 0.7, speed: 0.045 },
      ];
    }
    seed();

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }


    function eatNearbyCrumb() {
      for (const c of crumbs) {
        if (c.taken) continue;
        const dx = c.x * width - pigeon.x * width;
        const dy = c.y * height - pigeon.y * height;
        if (Math.hypot(dx, dy) < 16) {
          c.taken = true;
          setCrumbsEaten((n) => n + 1);
          setCaption(pick(EAT_LINES));
        }
      }
    }

    function trySit() {
      const px = pigeon.x * width;
      const py = pigeon.y * height;
      for (const b of benches) {
        const bx = b.x * width;
        const by = b.y * height;
        const bw = b.w * width;
        const bh = b.h * height;
        if (px > bx - 10 && px < bx + bw + 10 && py > by - 10 && py < by + bh + 10) {
          pigeon.sitTimer = 1.6;
          setCaption(pick(SIT_LINES));
          return;
        }
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        keys.add(k);
        e.preventDefault();
      } else if (k === " ") {
        trySit();
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.delete(e.key.toLowerCase());
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      // Pedestrians patrol back and forth.
      for (const p of pedestrians) {
        if (!reducedMotion.current) {
          p.t += dt * p.speed;
          const cycle = Math.abs(((p.t % 2) - 1));
          p.x = p.ax + (p.bx - p.ax) * cycle;
          p.y = p.ay + (p.by - p.ay) * cycle;
        }
      }

      // Flee override, if a pedestrian is too close.
      if (pigeon.fleeTimer <= 0) {
        for (const p of pedestrians) {
          const dx = pigeon.x - p.x;
          const dy = pigeon.y - p.y;
          const dist = Math.hypot(dx * width, dy * height);
          if (dist < 46) {
            pigeon.fleeTimer = 0.6;
            pigeon.fleeAngle = Math.atan2(dy, dx);
            setCaption(pick(FLEE_LINES));
            break;
          }
        }
      }

      if (pigeon.fleeTimer > 0) {
        pigeon.fleeTimer -= dt;
        pigeon.vx = Math.cos(pigeon.fleeAngle) * 1.6;
        pigeon.vy = Math.sin(pigeon.fleeAngle) * 1.6;
      } else if (pigeon.sitTimer > 0) {
        pigeon.sitTimer -= dt;
        pigeon.vx *= 0.8;
        pigeon.vy *= 0.8;
      } else {
        let ax = 0;
        let ay = 0;
        if (keys.has("arrowup") || keys.has("w")) ay -= 1;
        if (keys.has("arrowdown") || keys.has("s")) ay += 1;
        if (keys.has("arrowleft") || keys.has("a")) ax -= 1;
        if (keys.has("arrowright") || keys.has("d")) ax += 1;
        const mag = Math.hypot(ax, ay) || 1;
        pigeon.vx += (ax / mag) * 0.9 * dt;
        pigeon.vy += (ay / mag) * 0.9 * dt;
        if (ax !== 0 || ay !== 0) pigeon.facing = Math.atan2(ay, ax);
      }

      pigeon.vx *= 0.9;
      pigeon.vy *= 0.9;
      pigeon.x = Math.max(0.03, Math.min(0.97, pigeon.x + pigeon.vx * dt));
      pigeon.y = Math.max(0.05, Math.min(0.95, pigeon.y + pigeon.vy * dt));

      const moving = Math.hypot(pigeon.vx, pigeon.vy) > 0.02;
      if (moving && !reducedMotion.current) pigeon.bob += dt * 14;

      eatNearbyCrumb();

      // Draw plaza.
      ctx.fillStyle = "#3a3630";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Fountain.
      ctx.fillStyle = "#4a5a68";
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.5, Math.min(width, height) * 0.09, 0, Math.PI * 2);
      ctx.fill();

      // Benches.
      ctx.fillStyle = "#6b5238";
      for (const b of benches) {
        ctx.fillRect(b.x * width, b.y * height, b.w * width, b.h * height);
      }

      // Lamppost.
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(width * 0.85 - 2, height * 0.15, 4, height * 0.25);
      ctx.beginPath();
      ctx.arc(width * 0.85, height * 0.15, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#e6d9a8";
      ctx.fill();

      // Crumbs.
      for (const c of crumbs) {
        if (c.taken) continue;
        ctx.fillStyle = "#c9a15a";
        ctx.beginPath();
        ctx.arc(c.x * width, c.y * height, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pedestrians.
      for (const p of pedestrians) {
        ctx.fillStyle = "#8b93a3";
        ctx.beginPath();
        ctx.ellipse(p.x * width, p.y * height, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height - 12, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // The pigeon.
      const px = pigeon.x * width;
      const py = pigeon.y * height + (pigeon.sitTimer > 0 ? 3 : 0);
      const bobY = moving ? Math.sin(pigeon.bob) * 1.6 : 0;
      const scale = pigeon.sitTimer > 0 ? 0.85 : 1;
      ctx.save();
      ctx.translate(px, py + bobY);
      ctx.scale(scale, scale);
      ctx.rotate(pigeon.facing + Math.PI / 2);
      ctx.fillStyle = "#9aa3b0";
      ctx.beginPath();
      ctx.ellipse(0, 2, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c3cad6";
      ctx.beginPath();
      ctx.arc(0, -9, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0a355";
      ctx.beginPath();
      ctx.moveTo(-2.5, -13);
      ctx.lineTo(2.5, -13);
      ctx.lineTo(0, -17);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <ExperienceLayout title="Pigeon Simulator" category="Strange Thing" accent="#8b93a3" background="#3a3630">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <div className={styles.readout}>{crumbsEaten} crumbs claimed</div>
          <p className={styles.caption}>{caption}</p>
          <p className={styles.hint}>Arrow keys or WASD to walk. Space to sit down, wherever you happen to be.</p>
        </div>
      </div>
    </ExperienceLayout>
  );
}
