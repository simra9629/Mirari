import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./SoundSpeed.module.css";

interface Ring {
  x: number;
  y: number;
  startTime: number;
  isEcho: boolean;
  spawnedEcho: boolean;
}

interface Listener {
  x: number;
  y: number;
  lastHeardMs: number | null;
  flashUntil: number;
}

const SOURCE_X_FRAC = 0.12;
const WALL_X_FRAC = 0.94;
const LISTENER_FRACS = [0.35, 0.6, 0.85];

// The scene is drawn in pixels, but the slider is really controlling a
// real-world speed. 140 px/s is calibrated to the real speed of sound in
// air (343 m/s at sea level) — so 1 real-world m/s = 140/343 px/s.
const REAL_SOUND_MS = 343;
const PX_PER_MS = 140 / REAL_SOUND_MS;

function pxToMs(pxPerSec: number): number {
  return pxPerSec / PX_PER_MS;
}

interface Benchmark {
  ms: number;
  label: string;
}

// Ascending real-world reference speeds, roughly in m/s, used to describe
// whatever speed the slider is currently set to in concrete terms.
const BENCHMARKS: Benchmark[] = [
  { ms: 8, label: "a brisk walking pace" },
  { ms: 30, label: "a car on the highway" },
  { ms: 250, label: "a cruising airliner" },
  { ms: REAL_SOUND_MS, label: "the real speed of sound in air" },
  { ms: 400, label: "a rifle bullet leaving the barrel" },
  { ms: 600, label: "a fighter jet at top speed" },
  { ms: 2000, label: "a ballistic missile re-entering the atmosphere" },
  { ms: 7660, label: "the International Space Station's orbital speed" },
  { ms: 11200, label: "Earth's escape velocity" },
  { ms: 299792458 / 1000, label: "one thousandth of the speed of light" },
];

function describeSpeed(pxPerSec: number): { ms: number; multiplier: string; comparison: string } {
  const ms = pxToMs(pxPerSec);
  const multiplier = ms / REAL_SOUND_MS;
  const multiplierLabel =
    Math.abs(multiplier - 1) < 0.04
      ? "the real speed of sound"
      : multiplier < 1
        ? `${multiplier.toFixed(2)}\u00d7 the real speed of sound`
        : `${multiplier.toFixed(1)}\u00d7 the real speed of sound`;

  // Find the benchmark this speed sits closest to, and say so directly.
  let comparison: string;
  if (ms <= BENCHMARKS[0].ms) {
    comparison = `slower than ${BENCHMARKS[0].label} (about ${BENCHMARKS[0].ms} m/s)`;
  } else {
    let lower = BENCHMARKS[0];
    let upper = BENCHMARKS[BENCHMARKS.length - 1];
    for (let i = 0; i < BENCHMARKS.length - 1; i++) {
      if (ms >= BENCHMARKS[i].ms && ms <= BENCHMARKS[i + 1].ms) {
        lower = BENCHMARKS[i];
        upper = BENCHMARKS[i + 1];
        break;
      }
    }
    if (ms >= BENCHMARKS[BENCHMARKS.length - 1].ms) {
      comparison = `faster than ${BENCHMARKS[BENCHMARKS.length - 1].label} (about ${Math.round(BENCHMARKS[BENCHMARKS.length - 1].ms).toLocaleString()} m/s)`;
    } else {
      comparison = `between ${lower.label} (${Math.round(lower.ms).toLocaleString()} m/s) and ${upper.label} (${Math.round(upper.ms).toLocaleString()} m/s)`;
    }
  }

  return { ms, multiplier: multiplierLabel, comparison };
}

export function SoundSpeed() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState(140);
  const speedRef = useRef(speed);
  const [readouts, setReadouts] = useState<(number | null)[]>([null, null, null]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const triggerRef = useRef<() => void>(() => {});

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
    let rings: Ring[] = [];
    let listeners: Listener[] = [];
    const crossed = new Set<string>();

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      listeners = LISTENER_FRACS.map((f) => ({ x: f * width, y: height * 0.5, lastHeardMs: null, flashUntil: 0 }));
    }

    triggerRef.current = () => {
      rings.push({ x: SOURCE_X_FRAC * width, y: height * 0.5, startTime: performance.now(), isEcho: false, spawnedEcho: false });
      crossed.clear();
      setReadouts([null, null, null]);
    };

    function draw(t: number) {      ctx.fillStyle = "#0e1018";
      ctx.fillRect(0, 0, width, height);

      const wallX = WALL_X_FRAC * width;
      ctx.strokeStyle = "rgba(124,130,255,0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wallX, height * 0.15);
      ctx.lineTo(wallX, height * 0.85);
      ctx.stroke();

      const speedPxPerSec = speedRef.current;
      const newRings: Ring[] = [];

      for (const ring of rings) {
        const age = (t - ring.startTime) / 1000;
        const r = age * speedPxPerSec;

        if (!ring.isEcho && !ring.spawnedEcho && r >= wallX - ring.x) {
          ring.spawnedEcho = true;
          newRings.push({ x: wallX, y: ring.y, startTime: t, isEcho: true, spawnedEcho: true });
        }

        listeners.forEach((l, i) => {
          const dist = Math.hypot(l.x - ring.x, l.y - ring.y);
          const key = `${ring.startTime}-${ring.isEcho}-${i}`;
          if (r >= dist && !crossed.has(key)) {
            crossed.add(key);
            l.lastHeardMs = Math.round(age * 1000);
            l.flashUntil = t + 400;
            setReadouts((prev) => {
              const next = [...prev];
              next[i] = l.lastHeardMs;
              return next;
            });
          }
        });

        ctx.strokeStyle = ring.isEcho ? "rgba(230,185,104,0.5)" : "rgba(124,130,255,0.5)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, Math.max(0, r), 0, Math.PI * 2);
        ctx.stroke();
      }
      rings = rings.filter((r) => {
        const age = (t - r.startTime) / 1000;
        return age * speedPxPerSec < width * 1.6;
      }).concat(newRings);

      ctx.fillStyle = "#7c82ff";
      ctx.beginPath();
      ctx.arc(SOURCE_X_FRAC * width, height * 0.5, 7, 0, Math.PI * 2);
      ctx.fill();

      for (const l of listeners) {
        const flashing = t < l.flashUntil;
        ctx.fillStyle = flashing ? "#e6b968" : "#8b93a3";
        ctx.beginPath();
        ctx.arc(l.x, l.y, flashing ? 8 : 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const { ms: speedMs, multiplier: speedMultiplier, comparison: speedComparison } = describeSpeed(speed);

  return (
    <ExperienceLayout title="What If Sound Traveled Faster?" category="Experiment" accent="#7c82ff" background="#0e1018">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <p className={styles.hint}>
            Clap, and watch the wavefront reach each listener — then bounce
            off the wall and reach them again as an echo.
          </p>

          <button type="button" className={styles.clapButton} onClick={() => triggerRef.current()}>
            Clap
          </button>

          <div className={styles.readouts}>
            {readouts.map((r, i) => (
              <div key={i} className={styles.readoutRow}>
                Listener {i + 1}: {r === null ? "—" : `${r} ms`}
              </div>
            ))}
          </div>

          <div className={styles.sliderRow}>
            <input
              type="range"
              className={styles.slider}
              min={40}
              max={2400}
              step={20}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              aria-label="Speed of sound"
            />
          </div>
          <div className={styles.speedLabel}>
            <div className={styles.speedNumbers}>
              {Math.round(speedMs).toLocaleString()} m/s &middot; {speedMultiplier}
            </div>
            <div className={styles.speedComparison}>{speedComparison}</div>
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
