import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  galaxyBrightness,
  galaxyHue,
  galaxyShape,
  galaxyOrientation,
  GRID_SPACING,
  STAR_GRID_SPACING,
  MAX_ZOOM,
  visibilityThreshold,
  starBrightness,
  deepFieldFacts,
} from "./data";
import styles from "./DeepField.module.css";

const GRAIN_SPACING = 3.2;

function drawGalaxy(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  alpha: number,
  hue: number,
  shape: "point" | "elliptical" | "spiral" | "streak",
  orientation: number,
) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(orientation);
  ctx.fillStyle = `hsla(${hue}, 50%, ${58 + alpha * 20}%, ${alpha})`;

  if (shape === "point") {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "elliptical") {
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "spiral") {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.1, size * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.34, size * 1.1, 0, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.55;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.6, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawForegroundStar(ctx: CanvasRenderingContext2D, sx: number, sy: number, brightness: number, scale: number) {
  const size = (1.1 + brightness * 1.6) * Math.min(scale / 3, 2.4);
  const spikeLen = size * 5.5;
  ctx.save();
  ctx.strokeStyle = `rgba(235, 240, 255, ${0.35 + brightness * 0.25})`;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(sx - spikeLen, sy);
  ctx.lineTo(sx + spikeLen, sy);
  ctx.moveTo(sx, sy - spikeLen);
  ctx.lineTo(sx, sy + spikeLen);
  ctx.stroke();

  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 4);
  glow.addColorStop(0, "rgba(235, 240, 255, 0.55)");
  glow.addColorStop(1, "rgba(235, 240, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, size * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f4f7ff";
  ctx.beginPath();
  ctx.arc(sx, sy, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function DeepField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(0);
  const zoomRef = useRef(0);
  const cameraRef = useRef({ x: 0, y: 0, scale: 3 });
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    cameraRef.current = { x: 0, y: 0, scale: 3 };
    setZoomLevel(0);
  }, [seed]);

  const complete = zoomLevel >= MAX_ZOOM;

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

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t: number) {
      const cam = cameraRef.current;
      const threshold = visibilityThreshold(zoomRef.current);

      ctx.fillStyle = "#020103";
      ctx.fillRect(0, 0, width, height);

      const worldLeft = cam.x - width / 2 / cam.scale;
      const worldRight = cam.x + width / 2 / cam.scale;
      const worldTop = cam.y - height / 2 / cam.scale;
      const worldBottom = cam.y + height / 2 / cam.scale;

      // Fine grain — a dim, dense texture so the field never reads as literally blank pixels.
      const grMin = { x: Math.floor(worldLeft / GRAIN_SPACING) - 1, y: Math.floor(worldTop / GRAIN_SPACING) - 1 };
      const grMax = { x: Math.ceil(worldRight / GRAIN_SPACING) + 1, y: Math.ceil(worldBottom / GRAIN_SPACING) + 1 };
      if ((grMax.x - grMin.x) * (grMax.y - grMin.y) < 20000) {
        for (let gx = grMin.x; gx <= grMax.x; gx++) {
          for (let gy = grMin.y; gy <= grMax.y; gy++) {
            const b = galaxyBrightness(gx, gy, seed + 8000);
            if (b > 0.22) continue;
            const sx = (gx * GRAIN_SPACING - cam.x) * cam.scale + width / 2;
            const sy = (gy * GRAIN_SPACING - cam.y) * cam.scale + height / 2;
            ctx.fillStyle = `rgba(200, 210, 230, ${b * 0.3})`;
            ctx.fillRect(sx, sy, 1, 1);
          }
        }
      }

      // Galaxies — reveal more, and fainter, the deeper the zoom.
      const gxMin = Math.floor(worldLeft / GRID_SPACING) - 1;
      const gxMax = Math.ceil(worldRight / GRID_SPACING) + 1;
      const gyMin = Math.floor(worldTop / GRID_SPACING) - 1;
      const gyMax = Math.ceil(worldBottom / GRID_SPACING) + 1;

      for (let gx = gxMin; gx <= gxMax; gx++) {
        for (let gy = gyMin; gy <= gyMax; gy++) {
          const b = galaxyBrightness(gx, gy, seed);
          if (b <= threshold) continue;
          const alpha = (b - threshold) / (1 - threshold);
          const wx = gx * GRID_SPACING + (galaxyBrightness(gx, gy, seed + 500) - 0.5) * GRID_SPACING * 0.6;
          const wy = gy * GRID_SPACING + (galaxyBrightness(gx, gy, seed + 900) - 0.5) * GRID_SPACING * 0.6;
          const sx = (wx - cam.x) * cam.scale + width / 2;
          const sy = (wy - cam.y) * cam.scale + height / 2;
          if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) continue;

          const hue = galaxyHue(gx, gy, seed);
          const shape = galaxyShape(gx, gy, seed);
          const orientation = galaxyOrientation(gx, gy, seed);
          const twinkle = reducedMotion.current ? 1 : 0.8 + Math.sin(t * 0.0005 + gx * 3 + gy) * 0.2;
          const size = (0.7 + alpha * 2.2) * Math.min(cam.scale / 3, 3.4);

          drawGalaxy(ctx, sx, sy, size, Math.min(1, alpha * twinkle), hue, shape, orientation);
        }
      }

      // Foreground stars — our own galaxy, already fully resolved, always visible.
      const sxMin = Math.floor(worldLeft / STAR_GRID_SPACING) - 1;
      const sxMax = Math.ceil(worldRight / STAR_GRID_SPACING) + 1;
      const syMin = Math.floor(worldTop / STAR_GRID_SPACING) - 1;
      const syMax = Math.ceil(worldBottom / STAR_GRID_SPACING) + 1;

      for (let fx = sxMin; fx <= sxMax; fx++) {
        for (let fy = syMin; fy <= syMax; fy++) {
          const b = starBrightness(fx, fy, seed);
          if (b <= 0.82) continue;
          const wx = fx * STAR_GRID_SPACING;
          const wy = fy * STAR_GRID_SPACING;
          const sx = (wx - cam.x) * cam.scale + width / 2;
          const sy = (wy - cam.y) * cam.scale + height / 2;
          if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;
          drawForegroundStar(ctx, sx, sy, (b - 0.82) / 0.18, cam.scale);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function onClick(e: PointerEvent) {
      if (zoomRef.current >= MAX_ZOOM) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = cameraRef.current;
      const worldX = cam.x + (sx - rect.width / 2) / cam.scale;
      const worldY = cam.y + (sy - rect.height / 2) / cam.scale;
      cameraRef.current = { x: worldX, y: worldY, scale: cam.scale * 1.8 };
      setZoomLevel((z) => Math.min(MAX_ZOOM, z + 1));
    }
    canvas.addEventListener("pointerdown", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onClick);
    };
  }, [seed]);

  const fact = deepFieldFacts[(seed - 1) % deepFieldFacts.length];

  return (
    <ExperienceLayout title="Deep Field" category="Science · Observation" accent="#FFC987" background="#020103">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.zoomBadge}>Exposure {zoomLevel} / {MAX_ZOOM}</div>
        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>An empty patch of sky</div>
          <p className={styles.hudPrompt}>
            The sharp, spiky points are ordinary stars nearby. Click anywhere
            to look closer — everything else is a galaxy you haven't
            resolved yet.
          </p>
        </div>
        <div className={styles.resetRow}>
          <button type="button" className={styles.resetButton} onClick={() => setSeed((s) => s + 1)}>
            Point at a new patch
          </button>
        </div>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>It was never empty.</div>
              <p className={styles.completeFact}>{fact}</p>
              <button type="button" className={styles.nextButton} onClick={() => setSeed((s) => s + 1)}>
                Point at a new patch →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
