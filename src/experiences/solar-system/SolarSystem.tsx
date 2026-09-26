import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { PLANETS } from "./data";
import styles from "./SolarSystem.module.css";

export function SolarSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(4);
  const [playing, setPlaying] = useState(true);
  const [followed, setFollowed] = useState<number | null>(null);
  const [dayCount, setDayCount] = useState(0);
  const speedRef = useRef(speed);
  const playingRef = useRef(playing);
  const dayRef = useRef(0);
  const followedRef = useRef<number | null>(null);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    followedRef.current = followed;
  }, [followed]);

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
    let cx = 0;
    let cy = 0;
    const positions: { x: number; y: number }[] = PLANETS.map(() => ({ x: 0, y: 0 }));

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height / 2;
    }

    function hitTest(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const scale = width / rect.width;
      const x = (clientX - rect.left) * scale;
      const y = (clientY - rect.top) * scale;
      let closest = -1;
      let closestDist = 18;
      positions.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < closestDist) {
          closestDist = d;
          closest = i;
        }
      });
      setFollowed((prev) => (closest === -1 ? prev : closest));
    }

    function onClick(e: MouseEvent) {
      hitTest(e.clientX, e.clientY);
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (playingRef.current && !reducedMotion.current) {
        dayRef.current += dt * speedRef.current * 6;
        setDayCount(Math.floor(dayRef.current));
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#050812";
      ctx.fillRect(0, 0, width, height);

      const scale = Math.min(width, height) / 460;

      // Orbit rings.
      PLANETS.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(cx, cy, p.orbitRadius * scale, 0, Math.PI * 2);
        ctx.strokeStyle = followedRef.current === i ? "rgba(94,140,255,0.55)" : "rgba(94,140,255,0.14)";
        ctx.lineWidth = followedRef.current === i ? 1.4 : 1;
        ctx.stroke();
      });

      // Sun.
      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * scale);
      sunGrad.addColorStop(0, "rgba(255,201,94,0.9)");
      sunGrad.addColorStop(1, "rgba(255,201,94,0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 26 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffc95e";
      ctx.beginPath();
      ctx.arc(cx, cy, 9 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Planets.
      PLANETS.forEach((p, i) => {
        const angle = (dayRef.current / p.periodDays) * Math.PI * 2;
        const x = cx + Math.cos(angle) * p.orbitRadius * scale;
        const y = cy + Math.sin(angle) * p.orbitRadius * scale;
        positions[i] = { x, y };

        if (followedRef.current === i) {
          ctx.beginPath();
          ctx.arc(x, y, p.dotRadius * scale + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#e8f3ff";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.dotRadius * scale, 0, Math.PI * 2);
        ctx.fill();

        if (p.name === "Saturn") {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-0.4);
          ctx.strokeStyle = "rgba(232,217,168,0.7)";
          ctx.lineWidth = 1.6 * scale;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.dotRadius * scale + 6, p.dotRadius * scale * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const followedPlanet = followed !== null ? PLANETS[followed] : null;

  return (
    <ExperienceLayout title="Solar System" category="Science" accent="#5f9bff" background="#050812">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>Click a planet to follow it.</div>
          <div className={styles.sliderRow}>
            <button type="button" className={styles.playButton} onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={20}
              step={1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              aria-label="Speed"
            />
            <span className={styles.speedLabel}>{speed}×</span>
          </div>
          <div className={styles.dayCounter}>Day {dayCount.toLocaleString()}</div>
        </div>

        {followedPlanet && (
          <div className={styles.factPanel}>
            <div className={styles.factName} style={{ color: followedPlanet.color }}>
              {followedPlanet.name}
            </div>
            <p className={styles.factText}>{followedPlanet.fact}</p>
            <div className={styles.factMeta}>{followedPlanet.periodDays.toLocaleString()} day year</div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
