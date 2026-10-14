import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { disable, enable, getInfo, join, pushNow, subscribeSync } from "../lib/sync";
import styles from "./SoundControl.module.css";
import sync from "./SyncPanel.module.css";

const group = (c: string) => c.replace(/(.{4})/g, "$1 ").trim();

/** Progress backup. Only appears when the optional Mirari server is reachable. */
export function SyncPanel() {
  const info = useSyncExternalStore(subscribeSync, getInfo, getInfo);
  const [open, setOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [restored, setRestored] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = (e: Event) => setRestored((e as CustomEvent<number>).detail);
    window.addEventListener("mirari:restored", on);
    return () => window.removeEventListener("mirari:restored", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (info.status !== "online") return null;

  const copy = async () => { try { await navigator.clipboard.writeText(info.code ?? ""); setMsg("Copied."); } catch { setMsg("Select the code and copy it."); } };
  const ago = info.lastSync ? Math.max(0, Math.round((Date.now() - info.lastSync) / 1000)) : null;

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={styles.btn} aria-expanded={open} aria-haspopup="true" aria-label="Back up progress" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9.5a4 4 0 0 1 0 8.5z" />
          {info.code && <path d="M9.5 13.5l2 2 3.5-4" />}
        </svg>
      </button>
      {open && (
        <div className={`${styles.panel} ${sync.panel}`} role="group" aria-label="Progress backup">
          <h3>Progress</h3>
          {restored > 0 && (
            <p className={sync.restored}>Restored {restored} save{restored > 1 ? "s" : ""} from another device. <button type="button" onClick={() => location.reload()}>Reload to use {restored > 1 ? "them" : "it"}</button></p>
          )}
          {!info.code ? (
            entering ? (
              <>
                <p className={styles.note}>Enter the code from your other device.</p>
                <input className={sync.input} value={input} onChange={(e) => setInput(e.target.value)} placeholder="XXXX XXXX XXXX" autoCapitalize="characters" spellCheck={false} aria-label="Sync code" />
                <div className={sync.row}>
                  <button type="button" className={sync.primary} disabled={info.busy || input.replace(/\W/g, "").length < 12} onClick={async () => { const n = await join(input); if (n >= 0) { setRestored(n); setEntering(false); setMsg(null); } }}>Restore</button>
                  <button type="button" onClick={() => { setEntering(false); setMsg(null); }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.note}>Your {info.keys} save{info.keys === 1 ? "" : "s"} live in this browser only. Back them up to carry them to another device. No account or email — just a code.</p>
                <div className={sync.row}>
                  <button type="button" className={sync.primary} disabled={info.busy} onClick={() => void enable()}>Back up &amp; get a code</button>
                  <button type="button" onClick={() => setEntering(true)}>I have a code</button>
                </div>
              </>
            )
          ) : (
            <>
              <p className={styles.note}>Your sync code. Anyone with it can read and overwrite this progress — treat it like a password.</p>
              <button type="button" className={sync.code} onClick={copy} aria-label={`Sync code ${group(info.code)}. Press to copy.`}>{group(info.code)}</button>
              <p className={styles.note}>{info.busy ? "Syncing…" : ago !== null ? `Last synced ${ago < 5 ? "just now" : ago < 90 ? `${ago}s ago` : `${Math.round(ago / 60)} min ago`}` : "Syncs automatically as you play."}{msg ? ` ${msg}` : ""}</p>
              <div className={sync.row}>
                <button type="button" disabled={info.busy} onClick={() => void pushNow()}>Sync now</button>
                {!confirm ? <button type="button" onClick={() => setConfirm(true)}>Turn off…</button>
                  : <><button type="button" onClick={() => { void disable(false); setConfirm(false); }}>Stop here</button><button type="button" className={sync.danger} onClick={() => { void disable(true); setConfirm(false); }}>Also delete backup</button></>}
              </div>
            </>
          )}
          {info.error && <p className={sync.error} role="alert">{info.error}</p>}
        </div>
      )}
    </div>
  );
}
