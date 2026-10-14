import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  CH, CHAMBERS, ITEM, ITEMS, PHASE_LABEL, RARITY_LABEL, SP, SPECIES, STAGES, WEATHER_LABEL, WORLD_H,
  type ChamberId, type ItemGroup, type ItemKind, type Phase, type Season, type SpeciesId, type Weather,
} from "./data";
import {
  advance, chamberAt, clock, createWorld, creatureAt, deserialize, describeCreature, drainToasts, journalView, mood,
  observeCreature, placeItem, removeItemAt, serialize, unlockedChambers, census,
  type World,
} from "./engine";
import { draw, drawIcon, screenToWorld, type Cam } from "./render";
import { HotelAudio } from "./audio";
import styles from "./BugHotel.module.css";

const SAVE_KEY = "mirari:bug-hotel:v1";
const PREF_KEY = "mirari:bug-hotel:prefs";
const SPEEDS = [0.5, 1, 2, 4, 8];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

type Panel = "none" | "journal" | "time" | "habitat";
type Mode = "observe" | "build";

interface Prefs { reduced: boolean; contrast: boolean; speed: number }
function loadPrefs(): Prefs {
  const sysReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null");
    if (p) return { reduced: !!p.reduced, contrast: !!p.contrast, speed: SPEEDS.includes(p.speed) ? p.speed : 1 };
  } catch { /* ignore */ }
  return { reduced: !!sysReduced, contrast: false, speed: 1 };
}

function loadWorld(): World {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (s) { const w = deserialize(s); if (w) return w; }
  } catch { /* ignore */ }
  return createWorld((Math.random() * 2 ** 31) | 0);
}

const word = (v: number, w5: [string, string, string, string, string]) => w5[Math.min(4, Math.floor(v * 5))];
const tempWord = (v: number) => word(v, ["cold", "cool", "mild", "warm", "hot"]);
const humidWord = (v: number) => word(v, ["dry", "dry-ish", "damp-ish", "damp", "wet"]);
const lightWord = (v: number) => word(v, ["dark", "dim", "soft", "bright", "sunlit"]);
const resWord = (v: number) => (v < 0.08 ? "none" : v < 0.3 ? "a little" : v < 0.6 ? "some" : "plenty");

function displayName(w: World, id: SpeciesId): string {
  const e = w.journal[id];
  const sp = SP[id];
  if (e && !e.named && sp.unknown) return sp.unknown.name;
  return sp.name;
}

interface SelInfo { id: number; sp: SpeciesId; name: string; activity: string; mood: string; hunger: string; ch: string }
interface ChInfo {
  id: ChamberId; name: string; blurb: string; temp: number; humid: number; light: number; shelter: number;
  midges: number; aphids: number; detritus: number; carrion: number;
  items: { kind: ItemKind; n: number }[]; creatures: { sp: SpeciesId; name: string; n: number }[]; pop: number; cap: number; count: number;
}
interface Hud {
  day: number; phase: Phase; season: Season; weather: Weather; stage: number; total: number; discovered: number;
  sel: SelInfo | null; ch: ChInfo | null; placed: boolean; canopyOpen: boolean;
  hotel: { sp: SpeciesId; name: string; n: number }[];
}

function snapshot(w: World, selCh: ChamberId | null): Hud {
  const c = clock(w.t);
  const pops = census(w);
  let sel: SelInfo | null = null;
  if (w.selected) {
    const cr = w.creatures.find((k) => k.id === w.selected && !k.dead);
    if (cr) {
      const m = mood(cr);
      sel = {
        id: cr.id, sp: cr.sp, name: displayName(w, cr.sp), activity: describeCreature(w, cr), mood: m,
        hunger: cr.hunger < 0.3 ? "well fed" : cr.hunger < 0.65 ? "getting hungry" : "hungry", ch: CH[cr.ch].name,
      };
    }
  }
  let ch: ChInfo | null = null;
  if (selCh && CH[selCh].stage <= w.stage) {
    const cs = w.cs[selCh];
    const items = ITEMS.filter((i) => cs.n[i.id] > 0).map((i) => ({ kind: i.id, n: cs.n[i.id] }));
    const bySp = new Map<SpeciesId, number>();
    for (const k of w.creatures) if (k.ch === selCh && !k.dead && !k.leaving) bySp.set(k.sp, (bySp.get(k.sp) ?? 0) + 1);
    ch = {
      id: selCh, name: CH[selCh].name, blurb: CH[selCh].blurb, temp: cs.temp, humid: cs.humid, light: cs.light, shelter: Math.min(1, cs.shelterAll / 3),
      midges: cs.midges, aphids: cs.aphids, detritus: cs.detritus, carrion: cs.carrion, items,
      creatures: [...bySp].map(([sp, n]) => ({ sp, name: displayName(w, sp), n })), pop: cs.pop, cap: cs.cap, count: cs.n ? Object.values(cs.n).reduce((a, b) => a + b, 0) : 0,
    };
  }
  return {
    day: c.day + 1, phase: c.phase, season: w.season, weather: w.weather, stage: w.stage,
    total: w.creatures.filter((k) => !k.dead).length, discovered: Object.keys(w.journal).length, sel, ch,
    placed: w.placedAny || w.creatures.length > 0, canopyOpen: w.stage >= 4,
    hotel: Object.entries(pops).map(([sp, n]) => ({ sp: sp as SpeciesId, name: displayName(w, sp as SpeciesId), n })).sort((a, b) => b.n - a.n),
  };
}

/* ------------------------------------------------------------------ */

export function BugHotel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(null as unknown as World);
  if (!worldRef.current) worldRef.current = loadWorld();
  const camRef = useRef({ cx: 480, cy: 360, z: 1, tx: 480, ty: 360, tz: 1 });
  const sizeRef = useRef({ cw: 800, ch: 600, dpr: 1 });
  const audioRef = useRef<HotelAudio | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, down: false, moved: false, sx: 0, sy: 0, cx0: 0, cy0: 0, inside: false });

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [mode, setMode] = useState<Mode>("observe");
  const [panel, setPanel] = useState<Panel>("none");
  const [tool, setTool] = useState<ItemKind | "remove" | null>(null);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [selCh, setSelCh] = useState<ChamberId | null>(null);
  const [hud, setHud] = useState<Hud>(() => snapshot(worldRef.current, null));
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);
  const [announce, setAnnounce] = useState("");
  const [intro, setIntro] = useState(() => !(worldRef.current.placedAny || worldRef.current.creatures.length));
  const [journalSel, setJournalSel] = useState<SpeciesId | null>(null);
  const [journalTab, setJournalTab] = useState<"creatures" | "events">("creatures");
  const [confirmReset, setConfirmReset] = useState(false);

  const live = useRef({ prefs, mode, tool, paused, selCh, sound });
  live.current = { prefs, mode, tool, paused, selCh, sound };

  /* ---------- camera ---------- */
  const baseScale = useCallback(() => {
    const { cw, ch } = sizeRef.current;
    return Math.min(cw / 740, (ch - 150) / WORLD_H);
  }, []);

  const focusChamber = useCallback((id: ChamberId | null) => {
    const cam = camRef.current;
    const b = baseScale();
    if (!id) {
      cam.tx = 480; cam.ty = 360 + 14 / b; cam.tz = 1;
    } else {
      const d = CH[id];
      const { cw, ch } = sizeRef.current;
      cam.tz = Math.max(1, Math.min(3.6, 0.82 * Math.min(cw / (d.w * b), (ch - 150) / (d.h * b))));
      cam.tx = d.x + d.w / 2; cam.ty = d.y + d.h / 2;
    }
    if (live.current.prefs.reduced) { cam.cx = cam.tx; cam.cy = cam.ty; cam.z = cam.tz; }
  }, [baseScale]);

  const selectChamber = useCallback((id: ChamberId | null, focus = true) => {
    setSelCh(id);
    if (focus) focusChamber(id);
  }, [focusChamber]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    const w = worldRef.current;
    let raf = 0, last = performance.now(), hudAcc = 0, saveAcc = 0;
    camRef.current.ty = 360 + 14 / Math.max(0.1, baseScale());
    camRef.current.cy = camRef.current.ty;

    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { cw: r.width, ch: r.height, dpr };
      canvas.width = Math.floor(r.width * dpr); canvas.height = Math.floor(r.height * dpr);
      if (camRef.current.tz === 1) { camRef.current.ty = 360 + 14 / baseScale(); camRef.current.cy = camRef.current.ty; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const L = live.current;
      const cam = camRef.current;
      const { cw, ch, dpr } = sizeRef.current;
      const base = baseScale();

      // follow a selected creature when zoomed in
      if (w.selected && cam.tz > 1.2 && !pointerRef.current.down) {
        const cr = w.creatures.find((k) => k.id === w.selected);
        if (cr) { cam.tx = cr.x; cam.ty = cr.y; }
      }
      const k = L.prefs.reduced ? 1 : 1 - Math.pow(0.002, dtReal);
      cam.cx += (cam.tx - cam.cx) * k; cam.cy += (cam.ty - cam.cy) * k; cam.z += (cam.tz - cam.z) * k;

      // what can the player see right now?
      const s = base * cam.z;
      w.view = { x0: cam.cx - cw / 2 / s, x1: cam.cx + cw / 2 / s, y0: cam.cy - ch / 2 / s, y1: cam.cy + ch / 2 / s, zoom: cam.z };

      if (!L.paused) advance(w, dtReal * L.prefs.speed);

      const p = pointerRef.current;
      let hoverCh: ChamberId | null = null;
      let ghost: { kind: ItemKind; x: number; y: number; ch: ChamberId | null } | null = null;
      if (p.inside) {
        const cc: Cam = { cx: cam.cx, cy: cam.cy, z: cam.z, base, cw, ch, dpr };
        const wp = screenToWorld(cc, p.x, p.y);
        hoverCh = chamberAt(w, wp.x, wp.y);
        if (L.mode === "build" && L.tool && L.tool !== "remove") ghost = { kind: L.tool, x: wp.x, y: wp.y, ch: hoverCh };
      }
      draw(g, w, { cx: cam.cx, cy: cam.cy, z: cam.z, base, cw, ch, dpr }, {
        t: now / 1000, reduced: L.prefs.reduced, contrast: L.prefs.contrast, selCh: L.selCh, hoverCh: L.mode === "build" ? hoverCh : null, ghost,
      });

      hudAcc += dtReal; saveAcc += dtReal;
      if (hudAcc > 0.25) {
        hudAcc = 0;
        const snap = snapshot(w, L.selCh);
        setHud(snap);
        const ts = drainToasts(w);
        if (ts.length) {
          setToasts((cur) => [...cur, ...ts].slice(-3));
          setAnnounce(ts.map((t) => t.text).join(". "));
          for (const t of ts) setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 5200);
        }
        const au = audioRef.current;
        if (au?.on) {
          const c = clock(w.t);
          let water = 0; for (const c2 of CHAMBERS) water += w.cs[c2.id].n.water;
          au.update({ phase: c.phase, weather: w.weather, rain: w.rain, wind: w.wind, creatures: w.creatures.length, water, sun: c.sun, selectedMoving: !!w.selected }, now / 1000);
        }
      }
      if (saveAcc > 15) { saveAcc = 0; try { localStorage.setItem(SAVE_KEY, serialize(w)); } catch { /* ignore */ } }
    };
    raf = requestAnimationFrame(frame);

    const persist = () => { try { localStorage.setItem(SAVE_KEY, serialize(w)); } catch { /* ignore */ } };
    const vis = () => { if (document.hidden) persist(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", persist);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", persist);
      persist();
      audioRef.current?.dispose();
    };
  }, [baseScale]);

  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);

  /* ---------- pointer ---------- */
  const toWorld = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const cam = camRef.current;
    const { cw, ch, dpr } = sizeRef.current;
    const sx = clientX - r.left, sy = clientY - r.top;
    return { sx, sy, ...screenToWorld({ cx: cam.cx, cy: cam.cy, z: cam.z, base: baseScale(), cw, ch, dpr }, sx, sy) };
  };

  const doPlace = (ch: ChamberId, x: number, y: number) => {
    const w = worldRef.current;
    const L = live.current;
    if (L.tool === "remove") { removeItemAt(w, ch, x, y); return; }
    if (L.tool) {
      const it = placeItem(w, L.tool, ch, x, y);
      if (!it) setAnnounce(`The ${CH[ch].name} is full.`);
      else setIntro(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    const wp = toWorld(e.clientX, e.clientY);
    p.down = true; p.moved = false; p.sx = wp.sx; p.sy = wp.sy; p.cx0 = camRef.current.tx; p.cy0 = camRef.current.ty;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    const wp = toWorld(e.clientX, e.clientY);
    p.x = wp.sx; p.y = wp.sy; p.inside = true;
    if (p.down) {
      const dx = wp.sx - p.sx, dy = wp.sy - p.sy;
      if (!p.moved && Math.hypot(dx, dy) > 6) p.moved = true;
      if (p.moved && camRef.current.tz > 1.05) {
        const s = baseScale() * camRef.current.z;
        camRef.current.tx = p.cx0 - dx / s; camRef.current.ty = p.cy0 - dy / s;
        camRef.current.cx = camRef.current.tx; camRef.current.cy = camRef.current.ty;
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    const was = p.down && !p.moved;
    p.down = false;
    if (!was) return;
    const w = worldRef.current;
    const wp = toWorld(e.clientX, e.clientY);
    const L = live.current;
    const ch = chamberAt(w, wp.x, wp.y);
    if (L.mode === "build" && L.tool) {
      if (ch) { doPlace(ch, wp.x, wp.y); if (!L.selCh || L.selCh !== ch) setSelCh(ch); }
      return;
    }
    const cr = creatureAt(w, wp.x, wp.y, 14);
    if (cr) {
      observeCreature(w, cr.id);
      if (L.selCh !== cr.ch) selectChamber(cr.ch, true);
      setHud(snapshot(w, cr.ch));
      return;
    }
    w.selected = 0;
    if (ch) selectChamber(ch, true);
    else selectChamber(null, true);
  };
  const onWheel = (e: React.WheelEvent) => {
    const cam = camRef.current;
    const before = toWorld(e.clientX, e.clientY);
    cam.tz = Math.max(1, Math.min(4, cam.tz * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (live.current.prefs.reduced) cam.z = cam.tz;
    if (cam.tz > 1.01) { cam.tx = cam.cx + (before.x - cam.cx) * 0.25; cam.ty = cam.cy + (before.y - cam.cy) * 0.25; }
    else { cam.tx = 480; cam.ty = 360 + 14 / baseScale(); setSelCh(null); }
  };

  /* ---------- keyboard ---------- */
  const unlocked = unlockedChambers(worldRef.current);
  const stepChamber = (dir: "left" | "right" | "up" | "down") => {
    const w = worldRef.current;
    const ids = unlockedChambers(w);
    const cur = live.current.selCh && ids.includes(live.current.selCh) ? CH[live.current.selCh] : null;
    if (!cur) { selectChamber("bark", true); return; }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best: ChamberId | null = null, bd = Infinity;
    for (const id of ids) {
      if (id === cur.id) continue;
      const d = CH[id], dx = d.x + d.w / 2 - cx, dy = d.y + d.h / 2 - cy;
      const ok = dir === "left" ? dx < -10 : dir === "right" ? dx > 10 : dir === "up" ? dy < -10 : dy > 10;
      if (!ok) continue;
      const dist = dir === "left" || dir === "right" ? Math.abs(dx) + Math.abs(dy) * 2 : Math.abs(dy) + Math.abs(dx) * 2;
      if (dist < bd) { bd = dist; best = id; }
    }
    if (best) selectChamber(best, true);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const w = worldRef.current;
    const k = e.key;
    if (k === "Escape") {
      if (panel !== "none") setPanel("none");
      else if (tool) setTool(null);
      else if (w.selected) w.selected = 0;
      else if (selCh) selectChamber(null, true);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const arrow = k === "ArrowLeft" ? "left" : k === "ArrowRight" ? "right" : k === "ArrowUp" ? "up" : k === "ArrowDown" ? "down" : null;
    if (arrow && (e.target as HTMLElement) === canvasRef.current) { e.preventDefault(); stepChamber(arrow); return; }
    if (k === "Enter" && (e.target as HTMLElement) === canvasRef.current) {
      e.preventDefault();
      if (mode === "build" && tool && selCh) { const d = CH[selCh]; doPlace(selCh, d.x + 30 + Math.random() * (d.w - 60), d.y + d.h - 14); }
      else if (selCh) focusChamber(selCh);
      return;
    }
    if (k === "b") { setMode("build"); setPanel("none"); }
    else if (k === "o") { setMode("observe"); setTool(null); }
    else if (k === "j") setPanel((p) => (p === "journal" ? "none" : "journal"));
    else if (k === "t") setPanel((p) => (p === "time" ? "none" : "time"));
    else if (k === "h") setPanel((p) => (p === "habitat" ? "none" : "habitat"));
    else if (k === " " && (e.target as HTMLElement) === canvasRef.current) { e.preventDefault(); setPaused((p) => !p); }
    else if (k === "+" || k === "=") setPrefs((p) => ({ ...p, speed: SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(p.speed) + 1)] }));
    else if (k === "-") setPrefs((p) => ({ ...p, speed: SPEEDS[Math.max(0, SPEEDS.indexOf(p.speed) - 1)] }));
  };

  /* ---------- actions ---------- */
  const toggleSound = () => {
    if (!audioRef.current) audioRef.current = new HotelAudio();
    if (audioRef.current.on) { audioRef.current.stop(); setSound(false); }
    else { audioRef.current.start(); setSound(true); }
  };

  const startOver = () => {
    const nw = createWorld((Math.random() * 2 ** 31) | 0);
    Object.assign(worldRef.current, nw);
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    setConfirmReset(false); setSelCh(null); setTool(null); setMode("observe"); setPanel("none"); setIntro(true); setJournalSel(null);
    focusChamber(null);
    setHud(snapshot(worldRef.current, null));
  };

  const chooseTool = (t: ItemKind | "remove") => {
    setTool((cur) => (cur === t ? null : t));
    setMode("build");
    setIntro(false);
    if (!selCh) selectChamber("bark", true);
  };

  const w = worldRef.current;
  const hotelSummary = hud.hotel;

  return (
    <ExperienceLayout title="Bug Hotel" category="Tiny Worlds" accent="#B7C26A" background="#0a0d0a">
      <div
        ref={wrapRef}
        className={`${styles.stage} ${prefs.contrast ? styles.contrast : ""}`}
        onKeyDown={onKey}
        data-mode={mode}
      >
        <canvas
          ref={canvasRef}
          className={`${styles.canvas} ${mode === "build" && tool ? styles.canvasBuild : ""}`}
          tabIndex={0}
          role="application"
          aria-label="Bug Hotel — a tree full of small rooms. Arrow keys move between chambers, Enter focuses a chamber or places the chosen item, Escape steps back."
          aria-keyshortcuts="B O J T H Space Escape"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { pointerRef.current.inside = false; pointerRef.current.down = false; }}
          onWheel={onWheel}
        />

        <div className={styles.srOnly} aria-live="polite" role="status">{announce}</div>

        {/* quiet status line */}
        <div className={styles.status} aria-label="Hotel status">
          <span>Day {hud.day}</span>
          <i />
          <span>{PHASE_LABEL[hud.phase]}</span>
          <i />
          <span>{hud.season[0].toUpperCase() + hud.season.slice(1)}</span>
          <i />
          <span>{WEATHER_LABEL[hud.weather]}</span>
          <i className={styles.hideSm} />
          <span className={styles.hideSm}>Stage {ROMAN[hud.stage]} · {STAGES[hud.stage - 1].name}</span>
          {paused && <b className={styles.pausedTag}>Paused</b>}
        </div>

        {/* toasts */}
        <div className={styles.toasts} aria-hidden="true">
          {toasts.map((t) => (
            <div key={t.id} className={`${styles.toast} ${styles["tone_" + t.tone]}`}>{t.text}</div>
          ))}
        </div>

        {/* intro */}
        {intro && (
          <div className={styles.intro}>
            <h2>Bug Hotel</h2>
            <p>An old tree. One small room.</p>
            <p>Put something in it. Then wait.</p>
            <p className={styles.introQ}>What will move in?</p>
            <button className={styles.primary} onClick={() => { setMode("build"); setIntro(false); selectChamber("bark", true); }}>
              Start building
            </button>
            <button className={styles.ghost} onClick={() => setIntro(false)}>Just look around</button>
          </div>
        )}

        {/* build tray */}
        {mode === "build" && panel === "none" && (
          <div className={styles.tray} role="group" aria-label="Habitat elements">
            {(["Structure", "Food", "Feature"] as ItemGroup[]).map((grp) => (
              <div key={grp} className={styles.trayGroup}>
                <span className={styles.trayLabel}>{grp === "Feature" ? "Environment" : grp === "Structure" ? "Materials" : "Food"}</span>
                <div className={styles.trayRow}>
                  {ITEMS.filter((i) => i.group === grp && !i.hidden).map((i) => {
                    const open = i.stage <= hud.stage;
                    return (
                      <button
                        key={i.id}
                        className={`${styles.itemBtn} ${tool === i.id ? styles.itemOn : ""}`}
                        disabled={!open}
                        onClick={() => chooseTool(i.id)}
                        title={open ? i.desc : `Opens at Stage ${ROMAN[i.stage]}`}
                        aria-pressed={tool === i.id}
                        aria-label={open ? `${i.label}. ${i.desc}` : `${i.label}, locked until stage ${ROMAN[i.stage]}`}
                      >
                        <span className={styles.swatch} data-kind={i.id} aria-hidden="true">{open ? i.label[0] : "·"}</span>
                        <span>{open ? i.label : "???"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className={styles.trayGroup}>
              <span className={styles.trayLabel}>&nbsp;</span>
              <div className={styles.trayRow}>
                <button className={`${styles.itemBtn} ${tool === "remove" ? styles.itemOn : ""}`} onClick={() => chooseTool("remove")} aria-pressed={tool === "remove"} title="Take something out of a chamber">
                  <span className={styles.swatch} aria-hidden="true">×</span><span>Remove</span>
                </button>
              </div>
            </div>
            <p className={styles.trayHint}>
              {tool && tool !== "remove" ? `${ITEM[tool].label}: ${ITEM[tool].desc} Tap a chamber to place it.` : tool === "remove" ? "Tap an item to take it out." : "Choose something, then tap a chamber."}
            </p>
          </div>
        )}

        {/* observe card */}
        {mode === "observe" && panel === "none" && !intro && (
          <div className={styles.card} aria-live="off">
            {hud.sel ? (
              <>
                <div className={styles.cardHead}>
                  <canvas className={styles.cardIcon} ref={(el) => { if (el) iconInto(el, hud.sel!.sp, true, 44); }} width={88} height={88} aria-hidden="true" />
                  <div>
                    <strong>{hud.sel.name}</strong>
                    <small>{hud.sel.ch}</small>
                  </div>
                </div>
                <p>{hud.sel.activity}</p>
                <p className={styles.cardMeta}>{hud.sel.mood} · {hud.sel.hunger}</p>
                <div className={styles.cardBtns}>
                  <button onClick={() => { setJournalSel(hud.sel!.sp); setPanel("journal"); }}>Open in journal</button>
                  <button onClick={() => { worldRef.current.selected = 0; setHud(snapshot(worldRef.current, selCh)); }}>Stop following</button>
                </div>
              </>
            ) : hud.ch ? (
              <p>
                <strong>{hud.ch.name}.</strong> {hud.ch.blurb} Tap a creature to watch it. Scroll or pinch to look closer.
              </p>
            ) : (
              <p>Tap a chamber to look closer. Tap a creature to follow it. The more closely you look, the more you learn.</p>
            )}
          </div>
        )}

        {/* habitat panel */}
        {panel === "habitat" && (
          <aside className={styles.sheet} aria-label="Habitat information">
            <header>
              <h3>{hud.ch ? hud.ch.name : "The hotel"}</h3>
              <button className={styles.x} onClick={() => setPanel("none")} aria-label="Close habitat information">×</button>
            </header>
            <nav className={styles.chipRow} aria-label="Chambers">
              {unlocked.map((id) => (
                <button key={id} className={`${styles.chip} ${selCh === id ? styles.chipOn : ""}`} onClick={() => selectChamber(id, true)} aria-pressed={selCh === id}>{CH[id].name}</button>
              ))}
            </nav>
            {hud.ch ? (
              <div className={styles.habitat}>
                <p className={styles.muted}>{hud.ch.blurb}</p>
                <Meter label="Warmth" v={hud.ch.temp} text={tempWord(hud.ch.temp)} />
                <Meter label="Humidity" v={hud.ch.humid} text={humidWord(hud.ch.humid)} />
                <Meter label="Light" v={hud.ch.light} text={lightWord(hud.ch.light)} />
                <Meter label="Shelter" v={hud.ch.shelter} text={hud.ch.shelter < 0.2 ? "bare" : hud.ch.shelter < 0.6 ? "some" : "plenty"} />
                <dl className={styles.dl}>
                  <dt>Midges</dt><dd>{resWord(hud.ch.midges)}</dd>
                  <dt>Aphids</dt><dd>{resWord(hud.ch.aphids)}</dd>
                  <dt>Leaf litter</dt><dd>{resWord(hud.ch.detritus)}</dd>
                  <dt>Remains</dt><dd>{resWord(hud.ch.carrion)}</dd>
                  <dt>Residents</dt><dd>{hud.ch.pop} / {hud.ch.cap}</dd>
                </dl>
                <h4>Placed here</h4>
                <p>{hud.ch.items.length ? hud.ch.items.map((i) => `${ITEM[i.kind].label} ×${i.n}`).join(", ") : "Nothing yet."}</p>
                <h4>Living here</h4>
                {hud.ch.creatures.length ? (
                  <ul className={styles.list}>
                    {hud.ch.creatures.map((c) => (
                      <li key={c.sp}>
                        <button onClick={() => {
                          const cr = w.creatures.find((k) => k.sp === c.sp && k.ch === hud.ch!.id && !k.dead);
                          if (cr) { observeCreature(w, cr.id); setPanel("none"); }
                        }}>{c.name}</button> ×{c.n}
                      </li>
                    ))}
                  </ul>
                ) : <p>Nobody, at the moment.</p>}
              </div>
            ) : (
              <div className={styles.habitat}>
                <p className={styles.muted}>{hud.total} creatures, {hud.discovered} of {SPECIES.length} species found. Pick a chamber above for detail.</p>
                {hotelSummary.length ? (
                  <ul className={styles.list}>{hotelSummary.map((s) => <li key={s.sp}>{s.name} ×{s.n}</li>)}</ul>
                ) : <p>No one has moved in yet.</p>}
              </div>
            )}
          </aside>
        )}

        {/* time panel */}
        {panel === "time" && (
          <aside className={styles.sheet} aria-label="Time and settings">
            <header>
              <h3>Time</h3>
              <button className={styles.x} onClick={() => setPanel("none")} aria-label="Close time panel">×</button>
            </header>
            <div className={styles.habitat}>
              <p className={styles.bigTime}>Day {hud.day} · {PHASE_LABEL[hud.phase]}</p>
              <p className={styles.muted}>{hud.season[0].toUpperCase() + hud.season.slice(1)} · {WEATHER_LABEL[hud.weather]}{unlockedSeasonsNote(hud.stage)}</p>
              <div className={styles.speedRow} role="group" aria-label="Simulation speed">
                <button className={styles.speedBtn} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button>
                {SPEEDS.map((s) => (
                  <button key={s} className={`${styles.speedBtn} ${prefs.speed === s ? styles.speedOn : ""}`} onClick={() => { setPrefs((p) => ({ ...p, speed: s })); setPaused(false); }} aria-pressed={prefs.speed === s}>{s === 0.5 ? "½" : s}×</button>
                ))}
              </div>
              <h4>Comfort &amp; access</h4>
              <label className={styles.toggle}><input type="checkbox" checked={prefs.reduced} onChange={(e) => setPrefs((p) => ({ ...p, reduced: e.target.checked }))} /> Reduced motion <small>Steadier camera, no drifting particles or weather streaks.</small></label>
              <label className={styles.toggle}><input type="checkbox" checked={prefs.contrast} onChange={(e) => setPrefs((p) => ({ ...p, contrast: e.target.checked }))} /> Species marks <small>Outlines creatures and labels each with a two-letter code, so nothing depends on colour.</small></label>
              <label className={styles.toggle}><input type="checkbox" checked={sound} onChange={toggleSound} /> Sound <small>Wind, rain, insects, distant birds. Quiet by design.</small></label>
              <h4>Keys</h4>
              <p className={styles.keys}><kbd>B</kbd> build · <kbd>O</kbd> observe · <kbd>J</kbd> journal · <kbd>H</kbd> habitat · <kbd>T</kbd> time · <kbd>Space</kbd> pause · <kbd>+</kbd><kbd>−</kbd> speed · arrows move between chambers · <kbd>Enter</kbd> focus or place · <kbd>Esc</kbd> back</p>
              <hr />
              {!confirmReset ? (
                <button className={styles.danger} onClick={() => setConfirmReset(true)}>Start a new hotel…</button>
              ) : (
                <div className={styles.confirm}>
                  <p>This clears your tree, your creatures, and your journal.</p>
                  <button className={styles.danger} onClick={startOver}>Yes, start over</button>
                  <button className={styles.ghost} onClick={() => setConfirmReset(false)}>Keep it</button>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* journal */}
        {panel === "journal" && (
          <Journal
            w={w} hudTick={hud.total + hud.discovered} tab={journalTab} setTab={setJournalTab}
            selected={journalSel} setSelected={setJournalSel} onClose={() => setPanel("none")}
          />
        )}

        {/* dock */}
        <nav className={styles.dock} aria-label="Bug Hotel controls">
          <DockBtn active={mode === "build" && panel === "none"} label="Build" k="B" onClick={() => { setMode("build"); setPanel("none"); setIntro(false); if (!selCh) selectChamber("bark", true); }} icon="build" />
          <DockBtn active={mode === "observe" && panel === "none"} label="Observe" k="O" onClick={() => { setMode("observe"); setTool(null); setPanel("none"); }} icon="eye" />
          <DockBtn active={panel === "journal"} label="Journal" k="J" onClick={() => setPanel((p) => (p === "journal" ? "none" : "journal"))} icon="book" badge={hud.discovered > 0 ? String(hud.discovered) : undefined} />
          <DockBtn active={panel === "time"} label="Time" k="T" onClick={() => setPanel((p) => (p === "time" ? "none" : "time"))} icon="clock" />
          <DockBtn active={panel === "habitat"} label="Habitat" k="H" onClick={() => setPanel((p) => (p === "habitat" ? "none" : "habitat"))} icon="leaf" />
        </nav>
      </div>
    </ExperienceLayout>
  );
}

function unlockedSeasonsNote(stage: number) {
  return stage < 3 ? " · only spring, so far" : "";
}

/* ------------------------------------------------------------------ */

function iconInto(el: HTMLCanvasElement, id: SpeciesId, known: boolean, size: number) {
  const key = `${id}:${known}:${size}`;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  const dpr = 2;
  el.width = size * dpr; el.height = size * dpr;
  const g = el.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  drawIcon(g, id, size, known, 0);
}

function Meter({ label, v, text }: { label: string; v: number; text: string }) {
  return (
    <div className={styles.meter}>
      <span>{label}</span>
      <div className={styles.meterBar} role="img" aria-label={`${label}: ${text}`}><i style={{ width: `${Math.round(Math.max(0.03, v) * 100)}%` }} /></div>
      <em>{text}</em>
    </div>
  );
}

function DockBtn({ label, k, onClick, active, icon, badge }: { label: string; k: string; onClick: () => void; active: boolean; icon: string; badge?: string }) {
  const paths: Record<string, string> = {
    build: "M4 20 L10 8 L14 12 L20 4 M4 20 H20",
    eye: "M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z M12 9 a3 3 0 1 0 0.01 0",
    book: "M4 5 C8 3 10 4 12 6 C14 4 16 3 20 5 V19 C16 17 14 18 12 20 C10 18 8 17 4 19 Z M12 6 V20",
    clock: "M12 3 a9 9 0 1 0 0.01 0 M12 7 V12 L16 14",
    leaf: "M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19 Z M5 19 L13 11",
  };
  return (
    <button className={`${styles.dockBtn} ${active ? styles.dockOn : ""}`} onClick={onClick} aria-pressed={active} aria-keyshortcuts={k}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[icon]} /></svg>
      <span>{label}</span>
      {badge && <b className={styles.badge}>{badge}</b>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Field journal                                                       */
/* ------------------------------------------------------------------ */

function Journal({ w, hudTick, tab, setTab, selected, setSelected, onClose }: {
  w: World; hudTick: number; tab: "creatures" | "events"; setTab: (t: "creatures" | "events") => void;
  selected: SpeciesId | null; setSelected: (s: SpeciesId | null) => void; onClose: () => void;
}) {
  void hudTick;
  const order = useMemo(() => {
    const rank = { common: 0, uncommon: 1, rare: 2, strange: 3 } as const;
    return [...SPECIES].sort((a, b) => rank[a.rarity] - rank[b.rarity]);
  }, []);
  const found = Object.keys(w.journal).length;
  const view = selected ? journalView(w, selected) : null;
  const events = w.log;
  const fmt = (t: number) => { const c = clock(t); return `Day ${c.day + 1}, ${PHASE_LABEL[c.phase].toLowerCase()}`; };
  return (
    <section className={styles.journal} aria-label="Field journal">
      <header className={styles.jHead}>
        <div>
          <h3>Field journal</h3>
          <small>{found} of {SPECIES.length} found</small>
        </div>
        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={tab === "creatures"} className={tab === "creatures" ? styles.tabOn : ""} onClick={() => setTab("creatures")}>Creatures</button>
          <button role="tab" aria-selected={tab === "events"} className={tab === "events" ? styles.tabOn : ""} onClick={() => setTab("events")}>Events</button>
        </div>
        <button className={styles.x} onClick={onClose} aria-label="Close journal">×</button>
      </header>
      {tab === "events" ? (
        <div className={styles.eventList}>
          {events.length === 0 && <p className={styles.jMuted}>Nothing has happened yet. Give it time.</p>}
          {events.map((e, i) => (
            <div key={i} className={styles.eventRow}>
              <time>{fmt(e.t)}</time>
              <p>{e.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${styles.jBody} ${selected ? styles.jDetail : ""}`}>
          <ul className={styles.jList}>
            {order.map((sp) => {
              const e = w.journal[sp.id];
              const known = !!e;
              const nm = known ? (e!.named || !sp.unknown ? sp.name : sp.unknown.name) : "Undiscovered";
              return (
                <li key={sp.id}>
                  <button className={`${styles.jCard} ${selected === sp.id ? styles.jOn : ""} ${known ? "" : styles.jUnknown}`} onClick={() => known && setSelected(sp.id)} disabled={!known} aria-label={known ? nm : `Undiscovered ${RARITY_LABEL[sp.rarity].toLowerCase()} species`}>
                    <canvas width={112} height={112} ref={(el) => { if (el) iconInto(el, sp.id, known, 56); }} aria-hidden="true" />
                    <span>{nm}</span>
                    <small>{known ? (e!.named || !sp.unknown ? RARITY_LABEL[sp.rarity] : "Unidentified") : RARITY_LABEL[sp.rarity]}</small>
                    {known && <b className={styles.glyph} aria-hidden="true">{sp.glyph}</b>}
                  </button>
                </li>
              );
            })}
          </ul>
          <article className={styles.jPage}>
            {view ? (
              <>
                <button className={styles.jBack} onClick={() => setSelected(null)}>← All creatures</button>
                <div className={styles.jTitle}>
                  <canvas width={160} height={160} ref={(el) => { if (el) iconInto(el, view.id, true, 80); }} aria-hidden="true" />
                  <div>
                    <h4>{view.title}</h4>
                    {view.latin && <em>{view.latin}</em>}
                    {view.rarity && <span className={styles.rarity} data-r={SP[view.id].rarity}>{view.rarity}</span>}
                    <small>{view.present > 0 ? `${view.present} in the hotel now` : "None in the hotel at the moment"}</small>
                  </div>
                </div>
                <dl className={styles.jFields}>
                  {view.fields.map((f) => (
                    <div key={f.label} className={f.text ? "" : styles.jLocked}>
                      <dt>{f.label}</dt>
                      <dd>{f.text ?? <span>{f.hint}</span>}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <div className={styles.jEmpty}>
                <p>Pick an entry.</p>
                <p className={styles.jMuted}>Entries start incomplete. Look closely — zoom into a chamber, follow a creature, watch it at different hours — and the pages fill in.</p>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
