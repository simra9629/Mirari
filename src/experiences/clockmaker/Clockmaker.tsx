import { useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generatePuzzle, clockmakerFact, type Gear } from "./data";
import styles from "./Clockmaker.module.css";

function GearDial({ gear, position }: { gear: Gear; position: number }) {
  const aligned = position === gear.target;
  const angle = (position / gear.teeth) * 360;
  const targetAngle = (gear.target / gear.teeth) * 360;

  return (
    <div className={styles.gear}>
      <svg viewBox="0 0 100 100" className={styles.gearSvg}>
        <circle cx="50" cy="50" r="42" fill="#1a140c" stroke="#5a4a2e" strokeWidth="1.5" />
        {Array.from({ length: gear.teeth }).map((_, i) => {
          const a = ((i / gear.teeth) * 360 - 90) * (Math.PI / 180);
          const isTarget = i === gear.target;
          const x1 = 50 + Math.cos(a) * 36;
          const y1 = 50 + Math.sin(a) * 36;
          const x2 = 50 + Math.cos(a) * 42;
          const y2 = 50 + Math.sin(a) * 42;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isTarget ? "#e8c96f" : "#5a4a2e"}
              strokeWidth={isTarget ? 3 : 1.5}
            />
          );
        })}
        <g
          className={styles.hand}
          style={{ transform: `rotate(${angle - 90}deg)` }}
        >
          <line
            x1="50"
            y1="50"
            x2="86"
            y2="50"
            stroke={aligned ? "#8fd18a" : "#b88a45"}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <circle cx="50" cy="50" r="4" fill={aligned ? "#8fd18a" : "#b88a45"} />
      </svg>
      <span className={styles.gearLabel}>
        {gear.teeth} teeth · target at {Math.round(targetAngle)}°
      </span>
    </div>
  );
}

export function Clockmaker() {
  const [level, setLevel] = useState(1);
  const puzzle = useMemo(() => generatePuzzle(level), [level]);
  const [k, setK] = useState(0);

  const positions = puzzle.gears.map((g) => ((k * g.step) % g.teeth + g.teeth) % g.teeth);
  const solved = puzzle.gears.every((g, i) => positions[i] === g.target);

  function turn(delta: number) {
    if (solved) return;
    setK((v) => Math.max(0, v + delta));
  }

  function nextClock() {
    setLevel((l) => l + 1);
    setK(0);
  }

  return (
    <ExperienceLayout
      title="The Clockmaker"
      category="Game"
      accent="#B88A45"
      background="#100c07"
    >
      <div className={styles.stage}>
        <div className={styles.levelBadge}>Clock {level}</div>
        <p className={styles.hint}>
          One key drives every gear in this train, each at its own fixed
          ratio. You can't set a gear directly — only find the turn count
          where all of them land on their mark at once.
        </p>

        <div className={styles.gearRow}>
          {puzzle.gears.map((g, i) => (
            <GearDial key={g.id} gear={g} position={positions[i]} />
          ))}
        </div>

        <div className={styles.controls}>
          <button type="button" className={styles.turnButton} onClick={() => turn(-1)} disabled={solved || k === 0}>
            ↺ Back
          </button>
          <span className={styles.turnCount}>{k} turns</span>
          <button type="button" className={styles.turnButton} onClick={() => turn(1)} disabled={solved}>
            Turn ↻
          </button>
          <button type="button" className={styles.turnButton} onClick={() => turn(5)} disabled={solved}>
            Turn ×5
          </button>
        </div>

        {solved && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>Every gear finds its mark.</div>
              <p className={styles.completeFact}>{clockmakerFact}</p>
              <button type="button" className={styles.nextButton} onClick={nextClock}>
                Restore the next clock →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
