import { useEffect, useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  baseMaterials,
  react,
  selfFizzleLines,
  celestialFact,
  conditionFact,
  CONDITIONS,
  getStage,
  getUnlockedConditions,
  nextStage,
  type ConditionType,
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
  const [condition, setCondition] = useState<ConditionType>("none");
  const [journalOpen, setJournalOpen] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!selected[0] || !selected[1]) return;
    const a = known.get(selected[0])!;
    const b = known.get(selected[1])!;

    if (a.id === b.id) {
      const line = selfFizzleLines[Math.floor(Math.random() * selfFizzleLines.length)];
      setResult({ kind: "self-fizzle", line });
    } else {
      const outcome = react(a, b, known, condition);
      if (outcome) {
        if (outcome.isNew) {
          setKnown((prev) => new Map(prev).set(outcome.material.id, outcome.material));
        }
        setResult({ kind: "reaction", result: outcome });
      }
    }

    const t = window.setTimeout(() => setSelected([null, null]), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, condition]);

  function placeInSlot(id: string, slotIndex?: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.map((s) => (s === id ? null : s));
      const targetIndex = slotIndex ?? prev.indexOf(null);
      if (targetIndex === -1 || targetIndex === undefined) return prev;
      const next = [...prev];
      next[targetIndex] = id;
      return next;
    });
  }

  function clearSlots() {
    setSelected([null, null]);
    setResult(null);
  }

  const discoveredList = Array.from(known.values());
  const stage = getStage(discoveredList.length);
  const unlockedConditions = getUnlockedConditions(discoveredList.length);
  const upcoming = nextStage(discoveredList.length);

  const journalByDepth = useMemo(() => {
    const groups = new Map<number, Material[]>();
    for (const m of discoveredList) {
      const list = groups.get(m.depth) ?? [];
      list.push(m);
      groups.set(m.depth, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [discoveredList]);

  return (
    <ExperienceLayout title="Little Alchemist" category="Game" accent="#F56FA8" background="#120a16">
      <div className={styles.stage}>
        <div className={styles.topRow}>
          <p className={styles.progress}>{discoveredList.length} materials discovered</p>
          <button type="button" className={styles.journalToggle} onClick={() => setJournalOpen((o) => !o)}>
            {journalOpen ? "Close journal" : "Open journal"}
          </button>
        </div>

        <div className={styles.stageBanner}>
          <span className={styles.stageName}>{stage.name}</span>
          <span className={styles.stageFlavor}>{stage.flavor}</span>
          {upcoming && (
            <span className={styles.stageNext}>
              {upcoming.threshold - discoveredList.length} more discoveries until {upcoming.name}
            </span>
          )}
        </div>

        <div className={styles.conditionRow}>
          {CONDITIONS.map((c) => {
            const unlocked = unlockedConditions.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.conditionButton} ${condition === c.id ? styles.conditionActive : ""} ${!unlocked ? styles.conditionLocked : ""}`}
                onClick={() => unlocked && setCondition(c.id)}
                disabled={!unlocked}
                title={unlocked ? c.hint : "Not built yet — keep discovering."}
              >
                {unlocked ? c.label : "?"}
              </button>
            );
          })}
        </div>

        <div className={styles.workbench}>
          {[0, 1].map((i) => {
            const id = selected[i];
            const el = id ? known.get(id) : null;
            return (
              <div
                key={i}
                className={`${styles.slot} ${el ? styles.filled : ""} ${dragOverSlot === i ? styles.dragOver : ""}`}
                style={el ? ({ "--slot-color": el.color } as React.CSSProperties) : undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverSlot(i);
                }}
                onDragLeave={() => setDragOverSlot((s) => (s === i ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSlot(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) placeInSlot(id, i);
                }}
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
                    : "New discovery"
                  : "Already known"}
              </div>
              <div className={styles.resultTitle}>{result.result.material.name}</div>
              <p className={styles.resultDesc}>{result.result.material.description}</p>
              {result.result.isNew && result.result.isCelestial && (
                <p className={styles.resultProps}>{celestialFact}</p>
              )}
              {result.result.isNew && result.result.isConditional && (
                <p className={styles.resultProps}>{conditionFact}</p>
              )}
              <p className={styles.resultProps}>
                {result.result.material.state} · {result.result.material.properties.join(", ")}
              </p>
            </>
          )}
          <button type="button" className={styles.clearButton} onClick={clearSlots}>
            Clear
          </button>
        </div>

        {journalOpen && (
          <div className={styles.journal}>
            <div className={styles.journalEyebrow}>Discovery journal</div>
            {journalByDepth.map(([depth, materials]) => (
              <div key={depth} className={styles.journalGroup}>
                <div className={styles.journalDepthLabel}>{depth === 0 ? "Base materials" : `Depth ${depth}`}</div>
                {materials.map((m) => (
                  <div key={m.id} className={styles.journalEntry}>
                    <span className={styles.journalSwatch} style={{ background: m.color }} />
                    <div className={styles.journalText}>
                      <div className={styles.journalName}>{m.name}</div>
                      <div className={styles.journalDesc}>{m.description}</div>
                      {m.firstParents && (
                        <div className={styles.journalOrigin}>
                          {m.firstParents[0]} + {m.firstParents[1]}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <span className={styles.paletteEyebrow}>Your materials — drag onto a slot, or click one then another</span>
        <div className={styles.shelf}>
          {discoveredList.map((el) => {
            const isSelected = selected.includes(el.id);
            return (
              <button
                key={el.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", el.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`${styles.bottle} ${isSelected ? styles.selected : ""}`}
                style={{ "--el-color": el.color } as React.CSSProperties}
                onClick={() => placeInSlot(el.id)}
              >
                <span className={styles.bottleCap} />
                <span className={styles.bottleGlass}>
                  <span className={styles.bottleLiquid} />
                </span>
                <span className={styles.elementName}>{el.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </ExperienceLayout>
  );
}
