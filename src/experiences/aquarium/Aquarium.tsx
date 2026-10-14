import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Aquarium.module.css";
import { makeRng } from "../../lib/rng";

interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  size: number;
}

interface Food {
  x: number;
  y: number;
  vy: number;
  life: number;
}

interface Bubble {
  x: number;
  y: number;
  speed: number;
  r: number;
}


export function Aquarium() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [light, setLight] = useState(65);
  const lightRef = useRef(light);
  const [fishCount, setFishCount] = useState(10);
  const addFishRef = useRef<() => void>(() => {});
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    lightRef.current = light;
  }, [light]);

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
    const rand = makeRng(777);
    let fish: Fish[] = [];
    let foods: Food[] = [];
    let bubbles: Bubble[] = [];

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (fish.length === 0) {
        fish = Array.from({ length: 10 }, () => ({
          x: rand() * width,
          y: rand() * height * 0.7 + height * 0.1,
          vx: (rand() - 0.5) * 30,
          vy: (rand() - 0.5) * 30,
          hue: 20 + rand() * 40,
          size: 6 + rand() * 4,
        }));
      }
      if (bubbles.length === 0) {
        bubbles = Array.from({ length: 18 }, () => ({ x: rand() * width, y: height + rand() * height, speed: 20 + rand() * 30, r: 1 + rand() * 2 }));
      }
    }

    addFishRef.current = () => {
      if (fish.length >= 22) return;
      fish.push({ x: rand() * width, y: rand() * height * 0.6 + height * 0.1, vx: (rand() - 0.5) * 30, vy: (rand() - 0.5) * 30, hue: 20 + rand() * 40, size: 6 + rand() * 4 });
      setFishCount(fish.length);
    };

    function onClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (width / rect.width);
      const cy = (e.clientY - rect.top) * (height / rect.height);
      const count = 4 + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        foods.push({
          x: cx + (rand() - 0.5) * 30,
          y: cy + (rand() - 0.5) * 14,
          vy: 6 + rand() * 8,
          life: 14 + rand() * 6,
        });
      }
    }

    function step(dt: number) {
      const l = lightRef.current / 100;
      const activity = 0.5 + l * 0.9;
      // In dim light fish stay close together for safety and are slower to
      // notice food; in bright light they spread out and range further to feed.
      const cohesionK = 0.0015 + (1 - l) * 0.0035;
      const feedRange = 90 + l * 190;
      const feedNotice = 0.35 + l * 0.65;

      for (const f of fish) {
        f.vy += 3 * dt; // gentle sink, corrected by swimming
      }

      for (let i = 0; i < fish.length; i++) {
        const f = fish[i];
        let cohX = 0, cohY = 0, sepX = 0, sepY = 0, aliX = 0, aliY = 0, n = 0;
        for (let j = 0; j < fish.length; j++) {
          if (i === j) continue;
          const other = fish[j];
          const dx = other.x - f.x;
          const dy = other.y - f.y;
          const d = Math.hypot(dx, dy);
          if (d < 70) {
            cohX += other.x; cohY += other.y;
            aliX += other.vx; aliY += other.vy;
            n++;
            if (d < 24) { sepX -= dx / (d || 1); sepY -= dy / (d || 1); }
          }
        }
        if (n > 0) {
          cohX = cohX / n - f.x; cohY = cohY / n - f.y;
          f.vx += cohX * cohesionK + aliX * 0.01 + sepX * 0.6;
          f.vy += cohY * cohesionK + aliY * 0.01 + sepY * 0.6;
        }

        // Head for whichever crumb is actually nearest this fish, within its
        // light-dependent sensing range — not always the same one.
        let nearest: Food | null = null;
        let nearestD = feedRange;
        for (const food of foods) {
          const d = Math.hypot(food.x - f.x, food.y - f.y);
          if (d < nearestD) { nearestD = d; nearest = food; }
        }
        if (nearest && rand() < feedNotice) {
          const dx = nearest.x - f.x;
          const dy = nearest.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          f.vx += (dx / d) * 1.4;
          f.vy += (dy / d) * 1.4;
          if (d < 8) {
            const idx = foods.indexOf(nearest);
            if (idx >= 0) foods.splice(idx, 1);
          }
        }

        if (f.x < 30) f.vx += 4;
        if (f.x > width - 30) f.vx -= 4;
        if (f.y < 30) f.vy += 4;
        if (f.y > height - 30) f.vy -= 4;

        const speed = Math.hypot(f.vx, f.vy);
        const maxSpeed = 55 * activity;
        if (speed > maxSpeed) {
          f.vx = (f.vx / speed) * maxSpeed;
          f.vy = (f.vy / speed) * maxSpeed;
        }
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }

      for (const food of foods) {
        food.y += food.vy * dt;
        food.life -= dt;
        if (food.y > height - 20) { food.y = height - 20; food.vy = 0; }
      }
      foods = foods.filter((food) => food.life > 0);

      for (const b of bubbles) {
        b.y -= b.speed * dt;
        if (b.y < -10) {
          b.y = height + 10;
          b.x = rand() * width;
        }
      }
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (!reducedMotion.current) step(dt);

      const l = lightRef.current / 100;
      const top = `rgb(${Math.round(6 + l * 20)},${Math.round(30 + l * 50)},${Math.round(50 + l * 70)})`;
      const bottom = `rgb(${Math.round(4 + l * 10)},${Math.round(18 + l * 30)},${Math.round(34 + l * 46)})`;
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (l > 0.2) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + l * 0.05})`;
        for (let i = 0; i < 4; i++) {
          const x = width * (0.15 + i * 0.22);
          ctx.beginPath();
          ctx.moveTo(x - 20, 0);
          ctx.lineTo(x + 20, 0);
          ctx.lineTo(x + 50, height);
          ctx.lineTo(x - 50, height);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.strokeStyle = "#39795f";
      ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const bx = width * (0.1 + i * 0.2);
        const sway = reducedMotion.current ? 0 : Math.sin(t / 1400 + i) * 10;
        ctx.beginPath();
        ctx.moveTo(bx, height);
        ctx.quadraticCurveTo(bx + sway, height - 40, bx + sway * 1.5, height - 75);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(220,240,245,0.35)";
      for (const b of bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#d9a15a";
      for (const food of foods) {
        ctx.beginPath();
        ctx.arc(food.x, food.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const f of fish) {
        const angle = Math.atan2(f.vy, f.vx);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(angle);
        ctx.fillStyle = `hsl(${f.hue}, 70%, ${45 + l * 15}%)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-f.size, 0);
        ctx.lineTo(-f.size - 5, -4);
        ctx.lineTo(-f.size - 5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <ExperienceLayout title="Aquarium" category="Tiny World" accent="#4eabb2" background="#0d1a26">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <p className={styles.hint}>Click to drop food. {fishCount} fish, swimming whether you watch or not.</p>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Light</span>
            <input type="range" className={styles.slider} min={0} max={100} value={light} onChange={(e) => setLight(parseFloat(e.target.value))} />
          </div>
          <button type="button" className={styles.addButton} onClick={() => addFishRef.current()}>
            Add a fish
          </button>
        </div>
      </div>
    </ExperienceLayout>
  );
}
