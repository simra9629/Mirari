import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Tidepool.module.css";

interface Fish {
  x: number;
  y: number;
  homeY: number;
  vx: number;
  hue: number;
  size: number;
  startled: number;
}

interface Crab {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  size: number;
  wiggle: number;
  startled: number;
}

// Deterministic rock silhouette so the shoreline is stable across renders.
function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Tidepool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudFaded, setHudFaded] = useState(false);
  const [tideState, setTideState] = useState("Tide: rising");
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
    let fish: Fish[] = [];
    let crabs: Crab[] = [];
    let lastTideDir = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seed() {
      const rng = makeRng(77);
      fish = Array.from({ length: 7 }, () => ({
        x: rand(0, width),
        y: height * (0.72 + rng() * 0.22),
        homeY: 0,
        vx: rand(-14, 14) || 10,
        hue: rand(175, 200),
        size: rand(3, 5.5),
        startled: 0,
      }));
      crabs = Array.from({ length: 6 }, (_, i) => {
        const homeX = ((i + 0.5) / 6) * width + rand(-20, 20);
        const homeY = height * (0.5 + rng() * 0.14);
        return { homeX, homeY, x: homeX, y: homeY, size: rand(4, 6), wiggle: Math.random() * Math.PI * 2, startled: 0 };
      });
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      const tidePhase = reducedMotion.current ? 0 : Math.sin(t * 0.00013);
      const tideDir = Math.cos(t * 0.00013);
      if (Math.sign(tideDir) !== Math.sign(lastTideDir) && Math.abs(tideDir) > 0.02) {
        lastTideDir = tideDir;
        setTideState(tideDir > 0 ? "Tide: rising" : "Tide: falling");
      }
      const waterY = height * 0.62 + tidePhase * height * 0.16;

      ctx.clearRect(0, 0, width, height);

      // Rocks (static jagged silhouette across the tidal band).
      const rockRng = makeRng(13);
      ctx.fillStyle = "#1d2f30";
      ctx.beginPath();
      ctx.moveTo(0, height * 0.42);
      let rx = 0;
      while (rx < width) {
        const ry = height * (0.42 + rockRng() * 0.1);
        ctx.lineTo(rx, ry);
        rx += width / 14;
      }
      ctx.lineTo(width, height * 0.42);
      ctx.closePath();
      ctx.fill();

      // Crabs / tidepool life — visible only when the water has pulled back past them.
      for (const crab of crabs) {
        const exposed = waterY < crab.homeY - 4;
        crab.wiggle += dt * (exposed ? 3 : 0.5);

        if (!reducedMotion.current && exposed && crab.startled <= 0) {
          crab.x += Math.sin(crab.wiggle * 0.4) * 3 * dt;
        }
        if (crab.startled > 0) {
          crab.startled -= dt;
          crab.x += (crab.x > crab.homeX ? 1 : -1) * 30 * dt;
        } else if (Math.abs(crab.x - crab.homeX) > 0.5) {
          crab.x += (crab.homeX - crab.x) * dt * 1.5;
        }

        const alpha = exposed ? Math.min(1, (crab.homeY - waterY) / 20) : 0;
        if (alpha <= 0.02) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = "#d97a4d";
        const legLift = Math.sin(crab.wiggle) * 1.2;
        ctx.beginPath();
        ctx.ellipse(crab.x, crab.y, crab.size, crab.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d97a4d";
        ctx.lineWidth = 1;
        for (const side of [-1, 1]) {
          for (let l = 0; l < 2; l++) {
            ctx.beginPath();
            ctx.moveTo(crab.x + side * crab.size * 0.6, crab.y);
            ctx.lineTo(crab.x + side * (crab.size + 4), crab.y + (l === 0 ? -3 : 3) + legLift * side);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Water overlay.
      const waterGrad = ctx.createLinearGradient(0, waterY, 0, height);
      waterGrad.addColorStop(0, "rgba(60, 150, 160, 0.38)");
      waterGrad.addColorStop(1, "rgba(10, 40, 48, 0.7)");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, waterY, width, height - waterY);
      ctx.strokeStyle = "rgba(180, 230, 225, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, waterY);
      ctx.lineTo(width, waterY);
      ctx.stroke();

      // Fish — stay submerged, dart when startled.
      for (const f of fish) {
        if (!reducedMotion.current) {
          if (f.startled > 0) {
            f.startled -= dt;
          }
          f.x += f.vx * (f.startled > 0 ? 3 : 1) * dt;
          if (f.x < -10) f.x = width + 10;
          if (f.x > width + 10) f.x = -10;
          const desiredY = Math.max(f.y, waterY + 14);
          f.y += (desiredY - f.y) * dt * 1.2 + Math.sin(t * 0.001 + f.x) * 0.15;
        }
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.vx < 0 ? -1 : 1, 1);
        ctx.fillStyle = `hsla(${f.hue}, 70%, 65%, 0.9)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-f.size, 0);
        ctx.lineTo(-f.size - 4, -3);
        ctx.lineTo(-f.size - 4, 3);
        ctx.closePath();
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
      for (const crab of crabs) {
        if (Math.hypot(crab.x - p.x, crab.y - p.y) < 24) crab.startled = 0.8;
      }
      for (const f of fish) {
        if (Math.hypot(f.x - p.x, f.y - p.y) < 40) {
          f.startled = 0.6;
          f.vx = f.x < p.x ? -rand(30, 50) : rand(30, 50);
        }
      }
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
      title="Tidepool"
      category="Tiny World"
      accent="#70C5C1"
      background="#071417"
    >
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>A whole ecosystem, in one pool</div>
          <p className={styles.hudPrompt}>
            The tide moves on its own. Crabs come out when it pulls back —
            click near one to see it scuttle.
          </p>
        </div>
        <div className={styles.tideLabel}>{tideState}</div>
      </div>
    </ExperienceLayout>
  );
}
