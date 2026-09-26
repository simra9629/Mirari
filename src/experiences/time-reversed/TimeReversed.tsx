import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { SCENARIOS, easeInQuad, easeOutCubic, clamp01, type ScenarioId } from "./data";
import styles from "./TimeReversed.module.css";

interface Shard {
  dx: number;
  dy: number;
  rot: number;
  w: number;
  h: number;
  shade: string;
}

const SHARDS: Shard[] = [
  { dx: -52, dy: 6, rot: -70, w: 16, h: 12, shade: "#efe9dc" },
  { dx: 42, dy: 16, rot: 55, w: 14, h: 10, shade: "#dcd5c4" },
  { dx: -20, dy: 38, rot: 160, w: 12, h: 9, shade: "#efe9dc" },
  { dx: 26, dy: 44, rot: -35, w: 11, h: 8, shade: "#dcd5c4" },
  { dx: -64, dy: -8, rot: 210, w: 10, h: 8, shade: "#efe9dc" },
  { dx: 60, dy: -12, rot: -140, w: 11, h: 8, shade: "#dcd5c4" },
];

const TABLE_Y = 150;
const GROUND_Y = 250;
const CUP_X = 150;

function CupScene({ frame, total }: { frame: number; total: number }) {
  const fallStart = Math.round(total * 0.17);
  const impact = Math.round(total * 0.42);
  const settle = Math.round(total * 0.75);

  let cupY = TABLE_Y;
  let visible = true;
  if (frame >= fallStart && frame < impact) {
    const t = (frame - fallStart) / (impact - fallStart);
    cupY = TABLE_Y + (GROUND_Y - TABLE_Y) * easeInQuad(t);
  } else if (frame >= impact) {
    visible = false;
  }

  const shardT = clamp01((frame - impact) / (settle - impact));
  const shardEase = easeOutCubic(shardT);
  const showShards = frame >= impact;
  const burstT = clamp01((frame - impact) / (total * 0.06));
  const showBurst = frame >= impact && burstT < 1;
  const shadowScale = visible ? 0.4 + 0.6 * ((cupY - TABLE_Y) / (GROUND_Y - TABLE_Y)) : 1;

  return (
    <g>
      <rect x="20" y={TABLE_Y + 14} width="260" height="10" fill="#2c2f3d" />
      <rect x="34" y={TABLE_Y + 24} width="10" height="46" fill="#22242f" />
      <rect x="256" y={TABLE_Y + 24} width="10" height="46" fill="#22242f" />
      <rect x="0" y={GROUND_Y + 18} width="300" height="4" fill="#1a1c26" />

      {visible && (
        <ellipse cx={CUP_X} cy={TABLE_Y + 18} rx={14 * shadowScale} ry={3.5 * shadowScale} fill="rgba(0,0,0,0.35)" />
      )}

      {showBurst && (
        <circle cx={CUP_X} cy={GROUND_Y} r={4 + burstT * 30} fill="none" stroke="#e8e2d5" strokeWidth={2} opacity={1 - burstT} />
      )}

      {visible && (
        <g transform={`translate(${CUP_X},${cupY})`}>
          <path d="M -18,-20 L 18,-20 L 14,16 A 14 7 0 0 1 -14,16 Z" fill="#e8e2d5" />
          <path d="M -14,-20 L -8,-20 L -6,14 L -12,14 Z" fill="#fff" opacity={0.35} />
          <path d="M 15,-9 Q 33,-4 15,7" fill="none" stroke="#e8e2d5" strokeWidth={4.5} />
        </g>
      )}

      {showShards &&
        SHARDS.map((s, i) => {
          const x = CUP_X + s.dx * shardEase;
          const y = GROUND_Y + s.dy * shardEase;
          const rot = s.rot * shardEase;
          return (
            <g key={i} transform={`translate(${x},${y}) rotate(${rot})`}>
              <ellipse cx={0} cy={s.h * 0.5 + 1} rx={s.w * 0.5} ry={2} fill="rgba(0,0,0,0.25)" />
              <polygon points={`0,0 ${s.w},${s.h * 0.5} ${s.w * 0.25},${s.h}`} fill={s.shade} />
            </g>
          );
        })}
    </g>
  );
}

const DROPS = [
  { x: 90, startFrac: 0.04 },
  { x: 150, startFrac: 0.2 },
  { x: 205, startFrac: 0.1 },
  { x: 170, startFrac: 0.34 },
  { x: 120, startFrac: 0.46 },
];

function RainScene({ frame, total }: { frame: number; total: number }) {
  const puddleY = 235;
  const fallDuration = total * 0.24;
  const rippleDuration = total * 0.3;

  return (
    <g>
      <rect x="0" y="0" width="300" height={puddleY} fill="none" />
      <rect x="0" y={puddleY} width="300" height="55" fill="#1a2836" />
      <rect x="0" y={puddleY} width="300" height="3" fill="#3a5468" opacity={0.6} />

      {DROPS.map((d, i) => {
        const startFrame = d.startFrac * total;
        const impactFrame = startFrame + fallDuration;
        const falling = frame >= startFrame && frame < impactFrame;
        const rippling = frame >= impactFrame && frame < impactFrame + rippleDuration;

        return (
          <g key={i}>
            {falling && (
              <line
                x1={d.x}
                y1={20 + (puddleY - 20) * easeInQuad((frame - startFrame) / fallDuration)}
                x2={d.x}
                y2={20 + (puddleY - 20) * easeInQuad((frame - startFrame) / fallDuration) - 10}
                stroke="#a9c4d9"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )}
            {rippling &&
              (() => {
                const rt = clamp01((frame - impactFrame) / rippleDuration);
                return (
                  <ellipse
                    cx={d.x}
                    cy={puddleY + 2}
                    rx={4 + rt * 34}
                    ry={1.5 + rt * 7}
                    fill="none"
                    stroke="#8fb6cf"
                    strokeWidth={1.4}
                    opacity={1 - rt}
                  />
                );
              })()}
          </g>
        );
      })}
    </g>
  );
}

const FOOTPRINTS = Array.from({ length: 7 }, (_, i) => ({
  x: 50 + i * 32,
  y: 200 + (i % 2 === 0 ? 10 : -10),
  rot: i % 2 === 0 ? -8 : 8,
  thresholdFrac: 0.1 + i * 0.11,
}));

function FootprintsScene({ frame, total }: { frame: number; total: number }) {
  return (
    <g>
      <rect x="0" y="150" width="300" height="150" fill="#3a3327" />
      <rect x="0" y="150" width="300" height="6" fill="#4a4232" opacity={0.6} />

      {FOOTPRINTS.map((f, i) => {
        const threshold = f.thresholdFrac * total;
        const opacity = clamp01((frame - threshold) / 8);
        if (opacity <= 0) return null;
        return (
          <g key={i} transform={`translate(${f.x},${f.y}) rotate(${f.rot})`} opacity={opacity}>
            <ellipse cx={0} cy={0} rx={6} ry={10} fill="#26221a" />
            <circle cx={-2.5} cy={-11} r={1.6} fill="#26221a" />
            <circle cx={2.5} cy={-11} r={1.6} fill="#26221a" />
          </g>
        );
      })}
    </g>
  );
}

export function TimeReversed() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("cup");
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const [frame, setFrame] = useState(0);
  const [direction, setDirection] = useState<"forward" | "reverse" | null>(null);
  const frameRef = useRef(0);
  const dirRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    function tick() {
      if (dirRef.current !== 0) {
        frameRef.current = Math.max(0, Math.min(scenario.totalFrames - 1, frameRef.current + dirRef.current * 1.4));
        setFrame(frameRef.current);
        if (frameRef.current <= 0 || frameRef.current >= scenario.totalFrames - 1) {
          dirRef.current = 0;
          setDirection(null);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scenario.totalFrames]);

  function selectScenario(id: ScenarioId) {
    setScenarioId(id);
    frameRef.current = 0;
    dirRef.current = 0;
    setFrame(0);
    setDirection(null);
  }

  function playForward() {
    dirRef.current = 1;
    setDirection("forward");
  }
  function playReverse() {
    dirRef.current = -1;
    setDirection("reverse");
  }
  function pause() {
    dirRef.current = 0;
    setDirection(null);
  }
  function onScrub(value: number) {
    dirRef.current = 0;
    setDirection(null);
    frameRef.current = value;
    setFrame(value);
  }

  const caption =
    direction === "forward" ? scenario.forwardCaption : direction === "reverse" ? scenario.reverseCaption : scenario.idleCaption;

  return (
    <ExperienceLayout title="What If Time Could Be Reversed?" category="Experiment" accent="#7c82ff" background="#0e1018">
      <div className={styles.stage}>
        <div className={styles.tabs}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.tab} ${s.id === scenarioId ? styles.tabActive : ""}`}
              onClick={() => selectScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className={styles.sceneFrame}>
          <svg viewBox="0 0 300 300" className={styles.svg}>
            {scenarioId === "cup" && <CupScene frame={frame} total={scenario.totalFrames} />}
            {scenarioId === "rain" && <RainScene frame={frame} total={scenario.totalFrames} />}
            {scenarioId === "footprints" && <FootprintsScene frame={frame} total={scenario.totalFrames} />}
          </svg>
        </div>

        <p className={styles.caption}>{caption}</p>

        <div className={styles.controls}>
          <button type="button" className={styles.button} onClick={playReverse} disabled={frame <= 0}>
            ← Reverse
          </button>
          <button type="button" className={styles.button} onClick={pause} disabled={direction === null}>
            Pause
          </button>
          <button type="button" className={styles.button} onClick={playForward} disabled={frame >= scenario.totalFrames - 1}>
            Forward →
          </button>
        </div>

        <input
          type="range"
          className={styles.scrubber}
          min={0}
          max={scenario.totalFrames - 1}
          step={1}
          value={frame}
          onChange={(e) => onScrub(parseInt(e.target.value, 10))}
          aria-label="Timeline"
        />
      </div>
    </ExperienceLayout>
  );
}
