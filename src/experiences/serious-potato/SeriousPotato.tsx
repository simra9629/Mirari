import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./SeriousPotato.module.css";

const PLACARD_LINES = [
  "Origin: acquired from a bag. Provenance otherwise unclear.",
  "Estimated age: approximately one bag's worth.",
  "Conservators advise against direct sunlight, mostly out of habit.",
  "This specimen has not moved in recorded history.",
  "Composition: primarily potato.",
  "On loan from the vegetable crisper, indefinitely.",
  "Handle with the same care you would a sandwich.",
  "Believed to be looking at something, though it has no eyes with which to look. It does, however, have several eyes.",
  "Insured for an amount the museum declines to disclose.",
  "Visitors report a faint sense of being judged.",
  "Do not feed the potato. It is not hungry. It has never been hungry.",
  "This exhibit predates the museum itself, technically, by about a week.",
  "Scholars remain divided on whether it is a russet.",
  "Please refrain from tapping the glass. There is no glass.",
  "A small plaque nearby describes this plaque.",
];

function shuffledBag<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A fixed, slightly lumpy potato silhouette (radius offsets around an ellipse).
const BUMPS = [1, 1.08, 0.94, 1.05, 0.9, 1.1, 0.96, 1.02, 0.88, 1.06, 0.98, 1.04];

export function SeriousPotato() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [placard, setPlacard] = useState("A potato, exhibited with the full weight of institutional seriousness.");
  const bagRef = useRef<string[]>([]);
  const rotationRef = useRef(0.3);

  function nextPlacard() {
    if (bagRef.current.length === 0) bagRef.current = shuffledBag(PLACARD_LINES);
    setPlacard(bagRef.current.pop()!);
  }

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
    let dragging = false;
    let dragStartX = 0;
    let rotationStart = rotationRef.current;
    let moved = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawPotato(cx: number, cy: number, rx: number, ry: number, rotation: number) {
      const squash = Math.cos(rotation);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(0.35, Math.abs(squash)), 1);

      ctx.beginPath();
      const n = BUMPS.length;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = BUMPS[i % n];
        const x = Math.cos(a) * rx * r;
        const y = Math.sin(a) * ry * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, rx * 0.1, 0, 0, rx * 1.2);
      grad.addColorStop(0, "#c9a875");
      grad.addColorStop(0.6, "#a9815a");
      grad.addColorStop(1, "#7a5a3d");
      ctx.fillStyle = grad;
      ctx.fill();

      // A couple of "eyes".
      ctx.fillStyle = "rgba(60, 42, 28, 0.6)";
      [[-rx * 0.3, -ry * 0.1], [rx * 0.25, ry * 0.35], [-rx * 0.1, ry * 0.5]].forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height * 0.58;

      // Spotlight.
      const spot = ctx.createRadialGradient(cx, height * 0.2, 0, cx, cy, height * 0.75);
      spot.addColorStop(0, "rgba(255, 244, 214, 0.14)");
      spot.addColorStop(1, "rgba(255, 244, 214, 0)");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, width, height);

      // Pedestal.
      ctx.fillStyle = "#1a1610";
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy + 40);
      ctx.lineTo(cx + 70, cy + 40);
      ctx.lineTo(cx + 50, height);
      ctx.lineTo(cx - 50, height);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(184, 148, 80, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawPotato(cx, cy, 58, 40, rotationRef.current);

      raf = requestAnimationFrame(draw);
    }

    function onDown(e: PointerEvent) {
      dragging = true;
      moved = 0;
      dragStartX = e.clientX;
      rotationStart = rotationRef.current;
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      moved = Math.max(moved, Math.abs(dx));
      rotationRef.current = rotationStart + dx * 0.012;
    }
    function onUp() {
      if (dragging && moved < 5) nextPlacard();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ExperienceLayout title="The Extremely Serious Potato" category="Strange Thing" accent="#B99450" background="#05050a">
      <div className={styles.stage}>
        <div className={styles.pedestalArea}>
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.rope} aria-hidden="true" />
        </div>
        <div className={styles.placard}>
          <div className={styles.placardEyebrow}>Exhibit placard</div>
          <p className={styles.placardText}>{placard}</p>
        </div>
        <p className={styles.hint}>Click the potato to read more. Drag it to turn it. It will not react.</p>
      </div>
    </ExperienceLayout>
  );
}
