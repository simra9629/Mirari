import { useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateCase, COLORS, MOTIONS } from "./data";
import styles from "./StarDetective.module.css";

export function StarDetective() {
  const [level, setLevel] = useState(1);
  const detectiveCase = useMemo(() => generateCase(level), [level]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [cluesShown, setCluesShown] = useState(1);
  const [solvedIds, setSolvedIds] = useState<Set<number>>(new Set());
  const [wrongId, setWrongId] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);

  const currentTargetId = detectiveCase.targetOrder[targetIndex];
  const currentClues = detectiveCase.cluesByTarget[currentTargetId] ?? [];
  const caseSolved = targetIndex >= detectiveCase.targetOrder.length;

  function revealClue() {
    setCluesShown((c) => Math.min(currentClues.length, c + 1));
  }

  function onGuess(id: number) {
    if (caseSolved || solvedIds.has(id)) return;
    setAttempts((a) => a + 1);
    if (id === currentTargetId) {
      const nextSolved = new Set(solvedIds).add(id);
      setSolvedIds(nextSolved);
      setTargetIndex((i) => i + 1);
      setCluesShown(1);
    } else {
      setWrongId(id);
      window.setTimeout(() => setWrongId(null), 500);
    }
  }

  function nextCase() {
    setLevel((l) => l + 1);
    setTargetIndex(0);
    setCluesShown(1);
    setSolvedIds(new Set());
    setWrongId(null);
    setAttempts(0);
  }

  const totalTargets = detectiveCase.targetOrder.length;

  return (
    <ExperienceLayout title="Star Detective" category="Science" accent="#5278D6" background="#0a1020">
      <div className={styles.stage}>
        <div className={styles.topBar}>
          <div className={styles.caseLabel}>Case {level}</div>
          <div className={styles.stats}>
            {solvedIds.size}/{totalTargets} identified · {attempts} {attempts === 1 ? "attempt" : "attempts"}
          </div>
        </div>

        {!caseSolved && (
          <div className={styles.clueBoard}>
            <div className={styles.clueHeader}>
              Target {targetIndex + 1} of {totalTargets}
            </div>
            {currentClues.slice(0, cluesShown).map((clue, i) => (
              <p key={i} className={styles.clue}>
                <span className={styles.clueIndex}>{i + 1}</span> {clue}
              </p>
            ))}
            {cluesShown < currentClues.length && (
              <button type="button" className={styles.clueButton} onClick={revealClue}>
                Reveal next clue
              </button>
            )}
          </div>
        )}

        <div className={styles.field}>
          {detectiveCase.stars.map((s) => {
            const color = COLORS[s.colorIndex];
            const motion = MOTIONS[s.motionIndex];
            const size = 8 + s.brightness * (16 / (detectiveCase.stars.length + 4));
            const isWrong = wrongId === s.id;
            const isSolved = solvedIds.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.starButton} ${isWrong ? styles.starWrong : ""} ${isSolved ? styles.starFound : ""}`}
                onClick={() => onGuess(s.id)}
                disabled={isSolved || caseSolved}
                aria-label={`Star, ${color.name}, ${motion.name}, brightness ${s.brightness}`}
              >
                <span
                  className={styles.starDot}
                  style={{
                    width: size,
                    height: size,
                    background: color.hex,
                    animationDuration: `${motion.pulseSeconds}s`,
                  }}
                />
              </button>
            );
          })}
        </div>

        {caseSolved && (
          <div className={styles.solvedPanel}>
            <div className={styles.solvedTitle}>Case closed.</div>
            <p className={styles.solvedText}>
              {totalTargets === 1 ? "One star" : `All ${totalTargets} stars`} identified, in {attempts} {attempts === 1 ? "attempt" : "attempts"}.
            </p>
            <button type="button" className={styles.nextButton} onClick={nextCase}>
              Next case →
            </button>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
