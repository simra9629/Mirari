import { useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateLevel, PALETTE, SHAPES, SIZES } from "./data";
import styles from "./Archivist.module.css";

export function Archivist() {
  const [level, setLevel] = useState(1);
  const data = useMemo(() => generateLevel(level), [level]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  const totalPairs = data.labels.length;
  const solved = matched.size === totalPairs;

  function newCase(nextLevel: number) {
    setLevel(nextLevel);
    setMatched(new Set());
    setMatchedIds(new Set());
    setSelected([]);
    setWrongPair([]);
    setAttempts(0);
    setLocked(false);
  }

  function onArtifactClick(id: string) {
    if (locked || matchedIds.has(id) || selected.includes(id)) return;

    const next = [...selected, id];
    if (next.length < 2) {
      setSelected(next);
      return;
    }

    setLocked(true);
    setSelected(next);
    const [firstId, secondId] = next;
    const first = data.artifacts.find((a) => a.id === firstId)!;
    const second = data.artifacts.find((a) => a.id === secondId)!;

    setAttempts((a) => a + 1);

    if (first.category === second.category) {
      window.setTimeout(() => {
        setMatched((prev) => new Set(prev).add(first.category));
        setMatchedIds((prev) => new Set(prev).add(firstId).add(secondId));
        setSelected([]);
        setLocked(false);
      }, 420);
    } else {
      setWrongPair(next);
      window.setTimeout(() => {
        setWrongPair([]);
        setSelected([]);
        setLocked(false);
      }, 560);
    }
  }

  return (
    <ExperienceLayout title="The Archivist" category="Puzzle" accent="#C8A968" background="#0b0f18">
      <div className={styles.stage}>
        <div className={styles.topBar}>
          <div className={styles.caseLabel}>Case {level}</div>
          <div className={styles.stats}>
            {matched.size}/{totalPairs} classified · {attempts} {attempts === 1 ? "attempt" : "attempts"}
          </div>
        </div>

        <p className={styles.hint}>
          {data.numTraits === 3
            ? "Every artifact has three visible traits now — a colour, a symbol, and a size. Only one of them actually determines what belongs together; the rest mean nothing at all."
            : "Every artifact has two visible traits — a colour and a symbol. Only one of them actually determines what belongs together; the other means nothing at all."}
          {" "}Test a pair, remember what happened, and work out which trait to trust.
        </p>

        <div className={styles.grid}>
          {data.artifacts.map((a) => {
            const isMatched = matchedIds.has(a.id);
            const isSelected = selected.includes(a.id);
            const isWrong = wrongPair.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className={`${styles.tile} ${isSelected ? styles.tileSelected : ""} ${isMatched ? styles.tileMatched : ""} ${isWrong ? styles.tileWrong : ""}`}
                onClick={() => onArtifactClick(a.id)}
                disabled={isMatched}
                style={{ "--tile-color": PALETTE[a.colorId] } as React.CSSProperties}
              >
                <span className={styles.swatch} />
                <span className={styles.glyph} style={{ fontSize: `${1.5 * SIZES[a.sizeId]}rem` }}>
                  {SHAPES[a.shapeId]}
                </span>
                {isMatched && <span className={styles.label}>{data.labels[a.category]}</span>}
              </button>
            );
          })}
        </div>

        {solved && (
          <div className={styles.solvedPanel}>
            <div className={styles.solvedTitle}>Case classified.</div>
            <p className={styles.solvedText}>
              Every artifact found where it belonged, in {attempts} {attempts === 1 ? "attempt" : "attempts"}.
            </p>
            <button type="button" className={styles.nextButton} onClick={() => newCase(level + 1)}>
              Open the next case →
            </button>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
