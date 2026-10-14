import { useCallback, useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  CUSTOMER, CUSTOMERS, DISTRICTS, LANDMARKS, LOC, PACKAGES, PKG, SECRETS, TIER_LABEL, UPGRADES, WEATHERS, WORLD_W,
  type PkgId,
} from "./data";
import {
  abandonQuest, acceptOffer, advance, buyUpgrade, closeResult, createGame, defaultSave, districtOpen, drainEvents, makeOffers,
  normalizeSave, snapshot, upgradeLv, unlockedTier, weatherOpen, type Game, type Hud, type Offer,
} from "./engine";
import { buildWorld } from "./world";
import { draw, drawPackage, drawPerson } from "./render";
import { WitchAudio } from "./audio";
import styles from "./WitchDelivery.module.css";

const SAVE_KEY = "mirari:witch-delivery:v1";
const PREF_KEY = "mirari:witch-delivery:prefs";
type Modal = "none" | "board" | "broom" | "log" | "pause" | "welcome";

interface Prefs { reduced: boolean; contrast: boolean }
function loadPrefs(): Prefs {
  const sys = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null"); if (p) return { reduced: !!p.reduced, contrast: !!p.contrast }; } catch { /* ignore */ }
  return { reduced: !!sys, contrast: false };
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) return normalizeSave(JSON.parse(s)); } catch { /* ignore */ }
  return defaultSave();
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const stars = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

function Icon({ kind, id, size = 44, t = 0 }: { kind: "pkg" | "person"; id: string; size?: number; t?: number }) {
  return (
    <canvas
      width={size * 2} height={size * 2} className={styles.icon} style={{ width: size, height: size }} aria-hidden="true"
      ref={(el) => {
        if (!el) return;
        const key = `${kind}:${id}:${size}`;
        if (el.dataset.k === key) return;
        el.dataset.k = key;
        const g = el.getContext("2d")!;
        g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, size, size);
        if (kind === "pkg") { g.translate(size / 2, size / 2); drawPackage(g, id as PkgId, size * 0.3, t, {}, 1); }
        else { const c = CUSTOMER[id as keyof typeof CUSTOMER]; drawPerson(g, size / 2, size * 0.92, size / 56, c.color, c.hat, t); }
      }}
    />
  );
}

export function WitchDelivery() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const world = useRef(buildWorld(11)).current;
  const gameRef = useRef<Game>(null as unknown as Game);
  if (!gameRef.current) gameRef.current = createGame(world, loadSave(), (Math.random() * 2 ** 31) | 0);
  const audioRef = useRef<WitchAudio | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const ptr = useRef({ down: false, x: 0, y: 0, touch: false });
  const touchBtn = useRef({ boost: false, flourish: false });
  const sizeRef = useRef({ cw: 800, ch: 600, dpr: 1 });

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [modal, setModal] = useState<Modal>(() => (gameRef.current.save.intro ? "none" : "welcome"));
  const [hud, setHud] = useState<Hud>(() => snapshot(gameRef.current));
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: string }[]>([]);
  const [announce, setAnnounce] = useState("");
  const [sound, setSound] = useState(false);
  const [logTab, setLogTab] = useState<"secrets" | "people" | "parcels" | "routes" | "weather">("secrets");
  const [confirmReset, setConfirmReset] = useState(false);
  const [tick, setTick] = useState(0);
  const [touch, setTouch] = useState(false);
  const live = useRef({ prefs, modal });
  live.current = { prefs, modal };
  const toastId = useRef(1);

  const save = useCallback(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(gameRef.current.save)); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g2 = canvas.getContext("2d")!;
    const G = gameRef.current;
    let raf = 0, last = performance.now(), hudAcc = 0, saveAcc = 0, lastDelivered = G.save.delivered;
    const resize = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { cw: r.width, ch: r.height, dpr };
      canvas.width = Math.floor(r.width * dpr); canvas.height = Math.floor(r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrapRef.current!);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const L = live.current;
      const k = keys.current, p = ptr.current;
      // input
      let ix = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0);
      let iy = (k.arrowdown || k.s ? 1 : 0) - (k.arrowup || k.w ? 1 : 0);
      if (p.down) {
        const { cw, ch } = sizeRef.current;
        const sc = Math.max(0.5, Math.min(1.6, ch / 760));
        const sx = (G.p.x - G.cam.x) * sc + cw / 2, sy = (G.p.y - G.cam.y) * sc + ch / 2;
        const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy);
        if (d > 14) { const m = Math.min(1, d / 120); ix = (dx / d) * m; iy = (dy / d) * m; }
      }
      G.input.x = ix; G.input.y = iy;
      G.input.boost = !!(k.shift || touchBtn.current.boost);
      G.input.flourish = !!(k[" "] || touchBtn.current.flourish);
      G.paused = L.modal !== "none";
      advance(G, dt);
      const { cw, ch, dpr } = sizeRef.current;
      draw(g2, G, { t: now / 1000, reduced: L.prefs.reduced, contrast: L.prefs.contrast, cw, ch, dpr });

      hudAcc += dt; saveAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        const h = snapshot(G);
        setHud(h);
        const evs = drainEvents(G);
        const newToasts: { id: number; text: string; tone: string }[] = [];
        for (const e of evs) {
          if (e.type === "toast" && e.text) newToasts.push({ id: toastId.current++, text: e.text, tone: e.tone ?? "info" });
          else if (e.type === "sfx" && e.name) audioRef.current?.play(e.name, e.v ?? 1);
          else if (e.type === "ann" && e.text) setAnnounce(e.text);
        }
        if (newToasts.length) {
          setToasts((cur) => [...cur, ...newToasts].slice(-3));
          setAnnounce((a) => newToasts.map((t) => t.text).join(". ") || a);
          for (const t of newToasts) setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), t.tone === "secret" ? 7000 : 4600);
        }
        if (G.result && live.current.modal === "none") { setModal("board"); }
        if (G.save.delivered !== lastDelivered) { lastDelivered = G.save.delivered; save(); }
        const au = audioRef.current;
        if (au?.on) {
          const pk = G.pkg;
          au.update({ speed: G.p.speed, wind: G.weather.wind, rain: G.weather.rain, storm: G.weather.storm, boosting: G.input.boost && !G.p.boostLock && G.p.boost > 0, night: h.light < 0.4, magic: G.weather.magic, pkg: pk && G.quest?.phase === "carry" ? pk.def.id : "", sing: !!pk?.s.sing, awake: !!pk?.s.awake, stolen: !!pk && pk.stolen > 0, glow: 1 - h.light }, now / 1000);
        }
        // minimap
        const mc = miniRef.current;
        if (mc) {
          const m = mc.getContext("2d")!;
          const W = mc.width, H = mc.height;
          m.clearRect(0, 0, W, H);
          for (const d of DISTRICTS) {
            const open = districtOpen(G.save.delivered, d.id);
            m.fillStyle = open ? d.palette.far : "#1a1a26"; m.globalAlpha = open ? 0.9 : 0.5;
            m.fillRect((d.x0 / WORLD_W) * W, 4, ((d.x1 - d.x0) / WORLD_W) * W - 1, H - 8);
          }
          m.globalAlpha = 1;
          for (const lm of LANDMARKS) { m.fillStyle = "rgba(255,255,255,0.45)"; m.fillRect((G.w.pads[lm.id].x / WORLD_W) * W - 1, H - 14, 2, 8); }
          if (h.target) { const tx = (G.w.pads[h.target.id].x / WORLD_W) * W; m.fillStyle = "#ffd47a"; m.beginPath(); m.arc(tx, H / 2, 4.5, 0, 6.3); m.fill(); }
          m.fillStyle = "#fff"; m.beginPath(); m.arc((G.p.x / WORLD_W) * W, Math.max(6, Math.min(H - 6, (G.p.y / 1340) * H)), 3, 0, 6.3); m.fill();
        }
      }
      if (saveAcc > 12) { saveAcc = 0; save(); }
    };
    raf = requestAnimationFrame(frame);

    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (live.current.modal !== "none") { if (key === "escape") { setModal("none"); } return; }
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) e.preventDefault();
      keys.current[key] = true;
      if (e.shiftKey) keys.current.shift = true;
      if (key === "escape" || key === "p") setModal("pause");
      else if (key === "b") setModal("board");
      else if (key === "u") setModal("broom");
      else if (key === "l") setModal("log");
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; if (e.key === "Shift") keys.current.shift = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    const vis = () => { if (document.hidden) { save(); keys.current = {}; } };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", save);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", save);
      save(); audioRef.current?.dispose();
    };
  }, [save]);

  /* ---------- pointer / touch ---------- */
  const rel = (e: React.PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onDown = (e: React.PointerEvent) => {
    if (modal !== "none") return;
    const q = rel(e); ptr.current = { down: true, x: q.x, y: q.y, touch: e.pointerType === "touch" };
    if (e.pointerType === "touch") setTouch(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => { if (!ptr.current.down) return; const q = rel(e); ptr.current.x = q.x; ptr.current.y = q.y; };
  const onUp = () => { ptr.current.down = false; };

  const G = gameRef.current;
  const toggleSound = () => {
    if (!audioRef.current) audioRef.current = new WitchAudio();
    if (audioRef.current.on) { audioRef.current.stop(); setSound(false); } else { audioRef.current.start(); setSound(true); }
  };
  const openModal = (m: Modal) => { setModal(m); keys.current = {}; ptr.current.down = false; };

  /* ---------- pieces ---------- */
  const q = hud.quest;
  const phaseText = hud.phase === "pickup" ? `Collect from ${q?.from}` : hud.phase === "carry" ? `Deliver to ${q?.to}` : "";
  const overLimit = q && hud.phase === "carry" && q.elapsed > q.par;

  const boardOffer = (o: Offer) => {
    const def = PKG[o.pkg];
    return (
      <li key={o.id} className={styles.offer}>
        <Icon kind="pkg" id={o.pkg} size={56} />
        <div className={styles.offerBody}>
          <div className={styles.offerHead}><strong>{def.name}</strong><span className={`${styles.tier} ${styles["tier" + o.tier]}`}>{TIER_LABEL[o.tier]}</span></div>
          <p className={styles.offerNote}>“{def.note}”</p>
          <p className={styles.offerRoute}>{LOC[o.from].name} <i>→</i> {LOC[o.to].name} · for {CUSTOMER[o.customer].name}</p>
          <div className={styles.chips}>
            <span>{o.constraint.text}</span>
            <span>Par {fmtTime(o.par)}</span>
            {o.objective && <span className={styles.bonus}>Bonus: {o.objective.text}</span>}
            <span className={styles.coins}>≈ {o.reward} ◎</span>
          </div>
        </div>
        <button className={styles.primary} onClick={() => { acceptOffer(G, o.id); setModal("none"); }} disabled={!!G.quest && G.quest.phase !== "result"} aria-label={`Accept ${def.name} delivery`}>Take it</button>
      </li>
    );
  };

  const result = G.result;

  return (
    <ExperienceLayout title="The Witch's Delivery Service" category="Game" accent="#F2B45A" background="#0b1030">
      <div ref={wrapRef} className={`${styles.stage} ${prefs.contrast ? styles.contrast : ""}`}>
        <canvas
          ref={canvasRef} className={styles.canvas} tabIndex={0} role="application"
          aria-label="The Witch's Delivery Service. Fly with W A S D or the arrow keys, Shift to boost, Space for a chime. B opens the job board."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
        />
        <div className={styles.srOnly} role="status" aria-live="polite">{announce}{hud.hint ? `. ${hud.hint}` : ""}</div>

        {/* top-left: purse & weather */}
        <div className={styles.topLeft}>
          <div className={styles.pill}><b>◎ {hud.coins}</b><i /><span>{hud.delivered} deliveries</span></div>
          <div className={styles.pill} title={hud.weatherBlurb}>
            <span>{hud.clock}</span><i /><span>{hud.weatherName}</span>
            {hud.weatherNext && <><i /><em>{hud.weatherNext} coming</em></>}
          </div>
        </div>

        {/* quest card */}
        {q && hud.phase !== "result" && (
          <div className={styles.quest} aria-label="Current delivery">
            <div className={styles.qHead}>
              <Icon kind="pkg" id={PACKAGES.find((p) => p.name === q.pkg)!.id} size={38} />
              <div>
                <strong>{q.pkg}</strong>
                <small>{phaseText}{hud.target ? ` · ${Math.round(hud.target.dist / 10) * 10} m` : ""}</small>
              </div>
              <button className={styles.tiny} onClick={() => { abandonQuest(G); setModal("none"); }} aria-label="Give up this delivery">Return to sender</button>
            </div>
            {hud.phase === "carry" && (
              <div className={styles.qBody}>
                <span className={styles.timer} data-late={overLimit ? "1" : "0"}>{fmtTime(q.elapsed)} <small>/ par {fmtTime(q.par)}</small></span>
                <span className={styles.cons}>{q.constraint}</span>
                {q.objective && <span className={`${styles.cons} ${q.objectiveDone ? styles.done : ""}`}>{q.objectiveDone ? "✓" : "○"} {q.objective}</span>}
              </div>
            )}
            {hud.gauge && (
              <div className={styles.gauge} role="img" aria-label={`${hud.gauge.label}: ${hud.gauge.text}`}>
                <span>{hud.gauge.label}</span>
                <div><i style={{ width: `${Math.round(Math.max(0.04, hud.gauge.value) * 100)}%` }} /></div>
                <em>{hud.gauge.text}</em>
              </div>
            )}
            {hud.stolen && <p className={styles.alert}>The birds have it! Chase them — or chime (Space) to shoo.</p>}
            {hud.phase === "carry" && <p className={styles.tip}>{q.tip}</p>}
          </div>
        )}
        {hud.hint && <div className={styles.hint}>{hud.hint}</div>}

        {/* toasts */}
        <div className={styles.toasts} aria-hidden="true">
          {toasts.map((t) => <div key={t.id} className={`${styles.toast} ${styles["tone_" + t.tone]}`}>{t.text}</div>)}
        </div>

        {/* bottom-left meters */}
        <div className={styles.meters}>
          <div className={styles.meter} aria-label={`Boost ${Math.round(hud.boost * 100)} percent`}><span>Boost</span><div><i style={{ width: `${Math.round(hud.boost * 100)}%` }} data-lock={hud.boostLocked ? "1" : "0"} /></div></div>
          <div className={styles.meter} aria-label="Chime ready"><span>Chime</span><div><i style={{ width: `${Math.round(hud.flourish * 100)}%` }} data-ready={hud.flourish >= 1 ? "1" : "0"} /></div></div>
          <div className={styles.readout}>{Math.round(hud.speed / 10)} knots · {Math.max(0, Math.round(hud.alt / 10))} m up{Math.abs(hud.windV) > 60 ? ` · wind ${hud.windV > 0 ? "→" : "←"}` : ""}</div>
        </div>

        <canvas ref={miniRef} className={styles.mini} width={360} height={36} aria-hidden="true" />

        {/* bottom-right buttons */}
        <nav className={styles.dock} aria-label="Menus">
          <button onClick={() => openModal("board")} aria-keyshortcuts="B">Board <kbd>B</kbd></button>
          <button onClick={() => openModal("broom")} aria-keyshortcuts="U">Broom <kbd>U</kbd></button>
          <button onClick={() => openModal("log")} aria-keyshortcuts="L">Logbook <kbd>L</kbd></button>
          <button onClick={() => openModal("pause")} aria-keyshortcuts="Escape">Menu <kbd>Esc</kbd></button>
        </nav>
        {(touch || ptr.current.touch) && (
          <div className={styles.touchBtns}>
            <button onPointerDown={() => { touchBtn.current.flourish = true; }} onPointerUp={() => { touchBtn.current.flourish = false; }} onPointerLeave={() => { touchBtn.current.flourish = false; }}>Chime</button>
            <button className={styles.boostBtn} onPointerDown={() => { touchBtn.current.boost = true; }} onPointerUp={() => { touchBtn.current.boost = false; }} onPointerLeave={() => { touchBtn.current.boost = false; }}>Boost</button>
          </div>
        )}

        {/* welcome */}
        {modal === "welcome" && (
          <div className={styles.overlay} role="dialog" aria-label="Welcome">
            <div className={styles.card}>
              <h2>The Witch's Delivery Service</h2>
              <p>You've just started as a courier. Your job looks simple:</p>
              <p className={styles.big}>Pick up a package. Fly to its destination. Deliver it.</p>
              <p className={styles.muted}>Magical deliveries rarely behave as expected.</p>
              <ul className={styles.helpList}>
                <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows — fly. Or hold the mouse / your finger to fly toward it.</li>
                <li><kbd>Shift</kbd> — boost. &nbsp; <kbd>Space</kbd> — chime (calms, shoos, spins).</li>
                <li><kbd>B</kbd> job board &nbsp; <kbd>U</kbd> broom workshop &nbsp; <kbd>L</kbd> logbook</li>
                <li>Slow down near a lantern to collect or hand over.</li>
              </ul>
              <div className={styles.row}>
                <button className={styles.primary} onClick={() => { G.save.intro = true; save(); setModal("board"); }}>Take a first job</button>
                <button className={styles.ghost} onClick={() => { G.save.intro = true; save(); setModal("none"); }}>Just fly around</button>
              </div>
            </div>
          </div>
        )}

        {/* board / result */}
        {modal === "board" && (
          <div className={styles.overlay} role="dialog" aria-label={result ? "Delivery result" : "Job board"}>
            <div className={`${styles.card} ${styles.wide}`}>
              {result ? (
                <>
                  <div className={styles.resHead}>
                    <Icon kind="person" id={result.customer} size={72} />
                    <div className={styles.bubble}>
                      <small>{CUSTOMER[result.customer].name}</small>
                      <p>“{result.customerLine}”</p>
                    </div>
                  </div>
                  <h3 className={styles.resTitle}>{result.title}</h3>
                  <p className={styles.muted}>{result.line}</p>
                  <p className={styles.stars} aria-label={`${result.stars} of 3 stars`}>{stars(result.stars)}</p>
                  <dl className={styles.breakdown}>
                    <dt>Time</dt><dd>{fmtTime(result.time)} <small>par {fmtTime(result.par)}</small> {result.parts.time >= 1 ? "· on time" : result.parts.time >= 0.6 ? "· a bit late" : "· fashionably late"}</dd>
                    <dt>Package</dt><dd>{result.parts.cond >= 0.85 ? "excellent" : result.parts.cond >= 0.55 ? "a little worse for wear" : "memorably chaotic"}</dd>
                    <dt>Landing</dt><dd>{result.parts.acc >= 0.8 ? "gentle and precise" : result.parts.acc >= 0.5 ? "reasonable" : "enthusiastic"}</dd>
                    {result.parts.obj !== null && <><dt>Bonus</dt><dd>{result.offer.objective?.text}: {result.parts.obj ? "✓ done" : "not this time"}</dd></>}
                    <dt>Route</dt><dd>{result.route}</dd>
                    <dt>Best</dt><dd>{result.newBest ? "New best for this run!" : "Best so far"} {fmtTime(result.bestTime)}</dd>
                  </dl>
                  {result.tipNote && <p className={styles.muted}>{result.tipNote}</p>}
                  <p className={styles.reward}>+{result.reward} ◎</p>
                  {result.unlocks.length > 0 && <ul className={styles.unlocks}>{result.unlocks.map((u) => <li key={u}>✦ {u}</li>)}</ul>}
                  <div className={styles.row}>
                    <button className={styles.primary} onClick={() => { closeResult(G); setModal("board"); setTick((x) => x + 1); }}>Back to the board</button>
                    <button className={styles.ghost} onClick={() => { closeResult(G); setModal("none"); }}>Keep flying</button>
                  </div>
                </>
              ) : (
                <>
                  <header className={styles.modalHead}><h2>Job board</h2><span className={styles.coins}>◎ {hud.coins}</span><button className={styles.x} onClick={() => setModal("none")} aria-label="Close">×</button></header>
                  {G.quest ? (
                    <p className={styles.muted}>You already have a delivery: <strong>{PKG[G.quest.offer.pkg].name}</strong>. Finish it first — or <button className={styles.link} onClick={() => { abandonQuest(G); setTick((x) => x + 1); }}>return it to sender</button>.</p>
                  ) : (
                    <>
                      <ul className={styles.offers} key={tick}>{G.offers.map(boardOffer)}</ul>
                      <button className={styles.ghost} onClick={() => { G.offers = makeOffers(G); setTick((x) => x + 1); }}>Ask for different jobs</button>
                    </>
                  )}
                  <p className={styles.muted}>Open districts: {DISTRICTS.filter((d) => districtOpen(G.save.delivered, d.id)).map((d) => d.name).join(", ")}. {G.save.delivered < 11 ? "More open as you deliver." : ""}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* broom workshop */}
        {modal === "broom" && (
          <div className={styles.overlay} role="dialog" aria-label="Broom workshop">
            <div className={`${styles.card} ${styles.wide}`}>
              <header className={styles.modalHead}><h2>Broom workshop</h2><span className={styles.coins}>◎ {hud.coins}</span><button className={styles.x} onClick={() => setModal("none")} aria-label="Close">×</button></header>
              <p className={styles.muted}>Upgrades change <em>how</em> you fly, not just how fast.</p>
              <ul className={styles.ups}>
                {UPGRADES.map((u) => {
                  const lv = upgradeLv(G, u.id), maxed = lv >= u.costs.length, cost = u.costs[lv];
                  return (
                    <li key={u.id} className={styles.up}>
                      <div><strong>{u.name}</strong> <span className={styles.lv}>{"●".repeat(lv)}{"○".repeat(u.costs.length - lv)}</span><p>{u.blurb} <em>{lv > 0 ? u.levels[lv - 1] : ""}</em></p></div>
                      <button className={styles.primary} disabled={maxed || G.save.coins < cost} onClick={() => { buyUpgrade(G, u.id, u.costs); save(); setTick((x) => x + 1); }}>{maxed ? "Maxed" : `${cost} ◎`}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* logbook */}
        {modal === "log" && (
          <div className={styles.overlay} role="dialog" aria-label="Logbook">
            <div className={`${styles.card} ${styles.wide} ${styles.paper}`}>
              <header className={styles.modalHead}>
                <h2>Courier's logbook</h2>
                <div className={styles.tabs} role="tablist">
                  {(["secrets", "people", "parcels", "routes", "weather"] as const).map((t) => (
                    <button key={t} role="tab" aria-selected={logTab === t} className={logTab === t ? styles.tabOn : ""} onClick={() => setLogTab(t)}>{t}</button>
                  ))}
                </div>
                <button className={styles.x} onClick={() => setModal("none")} aria-label="Close">×</button>
              </header>
              <div className={styles.logBody}>
                {logTab === "secrets" && (
                  <>
                    <p className={styles.muted}>{hud.secrets} of {SECRETS.length} found. None are needed to finish the job.</p>
                    <ul className={styles.logList}>
                      {SECRETS.map((s) => (
                        <li key={s.id} className={G.save.secrets[s.id] ? "" : styles.locked}>
                          <strong>{G.save.secrets[s.id] ? s.name : "???"}</strong>
                          <p>{G.save.secrets[s.id] ? s.found : s.hint}</p>
                          {!G.save.secrets[s.id] && <small>{DISTRICTS.find((d) => d.id === s.district)?.name}</small>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {logTab === "people" && (
                  <ul className={styles.logList}>
                    {CUSTOMERS.map((c) => {
                      const n = G.save.met[c.id] ?? 0;
                      const hidden = c.id === "hollow" && !G.save.secrets.midnight;
                      return (
                        <li key={c.id} className={n || (!hidden && c.id !== "hollow") ? "" : styles.locked}>
                          <div className={styles.person}><Icon kind="person" id={c.id} size={48} /><div><strong>{hidden ? "???" : c.name}</strong><p>{hidden ? "Somewhere, someone waits up late." : c.role}</p><small>{n ? `${n} deliver${n > 1 ? "ies" : "y"}` : `Lives at ${LOC[c.home].name}`}</small></div></div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {logTab === "parcels" && (
                  <ul className={`${styles.logList} ${styles.grid}`}>
                    {PACKAGES.map((p) => {
                      const n = G.save.seen[p.id] ?? 0;
                      return (
                        <li key={p.id} className={n ? "" : styles.locked}>
                          <div className={styles.person}><Icon kind="pkg" id={p.id} size={44} /><div><strong>{n ? p.name : "???"}</strong><p>{n ? p.tip : TIER_LABEL[p.tier] + " parcel"}</p><small>{n ? `carried ${n}×` : unlockedTier(G.save.delivered) >= p.tier ? "not yet carried" : "not yet on the board"}</small></div></div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {logTab === "routes" && (
                  <>
                    <p className={styles.muted}>Your quickest run between each pair of places, and the way you took.</p>
                    {Object.keys(G.save.routes).length === 0 ? <p>No deliveries yet.</p> : (
                      <ul className={styles.logList}>
                        {Object.entries(G.save.routes).map(([k, r]) => { const [a, b] = k.split(">"); return <li key={k}><strong>{LOC[a as keyof typeof LOC].name} → {LOC[b as keyof typeof LOC].name}</strong><p>{fmtTime(r.t)} · {r.route}</p></li>; })}
                      </ul>
                    )}
                    <p className={styles.muted}>Shortcuts discovered: {Object.keys(G.save.shortcuts).length ? Object.keys(G.save.shortcuts).map((s) => ({ chimney: "Great Chimneys", clock: "Clocktower", windtunnel: "Witch Path", tunnel: "Underground" } as Record<string, string>)[s] ?? s).join(", ") : "none yet"}.</p>
                  </>
                )}
                {logTab === "weather" && (
                  <ul className={styles.logList}>
                    {WEATHERS.map((w) => {
                      const seen = G.save.weatherSeen[w.id];
                      const open = weatherOpen(G.save.delivered, w.id);
                      return <li key={w.id} className={seen ? "" : styles.locked}><strong>{seen ? w.name : "???"}</strong><p>{seen ? w.blurb : open ? "Not seen yet." : `Arrives after ${w.unlock} deliveries.`}</p></li>;
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* pause */}
        {modal === "pause" && (
          <div className={styles.overlay} role="dialog" aria-label="Menu">
            <div className={styles.card}>
              <header className={styles.modalHead}><h2>Paused</h2><button className={styles.x} onClick={() => setModal("none")} aria-label="Resume">×</button></header>
              <label className={styles.toggle}><input type="checkbox" checked={prefs.reduced} onChange={(e) => setPrefs((p) => ({ ...p, reduced: e.target.checked }))} /> Reduced motion <small>No screen shake or flashes, calmer weather and clouds.</small></label>
              <label className={styles.toggle}><input type="checkbox" checked={prefs.contrast} onChange={(e) => setPrefs((p) => ({ ...p, contrast: e.target.checked }))} /> Package outline <small>Draws a dashed box around what you're carrying.</small></label>
              <label className={styles.toggle}><input type="checkbox" checked={sound} onChange={toggleSound} /> Sound <small>Wind, bells, birds — and a teapot that sings.</small></label>
              <p className={styles.keys}><kbd>WASD</kbd>/arrows fly · <kbd>Shift</kbd> boost · <kbd>Space</kbd> chime · <kbd>B</kbd> board · <kbd>U</kbd> broom · <kbd>L</kbd> logbook · <kbd>Esc</kbd> pause. Hold the pointer to fly toward it.</p>
              <div className={styles.row}>
                <button className={styles.primary} onClick={() => setModal("none")}>Back to flying</button>
                {!confirmReset ? <button className={styles.danger} onClick={() => setConfirmReset(true)}>Reset progress…</button>
                  : <button className={styles.danger} onClick={() => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } const ns = defaultSave(); G.save = ns; ns.intro = true; G.quest = null; G.pkg = null; G.result = null; G.offers = makeOffers(G); setConfirmReset(false); setModal("welcome"); }}>Yes, wipe everything</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
