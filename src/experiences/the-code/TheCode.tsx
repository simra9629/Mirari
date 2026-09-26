import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { toMorse, morseSchedule, textToGlyphs, type GlyphShape } from "./data";
import styles from "./TheCode.module.css";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function caesarEncode(text: string, shift: number): string {
  return text
    .toUpperCase()
    .split("")
    .map((ch) => {
      const idx = ALPHABET.indexOf(ch);
      if (idx === -1) return ch;
      return ALPHABET[(idx + shift + 26) % 26];
    })
    .join("");
}

function wheelPoint(index: number, radius: number, cx: number, cy: number) {
  const angle = (index / ALPHABET.length) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

type Tab = "substitution" | "morse" | "symbol";

export function TheCode() {
  const [tab, setTab] = useState<Tab>("substitution");
  const [message, setMessage] = useState("MIRARI");
  const [shift, setShift] = useState(5);
  const [morseText, setMorseText] = useState("MIRARI");
  const [symbolText, setSymbolText] = useState("MIRARI");
  const [lampOn, setLampOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      audioCtxRef.current?.close();
    };
  }, []);

  const encoded = caesarEncode(message, shift);
  const morse = toMorse(morseText);
  const glyphs = textToGlyphs(symbolText);

  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  function playMorse() {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    const schedule = morseSchedule(morse);
    let elapsed = 0;
    setPlaying(true);

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 620;
    gain.gain.setValueAtTime(0, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);

    for (const symbol of schedule) {
      if (symbol.kind === "dot" || symbol.kind === "dash") {
        const onAt = elapsed;
        const offAt = elapsed + symbol.duration;
        timeoutsRef.current.push(window.setTimeout(() => setLampOn(true), onAt));
        timeoutsRef.current.push(window.setTimeout(() => setLampOn(false), offAt));
        gain.gain.setValueAtTime(0.16, now + onAt / 1000);
        gain.gain.setValueAtTime(0, now + offAt / 1000);
      }
      elapsed += symbol.duration;
    }
    osc.stop(now + elapsed / 1000 + 0.05);
    timeoutsRef.current.push(window.setTimeout(() => setPlaying(false), elapsed + 100));
  }

  const cx = 140;
  const cy = 140;
  const outerR = 118;
  const innerR = 82;

  return (
    <ExperienceLayout title="The Code" category="History & Culture" accent="#6288d7" background="#0b1120">
      <div className={styles.stage}>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${tab === "substitution" ? styles.tabActive : ""}`} onClick={() => setTab("substitution")}>
            Substitution
          </button>
          <button type="button" className={`${styles.tab} ${tab === "morse" ? styles.tabActive : ""}`} onClick={() => setTab("morse")}>
            Morse
          </button>
          <button type="button" className={`${styles.tab} ${tab === "symbol" ? styles.tabActive : ""}`} onClick={() => setTab("symbol")}>
            Symbol
          </button>
        </div>

        {tab === "substitution" && (
          <div className={styles.panel}>
            <svg viewBox="0 0 280 280" className={styles.wheel}>
              <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#3a4a75" strokeWidth={1} />
              <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#3a4a75" strokeWidth={1} />
              {ALPHABET.map((letter, i) => {
                const p = wheelPoint(i, (outerR + innerR) / 2 + 20, cx, cy);
                return (
                  <text key={`o${i}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#e6eaf2">
                    {letter}
                  </text>
                );
              })}
              <g style={{ transform: `rotate(${-shift * (360 / 26)}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
                {ALPHABET.map((letter, i) => {
                  const p = wheelPoint(i, innerR - 22, cx, cy);
                  return (
                    <text key={`i${i}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#6288d7">
                      {letter}
                    </text>
                  );
                })}
              </g>
              <circle cx={cx} cy={cy} r={4} fill="#c86a6a" />
            </svg>

            <div className={styles.controls}>
              <label className={styles.fieldLabel} htmlFor="message-input">Message</label>
              <input
                id="message-input"
                type="text"
                className={styles.textInput}
                value={message}
                maxLength={24}
                onChange={(e) => setMessage(e.target.value)}
              />

              <label className={styles.fieldLabel} htmlFor="shift-input">Shift the wheel: {shift}</label>
              <input
                id="shift-input"
                type="range"
                className={styles.slider}
                min={0}
                max={25}
                step={1}
                value={shift}
                onChange={(e) => setShift(parseInt(e.target.value, 10))}
              />

              <div className={styles.outputLabel}>Encoded</div>
              <div className={styles.output}>{encoded || "\u00A0"}</div>
            </div>
          </div>
        )}

        {tab === "morse" && (
          <div className={styles.panel}>
            <div className={styles.lampWrap}>
              <div className={`${styles.lamp} ${lampOn ? styles.lampOn : ""}`} />
            </div>

            <div className={styles.controls}>
              <label className={styles.fieldLabel} htmlFor="morse-input">Message</label>
              <input
                id="morse-input"
                type="text"
                className={styles.textInput}
                value={morseText}
                maxLength={24}
                onChange={(e) => setMorseText(e.target.value)}
              />

              <div className={styles.outputLabel}>In Morse</div>
              <div className={styles.output}>{morse || "\u00A0"}</div>

              <button type="button" className={styles.playButton} onClick={playMorse} disabled={playing || morse.length === 0}>
                {playing ? "Sending…" : "Play the signal"}
              </button>
            </div>
          </div>
        )}

        {tab === "symbol" && (
          <div className={styles.panel}>
            <div className={styles.glyphRow}>
              {glyphs.map((g, i) =>
                g ? <GlyphIcon key={i} shape={g} /> : <span key={i} className={styles.glyphGap} />,
              )}
            </div>

            <div className={styles.controls}>
              <label className={styles.fieldLabel} htmlFor="symbol-input">Message</label>
              <input
                id="symbol-input"
                type="text"
                className={styles.textInput}
                value={symbolText}
                maxLength={16}
                onChange={(e) => setSymbolText(e.target.value)}
              />
              <p className={styles.symbolNote}>
                An invented cipher, not a historical one — 26 unambiguous
                symbols, each built from a frame and an optional dot.
              </p>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}

function GlyphIcon({ shape }: { shape: GlyphShape }) {
  const s = shape.sides;
  return (
    <svg viewBox="0 0 24 24" className={styles.glyphIcon}>
      {s.includes("top") && <line x1={3} y1={3} x2={21} y2={3} />}
      {s.includes("right") && <line x1={21} y1={3} x2={21} y2={21} />}
      {s.includes("bottom") && <line x1={3} y1={21} x2={21} y2={21} />}
      {s.includes("left") && <line x1={3} y1={3} x2={3} y2={21} />}
      {shape.dot && <circle cx={12} cy={12} r={2} fill="#6288d7" stroke="none" />}
    </svg>
  );
}
