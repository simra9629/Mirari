import { useEffect, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { elements, combine, baseElementIds } from "./data";
import styles from "./LittleAlchemist.module.css";

type Result = { kind: "new" | "known"; elementId: string } | { kind: "fizzle" } | null;

export function LittleAlchemist() {
  const [discovered, setDiscovered] = useState<Set<string>>(new Set(baseElementIds));
  const [selected, setSelected] = useState<(string | null)[]>([null, null]);
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    if (!selected[0] || !selected[1]) return;
    const outcome = combine(selected[0], selected[1]);
    if (!outcome) {
      setResult({ kind: "fizzle" });
    } else {
      const isNew = !discovered.has(outcome);
      if (isNew) {
        setDiscovered((prev) => new Set(prev).add(outcome));
      }
      setResult({ kind: isNew ? "new" : "known", elementId: outcome });
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

  const totalDiscoverable = Object.keys(elements).length;
  const orderedIds = Object.keys(elements).sort((a, b) => {
    const da = discovered.has(a) ? 0 : 1;
    const db = discovered.has(b) ? 0 : 1;
    if (da !== db) return da - db;
    return 0;
  });

  return (
    <ExperienceLayout title="Little Alchemist" category="Game" accent="#F56FA8" background="#120a16">
      <div className={styles.stage}>
        <p className={styles.progress}>
          {discovered.size} / {totalDiscoverable} discovered
        </p>

        <div className={styles.workbench}>
          {[0, 1].map((i) => {
            const id = selected[i];
            const el = id ? elements[id] : null;
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
          {result?.kind === "fizzle" && <p className={styles.fizzle}>Nothing happens. Try another pair.</p>}
          {result && result.kind !== "fizzle" && (
            <>
              <div className={styles.resultTitle}>
                {result.kind === "new" ? `New: ${elements[result.elementId].name}` : elements[result.elementId].name}
              </div>
              <p className={styles.resultDesc}>{elements[result.elementId].description}</p>
            </>
          )}
          {!result && <button type="button" className={styles.clearButton} onClick={clearSlots}>Clear</button>}
          {result && (
            <button type="button" className={styles.clearButton} onClick={clearSlots} style={{ marginTop: 8 }}>
              Clear
            </button>
          )}
        </div>

        <span className={styles.paletteEyebrow}>Your materials</span>
        <div className={styles.palette}>
          {orderedIds.map((id) => {
            const el = elements[id];
            const isDiscovered = discovered.has(id);
            if (!isDiscovered) return null;
            const isSelected = selected.includes(id);
            return (
              <div key={id} className={styles.elementButtonWrap}>
                <button
                  type="button"
                  className={`${styles.elementButton} ${isSelected ? styles.selected : ""}`}
                  style={{ "--el-color": el.color } as React.CSSProperties}
                  onClick={() => clickElement(id)}
                >
                  <span className={styles.swatch} />
                  <span className={styles.elementName}>{el.name}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ExperienceLayout>
  );
}
