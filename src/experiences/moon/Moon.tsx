import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Moon.module.css";

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

function phaseName(deg: number) {
  const idx = Math.round(deg / 45) % 8;
  return PHASE_NAMES[idx];
}

function drawMoonDisk(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, thetaRad: number) {
  // Illuminated fraction: 0 at new moon (theta=0), 1 at full (theta=pi), back to 0 at 2pi.
  const twoPi = Math.PI * 2;
  const theta = ((thetaRad % twoPi) + twoPi) % twoPi;
  const f = (1 - Math.cos(theta)) / 2;
  const waxingRight = theta <= Math.PI; // waxing lit on the right, waning lit on the left

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Dark base (new-moon disk).
  ctx.fillStyle = "#141222";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Bright region: an outer limb (fixed half-circle) plus a terminator that is
  // the arc of an ellipse whose horizontal radius shrinks to 0 at quarter phase
  // and grows back out the other side for gibbous — this is the real geometry
  // of a lit sphere's silhouette, not just two overlapping same-size circles.
  const limbSign = waxingRight ? 1 : -1;
  const signedRx = r * (1 - 2 * f);
  const bulgeSign = signedRx >= 0 ? 1 : -1;
  const rx = Math.abs(signedRx);

  const steps = 48;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const y = -r + (2 * r * i) / steps;
    const x = limbSign * Math.sqrt(Math.max(0, r * r - y * y));
    if (i === 0) ctx.moveTo(cx + x, cy + y);
    else ctx.lineTo(cx + x, cy + y);
  }
  for (let i = 0; i <= steps; i++) {
    const y = r - (2 * r * i) / steps;
    const x = limbSign * bulgeSign * rx * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r)));
    ctx.lineTo(cx + x, cy + y);
  }
  ctx.closePath();
  ctx.fillStyle = "#e8dcc0";
  ctx.fill();

  ctx.restore();
  ctx.strokeStyle = "rgba(232, 220, 192, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function Moon() {
  const orbitRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<HTMLCanvasElement>(null);
  const [deg, setDeg] = useState(90);

  useEffect(() => {
    const thetaRad = (deg * Math.PI) / 180;

    // Orbit diagram.
    const orbitCanvasRaw = orbitRef.current;
    if (orbitCanvasRaw) {
      const canvas = orbitCanvasRaw as HTMLCanvasElement;
      const ctxRaw = canvas.getContext("2d");
      if (ctxRaw) {
        const ctx = ctxRaw as CanvasRenderingContext2D;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const earthX = width * 0.5;
        const earthY = height * 0.5;
        const earthR = 26;
        const orbitRx = width * 0.38;
        const orbitRy = height * 0.32;

        // Sun rays from the left.
        ctx.strokeStyle = "rgba(255, 211, 107, 0.25)";
        ctx.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(0, height * 0.5 + i * 18);
          ctx.lineTo(earthX - earthR - 10, earthY + i * 6);
          ctx.stroke();
        }
        ctx.fillStyle = "#ffd36b";
        ctx.beginPath();
        ctx.arc(6, height * 0.5, 10, 0, Math.PI * 2);
        ctx.fill();

        // Orbit path.
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(earthX, earthY, orbitRx, orbitRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Earth — half lit toward the sun (left).
        ctx.save();
        ctx.beginPath();
        ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = "#141222";
        ctx.fillRect(earthX - earthR, earthY - earthR, earthR * 2, earthR * 2);
        ctx.fillStyle = "#5f9bff";
        ctx.fillRect(earthX - earthR, earthY - earthR, earthR, earthR * 2);
        ctx.restore();

        // Moon position on orbit.
        const mx = earthX - orbitRx * Math.cos(thetaRad);
        const my = earthY - orbitRy * Math.sin(thetaRad);
        drawMoonDisk(ctx, mx, my, 13, thetaRad);
      }
    }

    // Phase view.
    const phaseCanvasRaw = phaseRef.current;
    if (phaseCanvasRaw) {
      const canvas = phaseCanvasRaw as HTMLCanvasElement;
      const ctxRaw = canvas.getContext("2d");
      if (ctxRaw) {
        const ctx = ctxRaw as CanvasRenderingContext2D;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        drawMoonDisk(ctx, width / 2, height / 2, Math.min(width, height) / 2 - 4, thetaRad);
      }
    }
  }, [deg]);

  return (
    <ExperienceLayout title="Moon" category="Science · Simulation" accent="#FFD36B" background="#08090f">
      <div className={styles.stage}>
        <div className={styles.panels}>
          <div>
            <div className={styles.panelLabel}>Earth, Moon, and Sun — from above</div>
            <canvas ref={orbitRef} className={styles.orbitCanvas} />
          </div>
          <div>
            <div className={styles.panelLabel}>What you'd see from Earth</div>
            <canvas ref={phaseRef} className={styles.phaseCanvas} />
          </div>
        </div>

        <div className={styles.sliderRow}>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={359}
            step={1}
            value={deg}
            onChange={(e) => setDeg(parseInt(e.target.value, 10))}
            aria-label="Moon's position in orbit"
          />
          <span className={styles.sliderValue}>{phaseName(deg)}</span>
        </div>
        <p className={styles.hint}>
          Drag to move the Moon around its orbit. The Moon isn't changing
          shape — you're just seeing more or less of the half that's always
          lit, depending on where it sits between Earth and the Sun.
        </p>
      </div>
    </ExperienceLayout>
  );
}
