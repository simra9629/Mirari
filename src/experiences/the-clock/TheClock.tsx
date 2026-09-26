import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./TheClock.module.css";

type Era = "shadow" | "water" | "mechanical" | "digital";

const ERAS: { id: Era; label: string; caption: string; accent: string }[] = [
  {
    id: "shadow",
    label: "Shadow",
    caption: "A stick, the sun, and nothing else. The oldest clock there is.",
    accent: "#e5a95d",
  },
  {
    id: "water",
    label: "Water Clock",
    caption: "However carefully you keep the flow steady, an hour still takes an hour.",
    accent: "#4f91b6",
  },
  {
    id: "mechanical",
    label: "Mechanical",
    caption: "Gears turning at fixed ratios — the first clock that didn't need the sky.",
    accent: "#b88a45",
  },
  {
    id: "digital",
    label: "Digital",
    caption: "Precise. Characterless. It doesn't teach you anything the others didn't.",
    accent: "#8fa6c9",
  },
];

function formatClock(minutes: number, style: "12h" | "24h"): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  if (style === "24h") {
    return `${String(h24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

export function TheClock() {
  const [minutes, setMinutes] = useState(9 * 60);
  const [era, setEra] = useState<Era>("shadow");
  const [playing, setPlaying] = useState(false);
  const minutesRef = useRef(minutes);
  useEffect(() => {
    minutesRef.current = minutes;
  }, [minutes]);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    function tick(t: number) {
      const dt = (t - last) / 1000;
      last = t;
      const rate = reducedMotion.current ? 8 : 5; // simulated minutes per real second
      minutesRef.current = (minutesRef.current + dt * rate) % 1440;
      setMinutes(minutesRef.current);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const hourFrac = minutes / 60; // 0..24
  const current = ERAS.find((e) => e.id === era)!;

  // Shared solar model, used only by the shadow view.
  const daylight = hourFrac > 6 && hourFrac < 18;
  const altitude = daylight ? Math.sin(((hourFrac - 6) / 12) * Math.PI) * 78 + 4 : 0;
  const stickHeight = 90;
  const shadowLength = daylight
    ? Math.min(220, stickHeight / Math.tan((Math.max(altitude, 4) * Math.PI) / 180))
    : 0;
  const shadowDir = hourFrac < 12 ? -1 : 1;

  const minuteOfHour = minutes % 60;
  const waterFraction = 1 - minuteOfHour / 60;

  const hourAngle = ((hourFrac % 12) / 12) * 360;
  const minuteAngle = (minuteOfHour / 60) * 360;
  const secondFraction = minutes - Math.floor(minutes);
  const secondAngle = secondFraction * 360;

  return (
    <ExperienceLayout title="The Clock" category="History & Culture" accent={current.accent} background="#0b0f18">
      <div className={styles.stage} style={{ "--clock-accent": current.accent } as React.CSSProperties}>
        <div className={styles.eraTabs}>
          {ERAS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`${styles.eraTab} ${era === e.id ? styles.eraTabActive : ""}`}
              onClick={() => setEra(e.id)}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className={styles.display}>
          {era === "shadow" && (
            <svg viewBox="0 0 300 220" className={styles.svg}>
              <rect x="0" y="0" width="300" height="220" fill={daylight ? "#1c2233" : "#080a10"} />
              <line x1="0" y1="170" x2="300" y2="170" stroke="#4a4030" strokeWidth={2} />
              {daylight && (
                <line
                  x1="150"
                  y1="170"
                  x2={150 + shadowDir * shadowLength}
                  y2="170"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={10}
                  strokeLinecap="round"
                />
              )}
              <line x1="150" y1="170" x2="150" y2={170 - stickHeight} stroke="#c8a877" strokeWidth={5} strokeLinecap="round" />
              {daylight && (
                <circle
                  cx={150 - shadowDir * Math.cos((altitude * Math.PI) / 180) * 110}
                  cy={170 - Math.sin((altitude * Math.PI) / 180) * 110 - 20}
                  r={12}
                  fill="#e5a95d"
                  opacity={0.9}
                />
              )}
            </svg>
          )}

          {era === "water" && (
            <svg viewBox="0 0 200 260" className={styles.svg}>
              <path d="M60 20 H140 L150 240 H50 Z" fill="none" stroke="#8fa6c9" strokeWidth={3} />
              <clipPath id="vessel-clip">
                <path d="M60 20 H140 L150 240 H50 Z" />
              </clipPath>
              <rect
                x="45"
                y={20 + (240 - 20) * (1 - waterFraction)}
                width="110"
                height={(240 - 20) * waterFraction}
                fill="#4f91b6"
                clipPath="url(#vessel-clip)"
              />
              {Array.from({ length: 11 }).map((_, i) => (
                <line
                  key={i}
                  x1="150"
                  y1={20 + ((i + 1) / 12) * 220}
                  x2="158"
                  y2={20 + ((i + 1) / 12) * 220}
                  stroke="#c8a877"
                  strokeWidth={1.5}
                />
              ))}
            </svg>
          )}

          {era === "mechanical" && (
            <svg viewBox="0 0 220 220" className={styles.svg}>
              <circle cx="110" cy="110" r="96" fill="#141118" stroke="#b88a45" strokeWidth={3} />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={110 + Math.sin(a) * 84}
                    y1={110 - Math.cos(a) * 84}
                    x2={110 + Math.sin(a) * 92}
                    y2={110 - Math.cos(a) * 92}
                    stroke="#e8e2d5"
                    strokeWidth={2.5}
                  />
                );
              })}
              <line
                x1="110" y1="110"
                x2={110 + Math.sin((hourAngle * Math.PI) / 180) * 46}
                y2={110 - Math.cos((hourAngle * Math.PI) / 180) * 46}
                stroke="#e8e2d5" strokeWidth={5} strokeLinecap="round"
              />
              <line
                x1="110" y1="110"
                x2={110 + Math.sin((minuteAngle * Math.PI) / 180) * 70}
                y2={110 - Math.cos((minuteAngle * Math.PI) / 180) * 70}
                stroke="#e8e2d5" strokeWidth={3} strokeLinecap="round"
              />
              <line
                x1="110" y1="110"
                x2={110 + Math.sin((secondAngle * Math.PI) / 180) * 78}
                y2={110 - Math.cos((secondAngle * Math.PI) / 180) * 78}
                stroke="#4e82b9" strokeWidth={1.5}
              />
              <circle cx="110" cy="110" r="4" fill="#b88a45" />
            </svg>
          )}

          {era === "digital" && (
            <div className={styles.digital}>{formatClock(minutes, "24h")}</div>
          )}
        </div>

        <p className={styles.caption}>{current.caption}</p>

        <div className={styles.timeControls}>
          <button
            type="button"
            className={styles.playButton}
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? "Pause" : "Let time pass"}
          </button>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={1439}
            step={1}
            value={Math.floor(minutes)}
            onChange={(e) => {
              setPlaying(false);
              setMinutes(parseFloat(e.target.value));
            }}
            aria-label="Time of day"
          />
          <span className={styles.timeReadout}>{formatClock(minutes, "12h")}</span>
        </div>
      </div>
    </ExperienceLayout>
  );
}
