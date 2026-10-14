import { useEffect, useRef, useState } from "react";
import { getAudioPrefs, playUi, setAudioPrefs, subscribeAudio, type AudioPrefs } from "../lib/audio";
import styles from "./SoundControl.module.css";

/** A small speaker button; opens the archive-wide mute / volume / interface-sound panel. */
export function SoundControl({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<AudioPrefs>(getAudioPrefs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeAudio(setPrefs), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const off = prefs.muted || prefs.volume === 0;
  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button" className={styles.btn} aria-expanded={open} aria-haspopup="true"
        aria-label={off ? "Sound settings (muted)" : "Sound settings"} onClick={() => { setOpen((o) => !o); playUi("toggle"); }}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
          {off ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></>}
        </svg>
      </button>
      {open && (
        <div className={`${styles.panel} ${align === "left" ? styles.left : ""}`} role="group" aria-label="Sound">
          <label className={styles.row}>
            <input type="checkbox" checked={prefs.muted} onChange={(e) => setAudioPrefs({ muted: e.target.checked })} />
            <span>Mute everything</span>
          </label>
          <label className={styles.slider}>
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => setAudioPrefs({ volume: Number(e.target.value), muted: false })} aria-valuetext={`${Math.round(prefs.volume * 100)} percent`} />
          </label>
          <label className={styles.row}>
            <input type="checkbox" checked={prefs.ui} onChange={(e) => { setAudioPrefs({ ui: e.target.checked }); if (e.target.checked) setTimeout(() => playUi("select"), 30); }} />
            <span>Interface sounds <small>Quiet ticks, chimes, and page-turn whooshes.</small></span>
          </label>
          <p className={styles.note}>This sets the master level for every experience. Each one still starts silent until you turn its own sound on.</p>
        </div>
      )}
    </div>
  );
}
