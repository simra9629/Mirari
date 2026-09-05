import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Rain.module.css";

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  drift: number;
}

export function Rain() {
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
    let drops: Drop[] = [];
    let fogCanvas: HTMLCanvasElement | null = null;
    let fogCtx: CanvasRenderingContext2D | null = null;
    let win = { x: 0, y: 0, w: 0, h: 0 };
    let dragging = false;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seedDrops() {
      drops = Array.from({ length: 140 }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        len: rand(8, 20),
        speed: rand(260, 420),
        drift: rand(-20, -40),
      }));
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      win = { x: width * 0.5 - Math.min(220, width * 0.36), y: height * 0.32, w: Math.min(440, width * 0.72), h: height * 0.5 };

      fogCanvas = document.createElement("canvas");
      fogCanvas.width = Math.max(1, Math.floor(win.w));
      fogCanvas.height = Math.max(1, Math.floor(win.h));
      fogCtx = fogCanvas.getContext("2d");
      if (fogCtx) {
        fogCtx.fillStyle = "rgba(60, 64, 76, 0.94)";
        fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
      }

      if (drops.length === 0) seedDrops();
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#111823";
      ctx.fillRect(0, 0, width, height);

      // Warm glow behind the window.
      const glow = ctx.createRadialGradient(
        win.x + win.w / 2,
        win.y + win.h / 2,
        0,
        win.x + win.w / 2,
        win.y + win.h / 2,
        win.w * 0.75,
      );
      glow.addColorStop(0, "rgba(240, 190, 120, 0.55)");
      glow.addColorStop(1, "rgba(240, 190, 120, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(win.x - 40, win.y - 40, win.w + 80, win.h + 80);

      // Window frame.
      ctx.strokeStyle = "rgba(20, 16, 10, 0.8)";
      ctx.lineWidth = 10;
      ctx.strokeRect(win.x, win.y, win.w, win.h);

      // Regrow fog slowly, then composite it over the window.
      if (fogCtx && fogCanvas) {
        if (!reducedMotion.current) {
          fogCtx.fillStyle = "rgba(60, 64, 76, 0.006)";
          fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
        }
        ctx.drawImage(fogCanvas, win.x, win.y, win.w, win.h);
      }

      // Rain, falling in front of everything.
      ctx.strokeStyle = "rgba(200, 215, 230, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of drops) {
        if (!reducedMotion.current) {
          d.y += d.speed * dt;
          d.x += d.drift * dt;
          if (d.y > height) {
            d.y = -20;
            d.x = rand(0, width);
          }
          if (d.x < -20) d.x = width + 20;
        }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.drift * 0.05, d.y + d.len);
      }
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    }

    function toLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function wipeAt(clientX: number, clientY: number) {
      if (!fogCtx || !fogCanvas) return;
      const p = toLocal(clientX, clientY);
      const fx = ((p.x - win.x) / win.w) * fogCanvas.width;
      const fy = ((p.y - win.y) / win.h) * fogCanvas.height;
      if (fx < -30 || fx > fogCanvas.width + 30 || fy < -30 || fy > fogCanvas.height + 30) return;
      fogCtx.save();
      fogCtx.globalCompositeOperation = "destination-out";
      fogCtx.beginPath();
      fogCtx.arc(fx, fy, 26, 0, Math.PI * 2);
      fogCtx.fill();
      fogCtx.restore();
      setHudFaded(true);
    }

    function onDown(e: PointerEvent) {
      dragging = true;
      wipeAt(e.clientX, e.clientY);
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      wipeAt(e.clientX, e.clientY);
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
    <ExperienceLayout title="Rain" category="Interactive Art" accent="#E1B76D" background="#111823">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={`${styles.hud} ${hudFaded ? styles.faded : ""}`}>
          <div className={styles.hudEyebrow}>A wet window</div>
          <p className={styles.hudPrompt}>
            Drag across the glass to wipe it clear. The fog always comes
            back, slowly — that's not a bug, that's the weather.
          </p>
        </div>
      </div>
    </ExperienceLayout>
  );
}
