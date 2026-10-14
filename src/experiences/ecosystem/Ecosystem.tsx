import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  createWorld, step, stats, applyTool, clearPonds,
  ANIMALS, ANIMAL_KINDS, DEFAULT_SETTINGS, WORLD_W, WORLD_H, COLS, ROWS, CELL,
  type World, type Settings, type Tool, type AnimalKind, type Stats,
} from "./engine";
import styles from "./Ecosystem.module.css";

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "rabbit", label: "\u2022 Rabbits", hint: "Add a few rabbits" },
  { id: "deer", label: "\u2022 Deer", hint: "Add deer" },
  { id: "fox", label: "\u2022 Foxes", hint: "Add foxes" },
  { id: "wolf", label: "\u2022 Wolves", hint: "Add wolves" },
  { id: "crow", label: "\u2022 Crows", hint: "Add scavenging crows" },
  { id: "shrub", label: "\u2726 Shrubs", hint: "Plant berry shrubs" },
  { id: "tree", label: "\u2726 Trees", hint: "Plant shade trees" },
  { id: "grass", label: "\u2261 Grass", hint: "Restore grass and moisture" },
  { id: "pond", label: "\u25CB Pond", hint: "Dig a new pond" },
  { id: "rain", label: "\u2601 Rain", hint: "Water a region and douse fire" },
  { id: "fire", label: "\u25B2 Spark", hint: "Start a fire" },
  { id: "blight", label: "\u2716 Blight", hint: "Wipe out plants in an area" },
  { id: "plague", label: "\u2298 Plague", hint: "Sicken nearby animals" },
];

const KIND_LABEL: Record<AnimalKind, string> = {
  rabbit: "Rabbits", deer: "Deer", fox: "Foxes", wolf: "Wolves", crow: "Crows",
};

interface SliderDef {
  key: keyof Settings;
  label: string;
  min: number;
  max: number;
  step?: number;
  group: string;
}

const SLIDERS: SliderDef[] = [
  { key: "sunlight", label: "Sunlight", min: 0, max: 100, group: "Environment" },
  { key: "rainfall", label: "Rainfall", min: 0, max: 100, group: "Environment" },
  { key: "temperature", label: "Warmth", min: 0, max: 100, group: "Environment" },
  { key: "fertility", label: "Soil fertility", min: 0, max: 100, group: "Environment" },
  { key: "wildfires", label: "Wildfire risk", min: 0, max: 100, group: "Environment" },
  { key: "seasonLength", label: "Season length (s)", min: 40, max: 400, group: "Environment" },
  { key: "grassRegrowth", label: "Grass regrowth", min: 0.2, max: 2.5, step: 0.05, group: "Plants" },
  { key: "shrubSpread", label: "Shrub spread", min: 0.2, max: 2.5, step: 0.05, group: "Plants" },
  { key: "treeShade", label: "Tree shade strength", min: 0, max: 100, group: "Plants" },
  { key: "metabolism", label: "Metabolism", min: 0.4, max: 2, step: 0.05, group: "Animals" },
  { key: "herbivoreFertility", label: "Herbivore fertility", min: 0.2, max: 2.5, step: 0.05, group: "Animals" },
  { key: "predatorFertility", label: "Predator fertility", min: 0.2, max: 2.5, step: 0.05, group: "Animals" },
  { key: "predatorSkill", label: "Predator hunting skill", min: 0.3, max: 2, step: 0.05, group: "Animals" },
  { key: "predatorAppetite", label: "Predator appetite", min: 0, max: 100, group: "Animals" },
  { key: "cover", label: "Cover from plants", min: 0, max: 100, group: "Animals" },
  { key: "territory", label: "Territory size", min: 0, max: 2, step: 0.05, group: "Animals" },
  { key: "mutation", label: "Mutation rate", min: 0, max: 100, group: "Animals" },
  { key: "migration", label: "Migration from beyond", min: 0, max: 100, group: "Animals" },
  { key: "maxCreatures", label: "Max creatures", min: 100, max: 2500, step: 50, group: "Limits" },
  { key: "maxPlants", label: "Max plants", min: 100, max: 2500, step: 50, group: "Limits" },
];

const PRESETS: { name: string; settings: Partial<Settings> }[] = [
  { name: "Balanced valley", settings: {} },
  { name: "Lush & crowded", settings: { rainfall: 75, fertility: 75, grassRegrowth: 1.4, maxCreatures: 1400, maxPlants: 1800 } },
  { name: "Harsh winters", settings: { temperature: 30, seasons: true, seasonLength: 110, wildfires: 4 } },
  { name: "Predator-heavy", settings: { predatorFertility: 1.6, predatorSkill: 1.3, herbivoreFertility: 1.3 } },
  { name: "Fireprone plains", settings: { wildfires: 45, rainfall: 30, temperature: 70 } },
  { name: "No seasons", settings: { seasons: false } },
];

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function Ecosystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const settingsRef = useRef(settings);
  const [tool, setTool] = useState<Tool>("rabbit");
  const toolRef = useRef(tool);
  const [seed, setSeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  const [speedMult, setSpeedMult] = useState(1);
  const speedRef = useRef(speedMult);
  const [display, setDisplay] = useState<Stats | null>(null);
  const [log, setLog] = useState<{ time: number; text: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [selected, setSelected] = useState<AnimalKind | null>(null);
  const [history, setHistory] = useState<Record<AnimalKind, number[]>>({ rabbit: [], deer: [], fox: [], wolf: [], crow: [] });
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speedMult; }, [speedMult]);

  useEffect(() => {
    worldRef.current = createWorld(seed * 7919 + 13, { ...settingsRef.current });
  }, [seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    const ctx = maybeCtx;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frame = 0;
    const STEP = 1 / 30;

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      let dt = Math.min(0.12, (now - last) / 1000);
      last = now;
      const w = worldRef.current;
      if (!w) return;
      if (!pausedRef.current) {
        acc += dt * speedRef.current;
        let guard = 0;
        while (acc >= STEP && guard < 8) {
          step(w, STEP);
          acc -= STEP;
          guard++;
        }
      }
      frame++;
      draw(ctx, w, reducedMotion.current);
      if (frame % 12 === 0) {
        const s = stats(w);
        setDisplay(s);
        setLog(w.log.slice(0, 8));
        setHistory((prev) => {
          const next: Record<AnimalKind, number[]> = { rabbit: [], deer: [], fox: [], wolf: [], crow: [] };
          for (const k of ANIMAL_KINDS) {
            const arr = prev[k].length >= 180 ? prev[k].slice(1) : prev[k].slice();
            arr.push(s.counts[k]);
            next[k] = arr;
          }
          return next;
        });
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function updateSetting(key: keyof Settings, value: number | boolean) {
    setSettings((s) => {
      const next = { ...s, [key]: value };
      const w = worldRef.current;
      if (w) w.settings = next;
      return next;
    });
  }

  function applyPreset(p: Partial<Settings>) {
    setSettings((s) => {
      const next = { ...s, ...DEFAULT_SETTINGS, ...p };
      const w = worldRef.current;
      if (w) w.settings = next;
      return next;
    });
  }

  function handlePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const w = worldRef.current;
    const canvas = canvasRef.current;
    if (!w || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WORLD_W;
    const y = ((e.clientY - rect.top) / rect.height) * WORLD_H;
    applyTool(w, toolRef.current, x, y, 34);
  }

  function reset() {
    worldRef.current = createWorld(Date.now() % 100000, { ...settingsRef.current });
    setHistory({ rabbit: [], deer: [], fox: [], wolf: [], crow: [] });
    setLog([]);
    setDisplay(null);
    setSeed((s) => s + 1);
  }

  return (
    <ExperienceLayout title="Ecosystem" category="Tiny World" accent="#4e9467" background="#0b1712">
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          className={styles.canvas}
          onPointerDown={handlePointer}
          onPointerMove={(e) => { if (e.buttons === 1) handlePointer(e); }}
        />

        <div className={styles.topBar}>
          <div className={styles.readout}>
            {display && (
              <>
                <span>Year {display.year}</span>
                <span className={styles.sep}>&middot;</span>
                <span>{["Winter", "Spring", "Summer", "Autumn"][display.season]}</span>
                <span className={styles.sep}>&middot;</span>
                <span>{Math.round(display.temp)}&deg;</span>
                {display.raining && <span className={styles.rainTag}>Rain</span>}
                {display.burning > 0 && <span className={styles.fireTag}>Fire</span>}
              </>
            )}
          </div>
          <div className={styles.topButtons}>
            <button className={styles.chip} onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</button>
            <button
              className={styles.chip}
              onClick={() => setSpeedMult((m) => (m >= 4 ? 1 : m === 1 ? 2 : m === 2 ? 4 : 1))}
            >
              {speedMult}&times;
            </button>
            <button className={styles.chip} onClick={() => setShowLog((v) => !v)}>Log</button>
            <button className={styles.chip} onClick={() => setShowSettings((v) => !v)}>Settings</button>
            <button className={styles.chip} onClick={reset}>New valley</button>
          </div>
        </div>

        <div className={styles.toolbar}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tool} ${tool === t.id ? styles.toolActive : ""}`}
              onClick={() => setTool(t.id)}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.population}>
          {ANIMAL_KINDS.map((k) => {
            const cfg = ANIMALS[k];
            const count = display?.counts[k] ?? 0;
            const peak = display?.peaks[k] ?? 0;
            const extinct = display?.extinct[k] ?? false;
            return (
              <button
                key={k}
                className={`${styles.popRow} ${selected === k ? styles.popRowActive : ""}`}
                onClick={() => setSelected(selected === k ? null : k)}
              >
                <span className={styles.popSwatch} style={{ background: cfg.color }} />
                <span className={styles.popLabel}>{KIND_LABEL[k]}</span>
                <span className={styles.popCount}>{extinct ? "extinct" : count}</span>
                <Spark values={history[k]} max={Math.max(4, peak)} color={cfg.color} />
              </button>
            );
          })}
          <div className={styles.popRow}>
            <span className={styles.popSwatch} style={{ background: "#6fa56d" }} />
            <span className={styles.popLabel}>Shrubs</span>
            <span className={styles.popCount}>{display?.shrubs ?? 0}</span>
          </div>
          <div className={styles.popRow}>
            <span className={styles.popSwatch} style={{ background: "#3d6b46" }} />
            <span className={styles.popLabel}>Trees</span>
            <span className={styles.popCount}>{display?.trees ?? 0}</span>
          </div>
          <div className={styles.popRow}>
            <span className={styles.popSwatch} style={{ background: "#c9b98a" }} />
            <span className={styles.popLabel}>Grass cover</span>
            <span className={styles.popCount}>{display ? Math.round(display.grassCover * 100) + "%" : ""}</span>
          </div>
        </div>

        {selected && (
          <div className={styles.detail}>
            <strong>{KIND_LABEL[selected]}</strong>
            <p>{detailText(selected)}</p>
            <button className={styles.chip} onClick={() => setSelected(null)}>Close</button>
          </div>
        )}

        {showLog && (
          <div className={styles.log}>
            <div className={styles.logHead}>
              <span>Valley log</span>
              <button className={styles.chip} onClick={() => setShowLog(false)}>&times;</button>
            </div>
            <ul>
              {log.map((l, i) => (
                <li key={i}>
                  <span className={styles.logTime}>{Math.round(l.time / 60)}m</span> {l.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showSettings && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span>Settings</span>
              <button className={styles.chip} onClick={() => setShowSettings(false)}>&times;</button>
            </div>
            <div className={styles.presets}>
              {PRESETS.map((p) => (
                <button key={p.name} className={styles.presetBtn} onClick={() => applyPreset(p.settings)}>
                  {p.name}
                </button>
              ))}
            </div>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={settings.seasons}
                onChange={(e) => updateSetting("seasons", e.target.checked)}
              />
              Seasons
            </label>
            {Object.entries(
              SLIDERS.reduce<Record<string, SliderDef[]>>((acc, s) => {
                (acc[s.group] ??= []).push(s);
                return acc;
              }, {}),
            ).map(([group, defs]) => (
              <div key={group} className={styles.panelGroup}>
                <div className={styles.panelGroupTitle}>{group}</div>
                {defs.map((d) => (
                  <div key={d.key} className={styles.sliderRow}>
                    <div className={styles.sliderLabel}>
                      <span>{d.label}</span>
                      <span className={styles.sliderValue}>{fmt(settings[d.key] as number)}</span>
                    </div>
                    <input
                      type="range"
                      min={d.min}
                      max={d.max}
                      step={d.step ?? 1}
                      value={settings[d.key] as number}
                      onChange={(e) => updateSetting(d.key, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            ))}
            <button
              className={styles.presetBtn}
              onClick={() => { const w = worldRef.current; if (w) { clearPonds(w); } }}
            >
              Drain all ponds
            </button>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}

function detailText(k: AnimalKind): string {
  switch (k) {
    case "rabbit": return "Fast breeders that graze on grass and duck into warrens or cover when a predator gets close.";
    case "deer": return "Herd animals that browse grass and shrubs and can outrun almost anything over a short distance.";
    case "fox": return "Solitary hunters that stalk rabbits and, occasionally, fawns, and will scavenge carrion when prey is scarce.";
    case "wolf": return "Pack hunters that chase down deer, and turn to rabbits or carrion only when truly hungry.";
    case "crow": return "Scavengers that clean up carrion and fallen fruit, and spread seeds wherever they land.";
  }
}

function Spark({ values, max, color }: { values: number[]; max: number; color: string }) {
  const w = 56, h = 20;
  if (values.length < 2) return <svg width={w} height={h} />;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (Math.min(v, max) / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.4} opacity={0.85} />
    </svg>
  );
}

function draw(ctx: CanvasRenderingContext2D, w: World | null, reduced: boolean) {
  const canvas = ctx.canvas;
  if (!w) { ctx.fillStyle = "#0b1712"; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const x = c * CELL, y = r * CELL;
      if (w.water[i]) continue;
      const g = w.grass[i];
      const m = w.moisture[i];
      const dry = Math.max(0, 1 - m * 1.4);
      const soilR = 58 + dry * 30, soilG = 46 + dry * 14, soilB = 30;
      const grassR = 44 - g * 18, grassG = 92 + g * 55, grassB = 46 - g * 10;
      const rr = soilR * (1 - g) + grassR * g;
      const gg = soilG * (1 - g) + grassG * g;
      const bb = soilB * (1 - g) + grassB * g;
      ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
      ctx.fillRect(x, y, CELL + 0.5, CELL + 0.5);
      if (w.shade[i] > 0.05) {
        ctx.fillStyle = `rgba(4,10,8,${Math.min(0.35, w.shade[i] * 0.3)})`;
        ctx.fillRect(x, y, CELL + 0.5, CELL + 0.5);
      }
      if (w.burn[i] > 0.05) {
        ctx.fillStyle = `rgba(255,${120 - w.burn[i] * 60},40,${Math.min(0.85, w.burn[i])})`;
        ctx.fillRect(x, y, CELL + 0.5, CELL + 0.5);
      }
    }
  }

  ctx.fillStyle = "rgba(60,120,150,0.9)";
  for (const p of w.ponds) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r, p.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(120,96,60,0.55)";
  for (const wr of w.warrens) {
    ctx.beginPath();
    ctx.ellipse(wr.x, wr.y, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of w.plants) {
    const s = 3 + p.size * (p.kind === "tree" ? 13 : 6);
    if (p.kind === "tree") {
      ctx.fillStyle = `rgba(58,45,32,0.9)`;
      ctx.fillRect(p.x - 1, p.y, 2, s * 0.4);
      ctx.fillStyle = `rgba(${40 + p.berries * 60},${100 + p.size * 30},${55 - p.berries * 20},0.92)`;
    } else {
      ctx.fillStyle = `rgba(${60 + p.berries * 130},${120 + p.size * 40},${60 + p.berries * 40},0.9)`;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y - (p.kind === "tree" ? s * 0.4 : 0), s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(120,60,50,0.55)";
  for (const c of w.carcasses) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const a of w.animals) {
    const cfg = ANIMALS[a.kind];
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.facing);
    ctx.fillStyle = cfg.color;
    ctx.globalAlpha = a.age < cfg.mature ? 0.65 : 1;
    const size = a.kind === "deer" ? 5.5 : a.kind === "wolf" ? 5 : a.kind === "fox" ? 4 : a.kind === "crow" ? 3.2 : 3;
    ctx.beginPath();
    ctx.moveTo(size * 1.4, 0);
    ctx.lineTo(-size, size * 0.8);
    ctx.lineTo(-size, -size * 0.8);
    ctx.closePath();
    ctx.fill();
    if (a.panic > 0 && !reduced) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#ffe29a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
