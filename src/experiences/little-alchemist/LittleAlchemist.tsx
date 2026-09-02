import { useEffect, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  baseMaterials,
  react,
  selfFizzleLines,
  celestialFact,
  catchAllFact,
  type Material,
  type ReactionResult,
} from "./engine";
import styles from "./LittleAlchemist.module.css";

type ResultDisplay =
  | { kind: "reaction"; result: ReactionResult }
  | { kind: "self-fizzle"; line: string }
  | null;

export function LittleAlchemist() {
  const [known, setKnown] = useState<Map<string, Material>>(
    () => new Map(baseMaterials.map((m) => [m.id, m])),
  );
  const [selected, setSelected] = useState<(string | null)[]>([null, null]);
  const [result, setResult] = useState<ResultDisplay>(null);

  useEffect(() => {
    if (!selected[0] || !selected[1]) return;
    const a = known.get(selected[0])!;
    const b = known.get(selected[1])!;

    if (a.id === b.id) {
      const line = selfFizzleLines[Math.floor(Math.random() * selfFizzleLines.length)];
      setResult({ kind: "self-fizzle", line });
    } else {
      const outcome = react(a, b, known);
      if (outcome) {
        if (outcome.isNew) {
          setKnown((prev) => new Map(prev).set(outcome.material.id, outcome.material));
        }
        setResult({ kind: "reaction", result: outcome });
      }
    }

    const t = window.setTimeout(() => setSelected([null, null]), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function clickElement(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.map((s) => (s === id ? null : s));
      const emptyIndex = prev.indexOf(null);
      if (emptyIndex === -1) return prev;
      const next = [...prev];
      next[emptyIndex] = id;
      return next;
    });
  }

  function clearSlots() {
    setSelected([null, null]);
    setResult(null);
  }

  const discoveredList = Array.from(known.values());

  return (
    <ExperienceLayout title="Little Alchemist" category="Game" accent="#F56FA8" background="#120a16">
      <div className={styles.stage}>
        <p className={styles.progress}>{discoveredList.length} materials discovered</p>

        <div className={styles.workbench}>
          {[0, 1].map((i) => {
            const id = selected[i];
            const el = id ? known.get(id) : null;
            return (
              <div
                key={i}
                className={`${styles.slot} ${el ? styles.filled : ""}`}
                style={el ? ({ "--slot-color": el.color } as React.CSSProperties) : undefined}
              >
                {el && <span className={styles.slotLabel}>{el.name}</span>}
              </div>
            );
          })}
        </div>

        <div className={styles.resultPanel}>
          {result?.kind === "self-fizzle" && <p className={styles.fizzle}>{result.line}</p>}
          {result?.kind === "reaction" && (
            <>
              <div className={styles.resultMeta}>
                {result.result.isNew
                  ? result.result.isCelestial
                    ? "New · celestial variant"
                    : result.result.isCatchAll
                      ? "New · generated"
                      : "New discovery"
                  : "Already known"}
              </div>
              <div className={styles.resultTitle}>{result.result.material.name}</div>
              <p className={styles.resultDesc}>{result.result.material.description}</p>
              {result.result.isNew && result.result.isCelestial && (
                <p className={styles.resultProps}>{celestialFact}</p>
              )}
              {result.result.isNew && result.result.isCatchAll && (
                <p className={styles.resultProps}>{catchAllFact}</p>
              )}
              <p className={styles.resultProps}>
                {result.result.material.state} · {result.result.material.properties.join(", ")}
              </p>
            </>
          )}
          {!result && (
            <button type="button" className={styles.clearButton} onClick={clearSlots}>
              Clear
            </button>
          )}
          {result && (
            <button type="button" className={styles.clearButton} onClick={clearSlots}>
              Clear
            </button>
          )}
        </div>

        <span className={styles.paletteEyebrow}>Your materials</span>
        <div className={styles.palette}>
          {discoveredList.map((el) => {
            const isSelected = selected.includes(el.id);
            return (
              <button
                key={el.id}
                type="button"
                className={`${styles.elementButton} ${isSelected ? styles.selected : ""}`}
                style={{ "--el-color": el.color } as React.CSSProperties}
                onClick={() => clickElement(el.id)}
              >
                <span className={styles.swatch} />
                <span className={styles.elementName}>{el.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </ExperienceLayout>
  );
}
