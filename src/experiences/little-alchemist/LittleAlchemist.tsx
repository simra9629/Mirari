import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  baseMaterials,
  react,
  selfFizzleLines,
  CONDITIONS,
  getStage,
  getUnlockedConditions,
  nextStage,
  type ConditionType,
  type Material,
} from "./engine";
import styles from "./LittleAlchemist.module.css";

interface CanvasItem {
  instanceId: string;
  materialId: string;
  x: number; // percentage, 0-100
  y: number; // percentage, 0-100
}

interface Toast {
  kind: "discovery" | "fizzle";
  emoji?: string;
  name?: string;
  isNew?: boolean;
  line?: string;
}

let instanceCounter = 0;
function newInstanceId() {
  instanceCounter += 1;
  return `inst-${instanceCounter}`;
}

type DragPayload = { materialId: string; instanceId?: string };

export function LittleAlchemist() {
  const [known, setKnown] = useState<Map<string, Material>>(
    () => new Map(baseMaterials.map((m) => [m.id, m])),
  );
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [condition, setCondition] = useState<ConditionType>("none");
  const [journalOpen, setJournalOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fizzleAt, setFizzleAt] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);

  const discoveredList = Array.from(known.values());
  const stage = getStage(discoveredList.length);
  const unlockedConditions = getUnlockedConditions(discoveredList.length);
  const upcoming = nextStage(discoveredList.length);

  function showToast(t: Toast) {
    setToast(t);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }

  function relativePosition(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(92, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function spawnFromSidebar(materialId: string, x: number, y: number) {
    setItems((prev) => [...prev, { instanceId: newInstanceId(), materialId, x, y }]);
  }

  function moveItem(instanceId: string, x: number, y: number) {
    setItems((prev) => prev.map((it) => (it.instanceId === instanceId ? { ...it, x, y } : it)));
  }

  function combineOnto(targetInstanceId: string, sourceMaterialId: string, sourceInstanceId?: string) {
    const target = items.find((it) => it.instanceId === targetInstanceId);
    if (!target) return;
    const a = known.get(target.materialId);
    const b = known.get(sourceMaterialId);
    if (!a || !b) return;

    if (a.id === b.id) {
      setFizzleAt(targetInstanceId);
      window.setTimeout(() => setFizzleAt((cur) => (cur === targetInstanceId ? null : cur)), 500);
      showToast({ kind: "fizzle", line: selfFizzleLines[Math.floor(Math.random() * selfFizzleLines.length)] });
      return;
    }

    const outcome = react(a, b, known, condition);
    if (!outcome) return;

    if (outcome.isNew) {
      setKnown((prev) => new Map(prev).set(outcome.material.id, outcome.material));
    }
    showToast({ kind: "discovery", emoji: outcome.material.emoji, name: outcome.material.name, isNew: outcome.isNew });

    setItems((prev) => {
      const withoutSource = sourceInstanceId ? prev.filter((it) => it.instanceId !== sourceInstanceId) : prev;
      return withoutSource.map((it) =>
        it.instanceId === targetInstanceId ? { ...it, materialId: outcome.material.id } : it,
      );
    });
  }

  function onCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const { x, y } = relativePosition(e.clientX, e.clientY);
    if (payload.instanceId) {
      moveItem(payload.instanceId, x, y);
    } else {
      spawnFromSidebar(payload.materialId, x, y);
    }
  }

  function onItemDrop(e: React.DragEvent<HTMLButtonElement>, targetInstanceId: string) {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.instanceId === targetInstanceId) return;
    combineOnto(targetInstanceId, payload.materialId, payload.instanceId);
  }

  function onItemClick(instanceId: string) {
    if (!selectedInstance) {
      setSelectedInstance(instanceId);
      return;
    }
    if (selectedInstance === instanceId) {
      setSelectedInstance(null);
      return;
    }
    const source = items.find((it) => it.instanceId === selectedInstance);
    setSelectedInstance(null);
    if (source) combineOnto(instanceId, source.materialId, source.instanceId);
  }

  function onSidebarClick(materialId: string) {
    const jitterX = 30 + Math.random() * 40;
    const jitterY = 25 + Math.random() * 40;
    spawnFromSidebar(materialId, jitterX, jitterY);
  }

  function clearCanvas() {
    setItems([]);
    setSelectedInstance(null);
  }

  const journalByDepth = (() => {
    const groups = new Map<number, Material[]>();
    for (const m of discoveredList) {
      const list = groups.get(m.depth) ?? [];
      list.push(m);
      groups.set(m.depth, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  })();

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  return (
    <ExperienceLayout title="Little Alchemist" category="Game" accent="#F56FA8" background="#120a16">
      <div className={styles.stage}>
        <div className={styles.topBar}>
          <p className={styles.progress}>{discoveredList.length} discovered</p>
          <div className={styles.stageBadge} title={stage.flavor}>
            {stage.name}
            {upcoming && <span className={styles.stageNext}> · {upcoming.threshold - discoveredList.length} to {upcoming.name}</span>}
          </div>
          <button type="button" className={styles.journalToggle} onClick={() => setJournalOpen((o) => !o)}>
            {journalOpen ? "Close journal" : "Journal"}
          </button>
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
          {items.length > 0 && (
            <button type="button" className={styles.conditionButton} onClick={clearCanvas}>
              Clear bench
            </button>
          )}
        </div>

        <div
          ref={canvasRef}
          className={styles.canvas}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
          onClick={() => setSelectedInstance(null)}
        >
          {items.length === 0 && (
            <p className={styles.canvasHint}>Drag materials up here from the shelf, and drop one onto another.</p>
          )}
          {items.map((item) => {
            const m = known.get(item.materialId);
            if (!m) return null;
            const isSelected = selectedInstance === item.instanceId;
            const isFizzling = fizzleAt === item.instanceId;
            return (
              <button
                key={item.instanceId}
                type="button"
                draggable
                className={`${styles.chip} ${isSelected ? styles.chipSelected : ""} ${isFizzling ? styles.chipFizzle : ""}`}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", JSON.stringify({ materialId: item.materialId, instanceId: item.instanceId }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => onItemDrop(e, item.instanceId)}
                onClick={(e) => {
                  e.stopPropagation();
                  onItemClick(item.instanceId);
                }}
              >
                <span className={styles.chipEmoji}>{m.emoji}</span>
                <span className={styles.chipName}>{m.name}</span>
              </button>
            );
          })}
        </div>

        {toast && toast.kind === "discovery" && (
          <div className={styles.toast}>
            {toast.isNew && <span className={styles.toastNew}>New discovery</span>}
            <span className={styles.toastEmoji}>{toast.emoji}</span>
            <span className={styles.toastName}>{toast.name}</span>
          </div>
        )}
        {toast && toast.kind === "fizzle" && (
          <div className={`${styles.toast} ${styles.toastFizzle}`}>
            <span className={styles.toastName}>{toast.line}</span>
          </div>
        )}

        {journalOpen && (
          <div className={styles.journal}>
            <div className={styles.journalEyebrow}>Discovery journal</div>
            {journalByDepth.map(([depth, materials]) => (
              <div key={depth} className={styles.journalGroup}>
                <div className={styles.journalDepthLabel}>{depth === 0 ? "Base materials" : `Depth ${depth}`}</div>
                {materials.map((m) => (
                  <div key={m.id} className={styles.journalEntry}>
                    <span className={styles.journalEmoji}>{m.emoji}</span>
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

        <div className={styles.shelf}>
          {discoveredList.map((el) => (
            <button
              key={el.id}
              type="button"
              draggable
              className={styles.shelfChip}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", JSON.stringify({ materialId: el.id }));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onSidebarClick(el.id)}
              title={el.description}
            >
              <span className={styles.shelfEmoji}>{el.emoji}</span>
              <span className={styles.shelfName}>{el.name}</span>
            </button>
          ))}
        </div>
        <p className={styles.instructions}>
          Drag one shelf item onto another on the bench, or tap one then tap
          a second — same idea, whichever's easier on your device.
          {selectedInstance && " Something's selected — tap another to combine it, or tap it again to cancel."}
        </p>
      </div>
    </ExperienceLayout>
  );
}
