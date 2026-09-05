import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./AncientObservatory.module.css";

const MAX_ALTITUDE_DEG = 62;
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function shadowLengthFor(thetaDeg: number, gnomonHeight: number, maxLen: number) {
  const altDeg = Math.sin((thetaDeg * Math.PI) / 180) * MAX_ALTITUDE_DEG;
  const altRad = Math.max(altDeg, 3) * (Math.PI / 180);
  return Math.min(gnomonHeight / Math.tan(altRad), maxLen);
}

export function AncientObservatory() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theta, setTheta] = useState(90);

  const readingHour = 6 + (theta / 180) * 12;
  const hh = Math.floor(readingHour);
  const mm = Math.round((readingHour - hh) * 60);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width / 2;
    const cy = height * 0.62;
    const dialRadius = Math.min(width, height) * 0.36;
    const arcRadius = dialRadius * 1.25;
    const gnomonHeight = dialRadius * 0.28;
    const maxShadow = dialRadius * 1.4;

    ctx.clearRect(0, 0, width, height);

    // Sky arc guide.
    ctx.strokeStyle = "rgba(229, 201, 138, 0.15)";
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, arcRadius, Math.PI, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dial face.
    ctx.fillStyle = "rgba(229, 201, 138, 0.05)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, dialRadius, dialRadius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(229, 201, 138, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hour ticks along the shadow line, computed from the same formula the shadow uses.
    ctx.fillStyle = "rgba(229, 201, 138, 0.55)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (const h of HOURS) {
      const t = ((h - 6) / 12) * 180;
      const len = shadowLengthFor(t, gnomonHeight, maxShadow);
      const tx = cx + len * Math.cos((t * Math.PI) / 180);
      ctx.beginPath();
      ctx.arc(tx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(String(h), tx, cy + 16);
    }

    // Sun position along the arc.
    const thetaRad = (theta * Math.PI) / 180;
    const altitudeFactor = Math.sin(thetaRad);
    const sunX = cx - arcRadius * Math.cos(thetaRad);
    const sunY = cy - arcRadius * altitudeFactor * 0.95;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 26);
    sunGlow.addColorStop(0, "rgba(255, 221, 150, 0.9)");
    sunGlow.addColorStop(1, "rgba(255, 221, 150, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffdd96";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Shadow, cast opposite the sun.
    const shadowLen = shadowLengthFor(theta, gnomonHeight, maxShadow);
    const shadowX = cx + shadowLen * Math.cos(thetaRad);
    ctx.strokeStyle = "rgba(10, 8, 4, 0.75)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(shadowX, cy);
    ctx.stroke();

    // Gnomon (the post casting the shadow).
    ctx.strokeStyle = "#c9a25a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - gnomonHeight);
    ctx.stroke();
  }, [theta]);

  return (
    <ExperienceLayout title="The Ancient Observatory" category="History · Timekeeping" accent="#E5A95D" background="#12100a">
      <div className={styles.stage}>
        <div className={styles.canvasWrap}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>
        <p className={styles.readout}>
          Shadow reads: {hh}:{mm.toString().padStart(2, "0")}
        </p>
        <input
          type="range"
          min={2}
          max={178}
          step={0.5}
          value={theta}
          onChange={(e) => setTheta(parseFloat(e.target.value))}
          aria-label="Sun's position across the sky"
          style={{ width: "min(440px, 90%)", accentColor: "#e5a95d" }}
        />
        <p className={styles.hint}>
          Drag to move the sun across the sky. No numbers, no gears — just a
          post and its own shadow, the way time was told for thousands of
          years before anyone built a clock.
        </p>
      </div>
    </ExperienceLayout>
  );
}
