import { useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  generateMechanism,
  typeLabels,
  typeIntros,
  mechanismFact,
  leverFact,
  waferFact,
  discFact,
  dialFact,
  wardedFact,
  tubularFact,
  wheelFact,
  magneticFact,
  keypadFact,
  decoyFact,
  type Mechanism,
} from "./data";
import styles from "./Lockmaker.module.css";

function factFor(mechanism: Mechanism, hasDecoys: boolean): string {
  switch (mechanism.type) {
    case "pin":
      return hasDecoys ? decoyFact : mechanismFact;
    case "lever":
      return hasDecoys ? decoyFact : leverFact;
    case "wafer":
      return hasDecoys ? decoyFact : waferFact;
    case "disc":
      return hasDecoys ? decoyFact : discFact;
    case "dial":
      return dialFact;
    case "warded":
      return wardedFact;
    case "tubular":
      return hasDecoys ? decoyFact : tubularFact;
    case "wheel":
      return wheelFact;
    case "magnetic":
      return magneticFact;
    case "keypad":
      return keypadFact;
  }
}

type LevelState = Record<string, number>;

function MechanismInterior({
  mechanism,
  onNext,
  onBack,
}: {
  mechanism: Mechanism;
  onNext: () => void;
  onBack: () => void;
}) {
  const isStack = mechanism.type === "pin" || mechanism.type === "lever" || mechanism.type === "disc" || mechanism.type === "tubular";
  const stack =
    mechanism.type === "pin" || mechanism.type === "tubular"
      ? mechanism.pins
      : mechanism.type === "lever"
        ? mechanism.levers
        : mechanism.type === "disc"
          ? mechanism.discs
          : [];
  const stackMax =
    mechanism.type === "pin" || mechanism.type === "lever" || mechanism.type === "tubular"
      ? mechanism.maxHeight
      : mechanism.type === "disc"
        ? mechanism.maxRotation
        : 1;

  const [heights, setHeights] = useState<LevelState>(() =>
    Object.fromEntries(stack.map((p) => [p.id, 1])),
  );
  const [jamId, setJamId] = useState<string | null>(null);

  const [waferState, setWaferState] = useState<Record<string, boolean>>(() =>
    mechanism.type === "wafer" ? Object.fromEntries(mechanism.wafers.map((w) => [w.id, false])) : {},
  );

  const [wardDepths, setWardDepths] = useState<Record<string, number>>(() =>
    mechanism.type === "warded" ? Object.fromEntries(mechanism.wards.map((w) => [w.id, 1])) : {},
  );
  const [wardResult, setWardResult] = useState<{ correct: number; total: number } | null>(null);

  const [wheelDigits, setWheelDigits] = useState<Record<string, number>>(() =>
    mechanism.type === "wheel" ? Object.fromEntries(mechanism.wheels.map((w) => [w.id, 0])) : {},
  );

  const [magneticValues, setMagneticValues] = useState<Record<string, number>>(() =>
    mechanism.type === "magnetic" ? Object.fromEntries(mechanism.pins.map((p) => [p.id, 50])) : {},
  );

  const [keypadGuess, setKeypadGuess] = useState<number[]>([]);
  const [keypadFeedback, setKeypadFeedback] = useState<{ exact: number; misplaced: number } | null>(null);
  const [keypadSolved, setKeypadSolved] = useState(false);

  const [dialValue, setDialValue] = useState(0);
  const [dialIndex, setDialIndex] = useState(0);
  const [dialFlash, setDialFlash] = useState(false);

  const hasDecoys =
    (isStack && stack.some((p) => p.decoy)) ||
    (mechanism.type === "wafer" && mechanism.wafers.some((w) => w.decoy));
  const solvableStack = isStack ? stack.filter((p) => !p.decoy) : [];

  const solved =
    mechanism.type === "dial"
      ? dialIndex >= mechanism.targets.length
      : mechanism.type === "wafer"
        ? mechanism.wafers.every((w) => w.decoy || waferState[w.id] === w.correct)
        : mechanism.type === "warded"
          ? wardResult !== null && wardResult.correct === wardResult.total
          : mechanism.type === "wheel"
            ? mechanism.wheels.every((w) => wheelDigits[w.id] === w.correctDigit)
            : mechanism.type === "magnetic"
              ? mechanism.pins.every((p) => Math.abs(magneticValues[p.id] - p.target) <= p.tolerance)
              : mechanism.type === "keypad"
                ? keypadSolved
                : solvableStack.length > 0 && solvableStack.every((p) => heights[p.id] === p.correctHeight);

  function cycleStackItem(id: string) {
    if (solved || !isStack) return;
    const item = stack.find((p) => p.id === id)!;
    setHeights((prev) => {
      const current = prev[id];
      if (mechanism.type !== "lever" || item.decoy) {
        // Pins and discs (and decorative decoy levers) simply wrap.
        return { ...prev, [id]: (current % stackMax) + 1 };
      }
      // Real levers: overshoot the gate and it jams, resetting to 1.
      const next = current + 1;
      if (next > item.correctHeight) {
        setJamId(id);
        window.setTimeout(() => setJamId((cur) => (cur === id ? null : cur)), 380);
        return { ...prev, [id]: 1 };
      }
      return { ...prev, [id]: next };
    });
  }

  function toggleWafer(id: string) {
    if (solved || mechanism.type !== "wafer") return;
    setWaferState((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function cycleWheel(id: string) {
    if (solved || mechanism.type !== "wheel") return;
    setWheelDigits((prev) => ({ ...prev, [id]: (prev[id] + 1) % 10 }));
  }

  function setMagnetic(id: string, value: number) {
    if (solved || mechanism.type !== "magnetic") return;
    setMagneticValues((prev) => ({ ...prev, [id]: value }));
  }

  function pressKeypadDigit(digit: number) {
    if (mechanism.type !== "keypad" || keypadSolved) return;
    setKeypadGuess((prev) => (prev.length >= mechanism.code.length ? prev : [...prev, digit]));
  }

  function clearKeypad() {
    setKeypadGuess([]);
    setKeypadFeedback(null);
  }

  function submitKeypad() {
    if (mechanism.type !== "keypad" || keypadGuess.length !== mechanism.code.length) return;
    const code = mechanism.code;
    let exact = 0;
    const codeLeftover: number[] = [];
    const guessLeftover: number[] = [];
    for (let i = 0; i < code.length; i++) {
      if (keypadGuess[i] === code[i]) exact++;
      else {
        codeLeftover.push(code[i]);
        guessLeftover.push(keypadGuess[i]);
      }
    }
    let misplaced = 0;
    const pool = [...codeLeftover];
    for (const g of guessLeftover) {
      const idx = pool.indexOf(g);
      if (idx !== -1) {
        misplaced++;
        pool.splice(idx, 1);
      }
    }
    setKeypadFeedback({ exact, misplaced });
    if (exact === code.length) {
      setKeypadSolved(true);
    } else {
      setKeypadGuess([]);
    }
  }

  function cycleWardDepth(id: string) {
    if (mechanism.type !== "warded") return;
    setWardResult(null);
    setWardDepths((prev) => {
      const max = mechanism.maxDepth;
      return { ...prev, [id]: (prev[id] % max) + 1 };
    });
  }

  function turnKey() {
    if (mechanism.type !== "warded") return;
    const correct = mechanism.wards.filter((w) => wardDepths[w.id] === w.correctDepth).length;
    setWardResult({ correct, total: mechanism.wards.length });
  }

  function turnDial(delta: number) {
    if (mechanism.type !== "dial" || solved) return;
    setDialValue((v) => {
      const next = (v + delta + mechanism.maxValue) % mechanism.maxValue;
      if (next === mechanism.targets[dialIndex]) {
        setDialFlash(true);
        window.setTimeout(() => setDialFlash(false), 260);
        setDialIndex((i) => i + 1);
      }
      return next;
    });
  }

  function reset() {
    setHeights(Object.fromEntries(stack.map((p) => [p.id, 1])));
    setDialValue(0);
    setDialIndex(0);
    if (mechanism.type === "wafer") {
      setWaferState(Object.fromEntries(mechanism.wafers.map((w) => [w.id, false])));
    }
    if (mechanism.type === "warded") {
      setWardDepths(Object.fromEntries(mechanism.wards.map((w) => [w.id, 1])));
      setWardResult(null);
    }
    if (mechanism.type === "wheel") {
      setWheelDigits(Object.fromEntries(mechanism.wheels.map((w) => [w.id, 0])));
    }
    if (mechanism.type === "magnetic") {
      setMagneticValues(Object.fromEntries(mechanism.pins.map((p) => [p.id, 50])));
    }
    if (mechanism.type === "keypad") {
      setKeypadGuess([]);
      setKeypadFeedback(null);
      setKeypadSolved(false);
    }
  }

  return (
    <div className={styles.interior}>
      <p className={styles.hint}>
        {typeIntros[mechanism.type]}
        {hasDecoys && " A few pieces here are just for show."}
      </p>

      {mechanism.type === "tubular" && (
        <div className={`${styles.tubularRing} ${solved ? styles.solved : ""}`}>
          {stack.map((item, i) => {
            const current = heights[item.id];
            const aligned = !item.decoy && current === item.correctHeight;
            const pct = (current / stackMax) * 100;
            const angle = (i / stack.length) * Math.PI * 2 - Math.PI / 2;
            const cx = 50 + Math.cos(angle) * 38;
            const cy = 50 + Math.sin(angle) * 38;
            const colClass = [
              styles.ringPin,
              aligned ? styles.aligned : "",
              solved && !item.decoy ? styles.solved : "",
              item.decoy ? styles.decoy : "",
              jamId === item.id ? styles.jammed : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={colClass}
                style={{ left: `${cx}%`, top: `${cy}%` }}
                onClick={() => cycleStackItem(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    cycleStackItem(item.id);
                  }
                }}
                aria-label={`Pin ${i + 1}, height ${current} of ${stackMax}`}
              >
                <span className={styles.pin} style={{ height: `${pct}%` }} />
              </div>
            );
          })}
          <div className={styles.tubularCore} aria-hidden="true" />
        </div>
      )}

      {isStack && mechanism.type !== "tubular" && (
        <div className={`${styles.housing} ${solved ? styles.solved : ""}`}>
          {stack.map((item, i) => {
            const current = heights[item.id];
            const aligned = !item.decoy && current === item.correctHeight;
            if (mechanism.type === "disc") {
              const rotation = (current / stackMax) * 360;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={[styles.discColumn, aligned ? styles.aligned : "", solved && !item.decoy ? styles.solved : "", item.decoy ? styles.decoy : ""].filter(Boolean).join(" ")}
                  onClick={() => cycleStackItem(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      cycleStackItem(item.id);
                    }
                  }}
                  aria-label={`Disc ${i + 1}, rotation ${current} of ${stackMax}`}
                >
                  <svg viewBox="0 0 40 40" className={styles.discSvg}>
                    <circle cx="20" cy="20" r="17" fill="#17191d" stroke="#3a414b" strokeWidth="1.5" />
                    <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "20px 20px", transition: "transform 220ms ease" }}>
                      <rect x="18" y="3" width="4" height="10" rx="1.5" fill="currentColor" />
                    </g>
                  </svg>
                  <span className={styles.pinLabel}>{i + 1}</span>
                </div>
              );
            }
            const pct = (current / stackMax) * 100;
            const colClass = [
              styles.column,
              aligned ? styles.aligned : "",
              solved && !item.decoy ? styles.solved : "",
              item.decoy ? styles.decoy : "",
              jamId === item.id ? styles.jammed : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={colClass}
                onClick={() => cycleStackItem(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    cycleStackItem(item.id);
                  }
                }}
                aria-label={`${mechanism.type === "pin" ? "Pin" : "Lever"} ${i + 1}, height ${current} of ${stackMax}`}
              >
                <span className={styles.pin} style={{ height: `${pct}%` }} />
                <span className={styles.pinLabel}>{i + 1}</span>
              </div>
            );
          })}
        </div>
      )}

      {mechanism.type === "wheel" && (
        <div className={`${styles.wheelRow} ${solved ? styles.solved : ""}`}>
          {mechanism.wheels.map((wheel, i) => {
            const digit = wheelDigits[wheel.id];
            const aligned = digit === wheel.correctDigit;
            return (
              <button
                key={wheel.id}
                type="button"
                className={[styles.wheelDigit, aligned ? styles.aligned : ""].filter(Boolean).join(" ")}
                onClick={() => cycleWheel(wheel.id)}
                aria-label={`Wheel ${i + 1}, digit ${digit}`}
              >
                <span>{digit}</span>
                <span className={styles.pinLabel}>{i + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      {mechanism.type === "magnetic" && (
        <div className={`${styles.magneticRow} ${solved ? styles.solved : ""}`}>
          {mechanism.pins.map((pin, i) => {
            const value = magneticValues[pin.id];
            const aligned = Math.abs(value - pin.target) <= pin.tolerance;
            return (
              <div key={pin.id} className={styles.magneticPin}>
                <input
                  type="range"
                  className={[styles.magneticSlider, aligned ? styles.aligned : ""].filter(Boolean).join(" ")}
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) => setMagnetic(pin.id, Number(e.target.value))}
                  aria-label={`Magnetic pin ${i + 1}, value ${value}`}
                />
                <span className={styles.pinLabel}>{i + 1}</span>
              </div>
            );
          })}
        </div>
      )}

      {mechanism.type === "keypad" && (
        <div className={styles.keypadWrap}>
          <div className={styles.keypadDisplay}>
            {Array.from({ length: mechanism.code.length }).map((_, i) => (
              <span key={i} className={styles.keypadDigitSlot}>
                {keypadGuess[i] ?? ""}
              </span>
            ))}
          </div>
          <div className={styles.keypadGrid}>
            {Array.from({ length: 10 }).map((_, d) => (
              <button
                key={d}
                type="button"
                className={styles.keypadButton}
                onClick={() => pressKeypadDigit(d)}
                disabled={keypadSolved}
              >
                {d}
              </button>
            ))}
            <button type="button" className={styles.keypadButton} onClick={clearKeypad} disabled={keypadSolved}>
              Clear
            </button>
            <button
              type="button"
              className={styles.keypadEnter}
              onClick={submitKeypad}
              disabled={keypadSolved || keypadGuess.length !== mechanism.code.length}
            >
              Enter
            </button>
          </div>
          {keypadFeedback && !keypadSolved && (
            <p className={styles.wardFeedback}>
              {keypadFeedback.exact} exactly right · {keypadFeedback.misplaced} right digit, wrong spot
            </p>
          )}
        </div>
      )}

      {mechanism.type === "wafer" && (
        <div className={`${styles.waferRow} ${solved ? styles.solved : ""}`}>
          {mechanism.wafers.map((wafer, i) => {
            const up = waferState[wafer.id];
            return (
              <button
                key={wafer.id}
                type="button"
                className={[styles.wafer, up ? styles.waferUp : styles.waferDown, wafer.decoy ? styles.decoy : ""].filter(Boolean).join(" ")}
                onClick={() => toggleWafer(wafer.id)}
                aria-label={`Wafer ${i + 1}, ${up ? "up" : "down"}`}
              >
                <span className={styles.waferBlade} />
                <span className={styles.pinLabel}>{i + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      {mechanism.type === "warded" && (
        <div className={styles.wardedWrap}>
          <div className={styles.wardRow}>
            {mechanism.wards.map((ward, i) => (
              <button
                key={ward.id}
                type="button"
                className={styles.wardNotch}
                onClick={() => cycleWardDepth(ward.id)}
                aria-label={`Ward ${i + 1}, notch depth ${wardDepths[ward.id]} of ${mechanism.maxDepth}`}
              >
                <span className={styles.wardNotchBox}>
                  <span
                    className={styles.wardTeeth}
                    style={{ height: `${(wardDepths[ward.id] / mechanism.maxDepth) * 100}%` }}
                  />
                </span>
                <span className={styles.pinLabel}>{i + 1}</span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.turnKeyButton} onClick={turnKey}>
            Turn the key
          </button>
          {wardResult && !solved && (
            <p className={styles.wardFeedback}>
              {wardResult.correct} of {wardResult.total} wards cleared.
            </p>
          )}
        </div>
      )}

      {mechanism.type === "dial" && (
        <div className={`${styles.dialWrap} ${dialFlash ? styles.dialFlash : ""}`}>
          <svg viewBox="0 0 200 200" className={styles.dialSvg}>
            <circle cx="100" cy="100" r="88" fill="#17191d" stroke="#3a414b" strokeWidth="2" />
            {Array.from({ length: mechanism.maxValue }).map((_, i) => {
              const angle = (i / mechanism.maxValue) * Math.PI * 2 - Math.PI / 2;
              const x = 100 + Math.cos(angle) * 78;
              const y = 100 + Math.sin(angle) * 78;
              return <circle key={i} cx={x} cy={y} r="2" fill="#4e5560" />;
            })}
            <g
              style={{
                transform: `rotate(${(dialValue / mechanism.maxValue) * 360}deg)`,
                transformOrigin: "100px 100px",
                transition: "transform 200ms ease",
              }}
            >
              <line x1="100" y1="100" x2="100" y2="26" stroke="#b88a45" strokeWidth="4" strokeLinecap="round" />
              <circle cx="100" cy="100" r="10" fill="#b88a45" />
            </g>
          </svg>
          <div className={styles.dialValue}>{dialValue}</div>
          <div className={styles.dialControls}>
            <button type="button" className={styles.dialButton} onClick={() => turnDial(-1)} aria-label="Turn dial left">
              ↺
            </button>
            <button type="button" className={styles.dialButton} onClick={() => turnDial(1)} aria-label="Turn dial right">
              ↻
            </button>
          </div>
          <div className={styles.dialProgress}>
            {dialIndex} / {mechanism.targets.length} numbers set
          </div>
        </div>
      )}

      <div className={styles.interiorActions}>
        <button type="button" className={styles.backToExterior} onClick={onBack}>
          ← Close the case
        </button>
        <button type="button" className={styles.miniReset} onClick={reset}>
          Reset
        </button>
      </div>

      {solved && (
        <div className={styles.solvedPanel} role="status">
          <div className={styles.solvedCard}>
            <div className={styles.solvedTitle}>The mechanism turns.</div>
            <p className={styles.solvedFact}>{factFor(mechanism, hasDecoys)}</p>
            <button type="button" className={styles.nextButton} onClick={onNext}>
              Next mechanism →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Lockmaker() {
  const [view, setView] = useState<"exterior" | "interior">("exterior");
  const [level, setLevel] = useState(1);
  const mechanism = useMemo(() => generateMechanism(level), [level]);

  function startInspecting() {
    setView("interior");
  }

  function nextMechanism() {
    setLevel((l) => l + 1);
  }

  return (
    <ExperienceLayout
      title="The Lockmaker"
      category="Puzzle · Mechanism"
      accent="#B88A45"
      background="#101114"
    >
      <div className={styles.stage}>
        <div className={styles.panel}>
          <div className={styles.levelBadge}>
            Mechanism {level} · {typeLabels[mechanism.type]}
          </div>
          {view === "exterior" ? (
            <div className={styles.exterior}>
              <div className={styles.faceWrap}>
                <svg viewBox="0 0 200 200">
                  <g className={styles.faceRing}>
                    <circle cx="100" cy="100" r="92" fill="none" stroke="#3a414b" strokeWidth="2" />
                    {Array.from({ length: 24 }).map((_, i) => {
                      const angle = (i / 24) * Math.PI * 2;
                      const x1 = 100 + Math.cos(angle) * 84;
                      const y1 = 100 + Math.sin(angle) * 84;
                      const x2 = 100 + Math.cos(angle) * 92;
                      const y2 = 100 + Math.sin(angle) * 92;
                      return (
                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4e5560" strokeWidth="1.5" />
                      );
                    })}
                  </g>
                  <circle cx="100" cy="100" r="74" fill="#17191d" stroke="#b88a45" strokeWidth="2" />
                  <circle cx="100" cy="88" r="14" fill="#8e98a4" />
                  <path d="M 92 96 L 108 96 L 103 128 L 97 128 Z" fill="#8e98a4" />
                </svg>
              </div>
              <p className={styles.prompt}>
                {level === 1
                  ? "A closed mechanism. Its case gives nothing away — the only way to understand it is to open it up."
                  : `A new mechanism: ${typeLabels[mechanism.type]}.`}
              </p>
              <button type="button" className={styles.inspectButton} onClick={startInspecting}>
                Inspect the mechanism
              </button>
            </div>
          ) : (
            <MechanismInterior
              key={level}
              mechanism={mechanism}
              onNext={nextMechanism}
              onBack={() => setView("exterior")}
            />
          )}
        </div>
      </div>
    </ExperienceLayout>
  );
}
