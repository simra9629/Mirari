import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { generateVisit, SUCCESS_LINES } from "./data";
import styles from "./BureaucracySimulator.module.css";

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

type EndKind = "normal" | "janet-success" | "express-success";

export function BureaucracySimulator() {
  const [visit, setVisit] = useState(1);
  const data = useMemo(() => generateVisit(visit), [visit]);
  const [stepIndex, setStepIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [waitProgress, setWaitProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [endKind, setEndKind] = useState<EndKind>("normal");
  const [endLine, setEndLine] = useState("");
  const [bounceNote, setBounceNote] = useState<string | null>(null);
  const [successLine] = useState(() => pick(SUCCESS_LINES));
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const steps = data.steps;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const janetShown = data.janet.available && stepIndex >= data.janetUnlockAt;

  function proceed() {
    if (step.wait) {
      setWaiting(true);
      setWaitProgress(0);
      const start = performance.now();
      const duration = 1800;
      function tick() {
        const elapsed = performance.now() - start;
        setWaitProgress(Math.min(1, elapsed / duration));
        if (elapsed < duration) {
          timeoutRef.current = window.setTimeout(tick, 40);
        } else {
          setWaiting(false);
          advance();
        }
      }
      tick();
      return;
    }
    advance();
  }

  function advance() {
    if (isLast) {
      setEndKind("normal");
      setDone(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function tryExpress() {
    if (!step.expressSuccessChance) return;
    if (Math.random() < step.expressSuccessChance) {
      setBounceNote(step.expressSuccessLine ?? null);
      if (isLast) {
        setEndKind("express-success");
        setEndLine(step.expressSuccessLine ?? successLine);
        setDone(true);
      } else {
        setStepIndex((i) => i + 1);
      }
    } else {
      setBounceNote(step.expressFailLine ?? null);
      setStepIndex((i) => Math.max(0, i - 1));
    }
    window.setTimeout(() => setBounceNote(null), 3200);
  }

  function tryJanet() {
    if (Math.random() < data.janet.successChance) {
      setEndKind("janet-success");
      setEndLine(data.janet.successLine);
      setDone(true);
    } else {
      setBounceNote(data.janet.failLine);
      setStepIndex((i) => Math.max(0, i - 1));
      window.setTimeout(() => setBounceNote(null), 3200);
    }
  }

  function startOver() {
    setStepIndex(0);
    setDone(false);
    setWaiting(false);
    setBounceNote(null);
    setVisit((v) => v + 1);
  }

  const paperHeight = 10 + Math.min(stepIndex, steps.length - 1) * 3.2;

  return (
    <ExperienceLayout title="The Bureaucracy Simulator" category="Strange Thing" accent="#4e6e91" background="#1a1d22">
      <div className={styles.stage}>
        <div className={styles.visitLabel}>Visit {visit}</div>

        {!done ? (
          <>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }} />
            </div>

            <div className={styles.deskScene}>
              <div className={styles.paperStack} style={{ height: `${paperHeight}px` }}>
                {Array.from({ length: Math.min(stepIndex + 1, 9) }).map((_, i) => (
                  <div key={i} className={styles.paperSheet} style={{ transform: `rotate(${(i % 2 === 0 ? 1 : -1) * (1 + i * 0.4)}deg)` }} />
                ))}
              </div>

              <div className={styles.card}>
                <div className={styles.stepEyebrow}>Requirement {stepIndex + 1} of {steps.length}</div>
                <p className={styles.stepText}>{step.text}</p>
                <p className={styles.stepDetail}>{step.detail}</p>

                {waiting ? (
                  <div className={styles.waitTrack}>
                    <div className={styles.waitFill} style={{ width: `${waitProgress * 100}%` }} />
                  </div>
                ) : (
                  <div className={styles.buttonRow}>
                    <button type="button" className={styles.proceedButton} onClick={proceed}>
                      {step.wait ? "Join the queue" : "Continue"}
                    </button>
                    {step.expressLabel && (
                      <button type="button" className={styles.expressButton} onClick={tryExpress}>
                        {step.expressLabel}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {bounceNote && <p className={styles.bounceNote}>{bounceNote}</p>}

            {janetShown && !waiting && (
              <div className={styles.janetBox}>
                <p className={styles.janetHint}>{data.janet.hint}</p>
                <button type="button" className={styles.shortcutLink} onClick={tryJanet}>
                  Go find Janet
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.donePanel}>
            <div className={styles.stampMark}>STAMPED</div>
            <p className={styles.doneText}>
              {endKind === "normal" ? successLine : endLine}
            </p>
            <button type="button" className={styles.proceedButton} onClick={startOver}>
              Need another stamp {"\u2192"}
            </button>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
