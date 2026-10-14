import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { experiences } from "../data/experiences";
import type { Category } from "../data/types";
import { playUi } from "../lib/audio";
import styles from "./Transition.module.css";

/**
 * Page transitions. Every experience enters — and leaves — in its own way.
 * The way is chosen by what kind of thing it is, with a few hand-picked exceptions.
 */
export type TStyle = "iris" | "tiles" | "scan" | "bloom" | "ink" | "curtain" | "blinds" | "warp" | "swoop" | "fade";

const BY_CATEGORY: Record<Category, TStyle> = {
  games: "iris", puzzles: "tiles", science: "scan", "tiny-worlds": "bloom",
  "interactive-art": "ink", history: "curtain", experiments: "blinds", strange: "warp",
};
const OVERRIDES: Record<string, TStyle> = {
  "witch-delivery": "swoop", "little-alchemist": "ink", "bug-hotel": "bloom", stargazer: "scan", lockmaker: "tiles",
};
const VOID = "#05070f";

function experienceAt(path: string) {
  const m = /^\/experience\/([^/]+)/.exec(path);
  return m ? experiences.find((e) => e.id === m[1]) ?? null : null;
}
function describe(path: string) {
  const e = experienceAt(path);
  return e ? { style: OVERRIDES[e.id] ?? BY_CATEGORY[e.category] ?? "bloom", accent: e.accent } : null;
}

const COVER = 480, REVEAL = 640;
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface TState { phase: "idle" | "cover" | "reveal"; style: TStyle; accent: string; x: number; y: number; key: number; home: boolean }
interface Ctx { go: (to: string, origin?: { x: number; y: number }) => void }
const TransitionCtx = createContext<Ctx>({ go: () => {} });
export const useTransition = () => useContext(TransitionCtx);

export function TransitionProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [st, setSt] = useState<TState>({ phase: "idle", style: "bloom", accent: "#8A9BFF", x: 50, y: 50, key: 0, home: false });
  const pending = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const prevPath = useRef(loc.pathname);
  const here = useRef(loc.pathname);
  here.current = loc.pathname;

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => clear, []);

  const go = useCallback((to: string, origin?: { x: number; y: number }) => {
    if (to === here.current) return;
    // arriving somewhere → that place's way in; leaving one → its way out
    const dest = describe(to) ?? describe(here.current);
    const reduced = reducedMotion();
    clear();
    pending.current = to;
    playUi("whoosh");
    setSt((s) => ({
      phase: "cover", style: reduced ? "fade" : dest?.style ?? "bloom", accent: dest?.accent ?? "#8A9BFF",
      x: origin ? (origin.x / window.innerWidth) * 100 : 50, y: origin ? (origin.y / window.innerHeight) * 100 : 50,
      key: s.key + 1, home: !describe(to),
    }));
    timers.current.push(window.setTimeout(() => nav(to), reduced ? 140 : COVER));
  }, [nav]);

  // the new page is in — reveal it
  useEffect(() => {
    if (loc.pathname === prevPath.current) return;
    prevPath.current = loc.pathname;
    const reduced = reducedMotion();
    const wasPending = pending.current !== null;
    pending.current = null;
    if (!wasPending) {
      const dest = describe(loc.pathname);
      setSt((s) => ({ phase: "reveal", style: reduced ? "fade" : dest?.style ?? "bloom", accent: dest?.accent ?? "#8A9BFF", x: 50, y: 50, key: s.key + 1, home: !dest }));
    } else setSt((s) => ({ ...s, phase: "reveal", key: s.key + 1 }));
    window.scrollTo(0, 0);
    clear();
    timers.current.push(window.setTimeout(() => setSt((s) => ({ ...s, phase: "idle" })), reduced ? 180 : REVEAL + 40));
  }, [loc.pathname]);

  const ctx = useMemo(() => ({ go }), [go]);
  const fill = `color-mix(in srgb, ${st.accent} ${st.home ? 10 : 24}%, ${VOID})`;
  const vars = { "--t-fill": fill, "--t-accent": st.accent, "--t-x": `${st.x}%`, "--t-y": `${st.y}%`, "--t-cover": `${COVER}ms`, "--t-reveal": `${REVEAL}ms` } as React.CSSProperties;

  return (
    <TransitionCtx.Provider value={ctx}>
      {children}
      <div className={styles.overlay} data-phase={st.phase} data-style={st.style} style={vars} aria-hidden="true" key={st.key}>
        {st.phase !== "idle" && <Pieces style={st.style} x={st.x} y={st.y} />}
      </div>
    </TransitionCtx.Provider>
  );
}

function Pieces({ style, x, y }: { style: TStyle; x: number; y: number }) {
  switch (style) {
    case "tiles": {
      const cols = 10, rows = 6;
      return (
        <div className={styles.grid}>
          {Array.from({ length: cols * rows }, (_, i) => {
            const cx = (i % cols + 0.5) / cols * 100, cy = (Math.floor(i / cols) + 0.5) / rows * 100;
            const d = Math.hypot(cx - x, cy - y) / 100;
            return <i key={i} style={{ animationDelay: `${Math.round(d * 220)}ms` }} />;
          })}
        </div>
      );
    }
    case "blinds": return <div className={styles.bars}>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 35}ms` }} />)}</div>;
    case "curtain": return <><i className={styles.panelL} /><i className={styles.panelR} /></>;
    case "ink":
      return (
        <>
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="14" result="b" /><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" /></filter>
          </svg>
          <div className={styles.goo}>
            {[[18, 30], [70, 20], [40, 70], [85, 75], [10, 80], [55, 40], [x, y]].map(([bx, by], i) => <i key={i} style={{ left: `${bx}%`, top: `${by}%`, animationDelay: `${i * 40}ms` }} />)}
          </div>
        </>
      );
    default: return <i className={styles.fill} />;
  }
}

/** A Link that plays the destination's transition. Modified clicks behave normally. */
export function TLink({ to, onClick, ...rest }: ComponentProps<typeof Link>) {
  const { go } = useTransition();
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank") return;
    e.preventDefault();
    go(typeof to === "string" ? to : to.pathname ?? "/", { x: e.clientX || window.innerWidth / 2, y: e.clientY || window.innerHeight / 2 });
  };
  return <Link to={to} onClick={click} {...rest} />;
}
