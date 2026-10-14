import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { buildPage, checkCaseCapacity, sanitizePhrase, CASE_TILES, SUGGESTED_PHRASES, MAX_PHRASE_LENGTH } from "./data";
import styles from "./PrintingPress.module.css";

type Phase = "idle" | "inking" | "descending" | "impact" | "lifting" | "done";

const PHASE_DURATIONS: Record<Exclude<Phase, "idle" | "done">, number> = {
  inking: 420,
  descending: 480,
  impact: 220,
  lifting: 620,
};

export function PrintingPress() {
  const [printCount, setPrintCount] = useState(0);
  const [input, setInput] = useState("MIRARI");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  const page = useMemo(() => (phrase ? buildPage(phrase) : null), [phrase]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrongId, setWrongId] = useState<number | null>(null);
  const [usedIds, setUsedIds] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);

  const lettersOnly = useMemo(() => (phrase ? phrase.split("").filter((ch) => ch !== " ") : []), [phrase]);
  const letterCount = lettersOnly.length;
  const composed = phrase !== null && placed.length === letterCount;
  const pressed = phase === "done";
  const busy = phase !== "idle" && phase !== "done";

  useEffect(() => () => { for (const t of timers.current) window.clearTimeout(t); }, []);

  function setThePhrase() {
    const clean = sanitizePhrase(input);
    if (clean.replace(/ /g, "").length === 0) {
      setCapacityError("Set at least one letter.");
      return;
    }
    const check = checkCaseCapacity(clean);
    if (!check.ok) {
      setCapacityError(`The case is out of sorts \u2014 not enough ${check.shortLetter}'s for that phrase.`);
      return;
    }
    setCapacityError(null);
    setPhrase(clean);
    setPlaced([]);
    setUsedIds(new Set());
    setWrongId(null);
    setPhase("idle");
  }

  function pickTile(id: number, letter: string) {
    if (busy || pressed || !phrase) return;
    const nextIndex = placed.length;
    if (letter === lettersOnly[nextIndex]) {
      setPlaced((p) => [...p, letter]);
      setUsedIds((prev) => new Set(prev).add(id));
    } else {
      setWrongId(id);
      window.setTimeout(() => setWrongId(null), 380);
    }
  }

  function press() {
    if (!composed || busy || pressed) return;
    setPhase("inking");
    const t1 = window.setTimeout(() => setPhase("descending"), PHASE_DURATIONS.inking);
    const t2 = window.setTimeout(() => setPhase("impact"), PHASE_DURATIONS.inking + PHASE_DURATIONS.descending);
    const t3 = window.setTimeout(
      () => setPhase("lifting"),
      PHASE_DURATIONS.inking + PHASE_DURATIONS.descending + PHASE_DURATIONS.impact,
    );
    const t4 = window.setTimeout(
      () => { setPhase("done"); setPrintCount((n) => n + 1); },
      PHASE_DURATIONS.inking + PHASE_DURATIONS.descending + PHASE_DURATIONS.impact + PHASE_DURATIONS.lifting,
    );
    timers.current.push(t1, t2, t3, t4);
  }

  function nextPage() {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    setPhrase(null);
    setPlaced([]);
    setUsedIds(new Set());
    setWrongId(null);
    setPhase("idle");
    setInput("");
  }

  const pressMessage =
    phase === "inking" ? "Inking the type\u2026" :
    phase === "descending" ? "Lowering the platen\u2026" :
    phase === "impact" ? "Pressing\u2026" :
    phase === "lifting" ? "Lifting the sheet\u2026" :
    "Press the page";

  return (
    <ExperienceLayout title="The Printing Press" category="History & Culture" accent="#9b4a43" background="#141414">
      <div className={styles.stage}>
        <div className={styles.pageLabel}>{printCount} page{printCount === 1 ? "" : "s"} printed</div>

        {!phrase ? (
          <div className={styles.setupPanel}>
            <p className={styles.hint}>
              Set anything the case can hold \u2014 up to {MAX_PHRASE_LENGTH} letters. Only A\u2013Z and
              spaces; the case has no numbers or punctuation.
            </p>
            <input
              className={styles.textInput}
              value={input}
              onChange={(e) => { setInput(e.target.value); setCapacityError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") setThePhrase(); }}
              placeholder="Type a phrase to set"
              maxLength={MAX_PHRASE_LENGTH}
              autoFocus
            />
            {capacityError && <p className={styles.capacityError}>{capacityError}</p>}
            <button type="button" className={styles.pressButton} onClick={setThePhrase}>
              Set this phrase
            </button>
            <div className={styles.suggestions}>
              {SUGGESTED_PHRASES.map((s) => (
                <button key={s} type="button" className={styles.suggestionChip} onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <p className={styles.hint}>
              The type sits reversed in the stick, the way it has to for printing.
              Find each letter in the case, in reading order — you'll only see
              the phrase the right way round once it's pressed.
            </p>

            <div className={styles.stick}>
              {Array.from({ length: letterCount }).map((_, i) => (
                <span key={i} className={styles.stickSlot}>
                  {placed[i] ? <span className={styles.mirroredLetter}>{placed[i]}</span> : ""}
                </span>
              ))}
              <div className={`${styles.inkSweep} ${phase === "inking" ? styles.inkSweepActive : ""}`} />
            </div>

            <div className={styles.trayLabel}>The case</div>
            <div className={styles.tray}>
              {CASE_TILES.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className={`${styles.tile} ${usedIds.has(tile.id) ? styles.tileUsed : ""} ${wrongId === tile.id ? styles.tileWrong : ""}`}
                  onClick={() => pickTile(tile.id, tile.letter)}
                  disabled={usedIds.has(tile.id) || busy || pressed}
                >
                  <span className={styles.mirroredLetter}>{tile.letter}</span>
                </button>
              ))}
            </div>

            <button type="button" className={styles.pressButton} onClick={press} disabled={!composed || busy || pressed}>
              {pressMessage}
            </button>

            <div className={styles.pressBed}>
              <div className={styles.bedType}>
                {placed.map((letter, i) => (
                  <span key={i} className={styles.bedLetter}>{letter}</span>
                ))}
              </div>

              <div
                className={[
                  styles.paper,
                  phase === "descending" ? styles.paperDescending : "",
                  phase === "impact" ? styles.paperImpact : "",
                  phase === "lifting" ? styles.paperLifting : "",
                  pressed ? styles.paperSettled : "",
                ].join(" ")}
              >
                {pressed && page ? (
                  <span className={styles.printedText}>
                    {page.phrase.split("").map((ch, i) =>
                      ch === " " ? (
                        <span key={i} className={styles.printedSpace} />
                      ) : (
                        <span
                          key={i}
                          className={styles.printedLetter}
                          style={{
                            transform: `rotate(${page.jitter[i]?.rot ?? 0}deg) translateY(${page.jitter[i]?.base ?? 0}px)`,
                            opacity: page.jitter[i]?.ink ?? 1,
                          }}
                        >
                          {ch}
                        </span>
                      ),
                    )}
                  </span>
                ) : (
                  <span className={styles.paperBlank}>blank page</span>
                )}
              </div>
            </div>

            {pressed && (
              <button type="button" className={styles.nextButton} onClick={nextPage}>
                Set a new phrase {"\u2192"}
              </button>
            )}
          </>
        )}
      </div>
    </ExperienceLayout>
  );
}
