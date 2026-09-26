import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  SPOTS,
  ACTION_TARGET,
  COMPLY,
  COMPLY_LINES,
  IGNORE_LINES,
  DEFIANT_LINES,
  MOOD_LABEL,
  MOOD_WEIGHTS,
  WANDER_WEIGHTS,
  pickWeighted,
  type Mood,
  type Action,
} from "./data";
import styles from "./Cat.module.css";

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

type Indicator = "zzz" | "heart" | "sparkle" | "shrug" | null;

export function Cat() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mood, setMood] = useState<Mood>("curious");
  const [caption, setCaption] = useState("The cat is doing its own thing. You can try suggesting something.");
  const moodRef = useRef<Mood>("curious");
  const catPos = useRef({ x: SPOTS.couch.x, y: SPOTS.couch.y });
  const catTarget = useRef({ x: SPOTS.couch.x, y: SPOTS.couch.y });
  const facing = useRef(1);
  const contentUntil = useRef(0);
  const indicatorRef = useRef<{ kind: Indicator; start: number }>({ kind: null, start: 0 });
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    function wander() {
      if (moodRef.current !== "napping" && performance.now() > contentUntil.current) {
        const spotId = pickWeighted(WANDER_WEIGHTS);
        catTarget.current = { x: SPOTS[spotId].x, y: SPOTS[spotId].y };
      }
      setMood(pickWeighted(MOOD_WEIGHTS));
    }
    const interval = window.setInterval(wander, 4500 + Math.random() * 2500);
    return () => window.clearInterval(interval);
  }, []);

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

    function drawFurniture(t: number) {
      // Rug.
      ctx.fillStyle = "#3a2f28";
      ctx.beginPath();
      ctx.ellipse(width * 0.5, height * 0.86, width * 0.34, height * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      // Window, with a soft moving sunbeam.
      const win = SPOTS.window;
      const wx = (win.x / 100) * width;
      const wy = (win.y / 100) * height;
      const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, 90);
      glow.addColorStop(0, "rgba(255,226,154,0.18)");
      glow.addColorStop(1, "rgba(255,226,154,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(wx - 90, wy - 90, 180, 180);

      if (!reducedMotion.current) {
        const driftX = Math.sin(t / 4000) * 14;
        ctx.fillStyle = "rgba(255,226,154,0.07)";
        ctx.beginPath();
        ctx.moveTo(wx - 20 + driftX, wy + 30);
        ctx.lineTo(wx + 20 + driftX, wy + 30);
        ctx.lineTo(wx + 60 + driftX, height * 0.86);
        ctx.lineTo(wx - 60 + driftX, height * 0.86);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = "#c9dce8";
      ctx.fillRect(wx - 34, wy - 30, 68, 60);
      ctx.strokeStyle = "#8b93a3";
      ctx.lineWidth = 3;
      ctx.strokeRect(wx - 34, wy - 30, 68, 60);
      ctx.beginPath();
      ctx.moveTo(wx, wy - 30);
      ctx.lineTo(wx, wy + 30);
      ctx.moveTo(wx - 34, wy);
      ctx.lineTo(wx + 34, wy);
      ctx.stroke();

      // Couch.
      const couch = SPOTS.couch;
      const cx = (couch.x / 100) * width;
      const cy = (couch.y / 100) * height;
      ctx.fillStyle = "#5c4632";
      ctx.fillRect(cx - 62, cy - 16, 124, 46);
      ctx.fillStyle = "#6b5238";
      ctx.fillRect(cx - 60, cy - 22, 120, 24);
      ctx.fillStyle = "#7a5f42";
      ctx.fillRect(cx - 60, cy - 22, 18, 24);
      ctx.fillRect(cx + 42, cy - 22, 18, 24);

      // Box.
      const box = SPOTS.box;
      const bx = (box.x / 100) * width;
      const by = (box.y / 100) * height;
      ctx.fillStyle = "#a9895f";
      ctx.fillRect(bx - 28, by - 20, 56, 40);
      ctx.strokeStyle = "#7a5f3f";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 28, by - 20, 56, 40);
      ctx.beginPath();
      ctx.moveTo(bx - 28, by - 20);
      ctx.lineTo(bx, by - 6);
      ctx.lineTo(bx + 28, by - 20);
      ctx.stroke();

      // Plant.
      const plant = SPOTS.plant;
      const px = (plant.x / 100) * width;
      const py = (plant.y / 100) * height;
      const sway = reducedMotion.current ? 0 : Math.sin(t / 1400) * 0.04;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(sway);
      ctx.fillStyle = "#4a5a3a";
      ctx.beginPath();
      ctx.ellipse(0, -20, 22, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#7a5f3f";
      ctx.fillRect(px - 12, py, 24, 18);
    }

    function catBounds() {
      const p = catPos.current;
      return { x: (p.x / 100) * width, y: (p.y / 100) * height, r: 26 };
    }

    function drawIndicator(t: number) {
      const ind = indicatorRef.current;
      if (!ind.kind) return;
      const age = t - ind.start;
      const life = 1400;
      if (age > life) {
        indicatorRef.current = { kind: null, start: 0 };
        return;
      }
      const alpha = 1 - age / life;
      const rise = reducedMotion.current ? 0 : (age / life) * 16;
      const b = catBounds();
      const ix = b.x + 16;
      const iy = b.y - 30 - rise;

      ctx.globalAlpha = alpha;
      if (ind.kind === "zzz") {
        ctx.strokeStyle = "#c9dce8";
        ctx.lineWidth = 1.6;
        ctx.font = '13px "IBM Plex Mono", "SFMono-Regular", monospace';
        ctx.fillStyle = "#c9dce8";
        ctx.fillText("z z z", ix - 6, iy);
      } else if (ind.kind === "heart") {
        ctx.fillStyle = "#d67574";
        ctx.beginPath();
        ctx.moveTo(ix, iy + 4);
        ctx.bezierCurveTo(ix - 8, iy - 6, ix - 14, iy + 4, ix, iy + 12);
        ctx.bezierCurveTo(ix + 14, iy + 4, ix + 8, iy - 6, ix, iy + 4);
        ctx.fill();
      } else if (ind.kind === "sparkle") {
        ctx.strokeStyle = "#e6b968";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + t / 400;
          ctx.beginPath();
          ctx.moveTo(ix + Math.cos(a) * 4, iy + Math.sin(a) * 4);
          ctx.lineTo(ix + Math.cos(a) * 11, iy + Math.sin(a) * 11);
          ctx.stroke();
        }
      } else if (ind.kind === "shrug") {
        ctx.strokeStyle = "#8b93a3";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(ix - 8, iy);
        ctx.lineTo(ix + 8, iy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function drawCat(t: number) {
      const p = catPos.current;
      const x = (p.x / 100) * width;
      const y = (p.y / 100) * height;
      const currentMood = moodRef.current;
      const napping = currentMood === "napping";
      const content = performance.now() < contentUntil.current;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing.current, 1);

      // Tail: mood affects both speed and rest position.
      const tailSpeed = napping ? 2200 : currentMood === "playful" ? 260 : currentMood === "aloof" ? 900 : 450;
      const tailAmount = napping ? 0.04 : currentMood === "playful" ? 0.45 : currentMood === "aloof" ? 0.12 : 0.3;
      const tailWag = reducedMotion.current ? 0 : Math.sin(t / tailSpeed) * tailAmount;
      const tailLift = currentMood === "aloof" ? -6 : currentMood === "playful" ? 6 : 0;
      ctx.strokeStyle = "#3a3f4a";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-14, napping ? 6 : -2);
      ctx.quadraticCurveTo(-30, -20 + tailLift + tailWag * 20, -26, -34 + tailLift + tailWag * 10);
      ctx.stroke();

      // Body.
      ctx.fillStyle = "#4a4f5c";
      ctx.beginPath();
      if (napping) {
        ctx.ellipse(0, 6, 24, 12, 0, 0, Math.PI * 2);
      } else {
        ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // Head.
      const headX = napping ? 16 : 14;
      const headY = napping ? 2 : -10;
      const headR = napping ? 9 : 10;
      ctx.beginPath();
      ctx.arc(headX, headY, headR, 0, Math.PI * 2);
      ctx.fill();

      // Ears: posture varies by mood.
      const earSpread = currentMood === "aloof" ? -0.2 : currentMood === "curious" || currentMood === "playful" ? 0.15 : 0;
      ctx.beginPath();
      const earY = napping ? -4 : -18;
      const earX = napping ? 12 : 10;
      ctx.moveTo(earX, earY);
      ctx.lineTo(earX + 5 + earSpread * 6, earY - 7);
      ctx.lineTo(earX + 9, earY);
      ctx.closePath();
      ctx.moveTo(earX + 8, earY);
      ctx.lineTo(earX + 13 - earSpread * 6, earY - 7);
      ctx.lineTo(earX + 16, earY);
      ctx.closePath();
      ctx.fill();

      // Face: eyes and whiskers, expression by mood.
      if (!napping && !content) {
        const eyeOpen = currentMood === "aloof" ? 0.4 : currentMood === "playful" || currentMood === "curious" ? 1.3 : 1;
        ctx.fillStyle = "#dfe6ee";
        ctx.beginPath();
        ctx.ellipse(headX + 3, headY - 1, 1.6, 2 * eyeOpen, 0, 0, Math.PI * 2);
        ctx.ellipse(headX + 9, headY - 1, 1.6, 2 * eyeOpen, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(223,230,238,0.6)";
        ctx.lineWidth = 0.8;
        for (const wSide of [-1, 1]) {
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(headX + (wSide > 0 ? headR - 1 : -headR + 1), headY + 2 + i * 2.5);
            ctx.lineTo(headX + (wSide > 0 ? headR + 10 : -headR - 10), headY + i * 3);
            ctx.stroke();
          }
        }
      } else {
        // Closed, content eyes: two small curves.
        ctx.strokeStyle = "#1c1f26";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(headX + 3, headY, 1.6, 0.2, Math.PI - 0.2);
        ctx.arc(headX + 9, headY, 1.6, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }

      ctx.restore();
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      ctx.fillStyle = "#241e1a";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#332a24";
      ctx.fillRect(0, height * 0.82, width, height * 0.18);

      drawFurniture(t);

      const settled = performance.now() < contentUntil.current;
      if (!reducedMotion.current && !settled) {
        const target = catTarget.current;
        const p = catPos.current;
        const dx = target.x - p.x;
        if (Math.abs(dx) > 0.3) facing.current = dx > 0 ? 1 : -1;
        p.x += dx * Math.min(1, dt * 1.2);
        p.y += (target.y - p.y) * Math.min(1, dt * 1.2);
      } else if (reducedMotion.current) {
        catPos.current = { ...catTarget.current };
      }

      drawCat(t);
      drawIndicator(t);

      raf = requestAnimationFrame(draw);
    }

    function onCanvasClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (width / rect.width);
      const clickY = (e.clientY - rect.top) * (height / rect.height);
      const b = catBounds();
      if (Math.hypot(clickX - b.x, clickY - b.y) < b.r) {
        petCat();
      }
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("click", onCanvasClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onCanvasClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showIndicator(kind: Indicator) {
    indicatorRef.current = { kind, start: performance.now() };
  }

  function petCat() {
    suggest("pet");
  }

  function suggest(action: Action) {
    const chance = COMPLY[moodRef.current][action];
    const roll = Math.random();

    if (roll < chance) {
      setCaption(pick(COMPLY_LINES[action]));
      const targetId = ACTION_TARGET[action];
      if (targetId) catTarget.current = { x: SPOTS[targetId].x, y: SPOTS[targetId].y };
      if (action === "pet") {
        contentUntil.current = performance.now() + 2600;
        showIndicator("heart");
      } else if (action === "toy") {
        showIndicator("sparkle");
      } else {
        showIndicator(null);
      }
    } else if (roll < chance + 0.35) {
      setCaption(pick(IGNORE_LINES[action]));
      showIndicator(moodRef.current === "napping" ? "zzz" : "shrug");
    } else {
      setCaption(pick(DEFIANT_LINES));
      const spotId = pick(["box", "window", "couch", "plant"]);
      catTarget.current = { x: SPOTS[spotId].x, y: SPOTS[spotId].y };
      showIndicator("shrug");
    }
  }

  return (
    <ExperienceLayout title="Cat" category="Strange Thing" accent="#dfae6b" background="#241e1a">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <div className={styles.moodLabel}>The cat seems {MOOD_LABEL[mood]}.</div>
          <p className={styles.caption}>{caption}</p>
          <p className={styles.hint}>You can also just click the cat directly.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.actionButton} onClick={() => suggest("call")}>
              Call the cat
            </button>
            <button type="button" className={styles.actionButton} onClick={() => suggest("toy")}>
              Offer a toy
            </button>
            <button type="button" className={styles.actionButton} onClick={() => suggest("pet")}>
              Try to pet it
            </button>
            <button type="button" className={styles.actionButton} onClick={() => suggest("point")}>
              Point at the box
            </button>
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
