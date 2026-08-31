import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./AntColony.module.css";

interface Ant {
  x: number;
  y: number;
  angle: number;
  state: "foraging" | "carrying";
  lastDrop: number;
}

interface Pheromone {
  x: number;
  y: number;
  bornAt: number;
}

interface FoodPile {
  x: number;
  y: number;
  amount: number;
  total: number;
}

const ANT_COUNT = 46;
const ANT_SPEED = 32;
const SENSE_RADIUS = 70;
const PICKUP_RADIUS = 10;
const NEST_RADIUS = 16;
const PHEROMONE_LIFETIME = 14000;
const PHEROMONE_INTERVAL = 220;

export function AntColony() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudFaded, setHudFaded] = useState(false);
  const [collected, setCollected] = useState(0);
  const collectedRef = useRef(0);
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
    let ants: Ant[] = [];
    let nest = { x: 0, y: 0 };
    const pheromones: Pheromone[] = [];
    const food: FoodPile[] = [];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seed() {
      nest = { x: width / 2, y: height / 2 };
      ants = Array.from({ length: ANT_COUNT }, () => ({
        x: nest.x,
        y: nest.y,
        angle: Math.random() * Math.PI * 2,
        state: "foraging",
        lastDrop: 0,
      }));
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ants.length === 0) seed();
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      ctx.clearRect(0, 0, width, height);

      // Nest.
      const nestGlow = ctx.createRadialGradient(nest.x, nest.y, 0, nest.x, nest.y, NEST_RADIUS * 3);
      nestGlow.addColorStop(0, "rgba(201, 139, 60, 0.35)");
      nestGlow.addColorStop(1, "rgba(201, 139, 60, 0)");
      ctx.fillStyle = nestGlow;
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, NEST_RADIUS * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a2a17";
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, NEST_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Pheromones — fade and prune.
      for (let i = pheromones.length - 1; i >= 0; i--) {
        const age = t - pheromones[i].bornAt;
        if (age > PHEROMONE_LIFETIME) {
          pheromones.splice(i, 1);
          continue;
        }
        const alpha = (1 - age / PHEROMONE_LIFETIME) * 0.3;
        ctx.fillStyle = `rgba(226, 168, 92, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pheromones[i].x, pheromones[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Food piles.
      for (let i = food.length - 1; i >= 0; i--) {
        const pile = food[i];
        if (pile.amount <= 0) {
          food.splice(i, 1);
          continue;
        }
        const scale = 0.4 + (pile.amount / pile.total) * 0.6;
        ctx.fillStyle = "rgba(140, 196, 110, 0.85)";
        for (let g = 0; g < Math.ceil(pile.amount / 2); g++) {
          const ga = (g / 6) * Math.PI * 2;
          const gr = 6 * scale;
          ctx.beginPath();
          ctx.arc(
            pile.x + Math.cos(ga) * gr,
            pile.y + Math.sin(ga) * gr,
            3.2 * scale,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }

      // Ants.
      for (const ant of ants) {
        if (!reducedMotion.current) {
          if (ant.state === "foraging") {
            // Sense nearby pheromone trail and gently steer toward it.
            let nearestP: Pheromone | null = null;
            let nearestD = SENSE_RADIUS;
            for (const p of pheromones) {
              const d = Math.hypot(p.x - ant.x, p.y - ant.y);
              if (d < nearestD) {
                nearestD = d;
                nearestP = p;
              }
            }
            const wander = rand(-0.5, 0.5);
            if (nearestP) {
              const toP = Math.atan2(nearestP.y - ant.y, nearestP.x - ant.x);
              let diff = toP - ant.angle;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              ant.angle += diff * 0.06 + wander * dt * 2;
            } else {
              ant.angle += wander * dt * 3;
            }

            // Sense food.
            for (const pile of food) {
              const d = Math.hypot(pile.x - ant.x, pile.y - ant.y);
              if (d < PICKUP_RADIUS && pile.amount > 0) {
                pile.amount -= 1;
                ant.state = "carrying";
                ant.angle = Math.atan2(nest.y - ant.y, nest.x - ant.x);
                break;
              } else if (d < SENSE_RADIUS) {
                const toFood = Math.atan2(pile.y - ant.y, pile.x - ant.x);
                let diff = toFood - ant.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                ant.angle += diff * 0.15;
              }
            }
          } else {
            // Carrying — head back to the nest, dropping pheromone.
            const toNest = Math.atan2(nest.y - ant.y, nest.x - ant.x);
            let diff = toNest - ant.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ant.angle += diff * 0.12;

            if (t - ant.lastDrop > PHEROMONE_INTERVAL) {
              pheromones.push({ x: ant.x, y: ant.y, bornAt: t });
              ant.lastDrop = t;
            }

            if (Math.hypot(nest.x - ant.x, nest.y - ant.y) < NEST_RADIUS) {
              ant.state = "foraging";
              ant.angle = Math.random() * Math.PI * 2;
              collectedRef.current += 1;
              setCollected(collectedRef.current);
            }
          }

          ant.x += Math.cos(ant.angle) * ANT_SPEED * dt;
          ant.y += Math.sin(ant.angle) * ANT_SPEED * dt;
          if (ant.x < 0) ant.x = 0;
          if (ant.x > width) ant.x = width;
          if (ant.y < 0) ant.y = 0;
          if (ant.y > height) ant.y = height;
        }

        ctx.save();
        ctx.translate(ant.x, ant.y);
        ctx.rotate(ant.angle);
        ctx.fillStyle = ant.state === "carrying" ? "#e2a85c" : "#d8c9ae";
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.6, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    function toLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function onClick(e: PointerEvent) {
      const p = toLocal(e.clientX, e.clientY);
      const amount = Math.round(rand(8, 14));
      food.push({ x: p.x, y: p.y, amount, total: amount });
      setHudFaded(true);
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

  return (
    <ExperienceLayout
      title="Ant Colony"
      category="Tiny World"
      accent="#C98B3C"
      background="#100b06"
    >
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>A city, hidden underground</div>
          <p className={styles.hudPrompt}>
            Click to place food. The colony has no plan — just ants, and a
            trail that gets stronger every time one is used.
          </p>
        </div>
        <div className={styles.counter}>{collected} carried home</div>
      </div>
    </ExperienceLayout>
  );
}
