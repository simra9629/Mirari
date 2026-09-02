import { useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateFoldPuzzle, foldLeftOverRight, foldRightOverLeft, foldFact, type Row } from "./data";
import styles from "./Fold.module.css";

const PALETTE = ["#5274d8", "#7ea8c9", "#a9c2d8", "#3a5570", "#8fa6c4", "#6b8fb5", "#4a6a94", "#c9d6e4"];

export function Fold() {
  const [level, setLevel] = useState(1);
  const puzzle = useMemo(() => generateFoldPuzzle(level), [level]);
  const [row, setRow] = useState<Row>(puzzle.initialRow);

  function reset() {
    setRow(puzzle.initialRow);
  }

  function doFold(direction: "left" | "right") {
    if (row.length === 1) return;
    setRow(direction === "left" ? foldLeftOverRight(row) : foldRightOverLeft(row));
  }

  const folded = row.length === 1;
  const top = folded ? row[0][0] : null;
  const solved = folded && top!.panelId === puzzle.target.panelId && top!.faceUp === puzzle.target.faceUp;

  function nextPuzzle() {
    setLevel((l) => l + 1);
  }

  return (
    <ExperienceLayout title="Fold" category="Puzzle" accent="#5274D8" background="#0a1018">
      <div className={styles.stage}>
        <div className={styles.levelBadge}>Sheet {level}</div>
        <p className={styles.hint}>
          A flat strip of {puzzle.panelCount} panels. Each fold halves it —
          choose which side folds over the other. Get the marked panel face
          up on top, exactly {puzzle.steps} folds from now.
        </p>
        <p className={styles.targetLine}>
          Target: panel {puzzle.target.panelId + 1}, face up
        </p>

        <div className={styles.strip}>
          {row.map((stack, i) => {
            const topLayer = stack[0];
            return (
              <div
                key={i}
                className={styles.panel}
                style={{
                  background: PALETTE[topLayer.panelId % PALETTE.length],
                  opacity: topLayer.faceUp ? 1 : 0.55,
                }}
              >
                <span className={styles.panelFace}>
                  {topLayer.panelId + 1}
                  {topLayer.faceUp ? "" : " (back)"}
                </span>
                {stack.length > 1 && <span className={styles.panelStack}>{stack.length} layers</span>}
              </div>
            );
          })}
        </div>

        {!folded ? (
          <div className={styles.controls}>
            <button type="button" className={styles.foldButton} onClick={() => doFold("left")}>
              Fold left over right
            </button>
            <button type="button" className={styles.foldButton} onClick={() => doFold("right")}>
              Fold right over left
            </button>
          </div>
        ) : (
          !solved && (
            <>
              <p className={styles.resultLine}>
                Panel {top!.panelId + 1} ended up on top, {top!.faceUp ? "face up" : "face down"} — not quite it.
              </p>
              <button type="button" className={styles.resetButton} onClick={reset}>
                Unfold and try again
              </button>
            </>
          )
        )}

        {solved && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeCard}>
              <div className={styles.completeTitle}>Exactly as folded.</div>
              <p className={styles.completeFact}>{foldFact}</p>
              <button type="button" className={styles.nextButton} onClick={nextPuzzle}>
                Take a new sheet →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
