import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { createFox, step, type FoxState, type FoxInput, type StarKind, type Level } from "./engine";
import { generateLevel, loadProgress, saveProgress, type Progress } from "./data";
import styles from "./FoxStars.module.css";

const STAR_LABELS: Record<StarKind, string> = {
  light: "Light", wind: "Wind", gravity: "Gravity", water: "Water",
};
const STAR_ORDER: StarKind[] = ["light", "wind", "gravity", "water"];

export function FoxStars() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [levelNumber, setLevelNumber] = useState(() => Math.max(1, loadProgress().levelReached));
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [collected, setCollected] = useState<Record<StarKind, boolean>>({ light: false, wind: false, gravity: false, water: false });
  const [respawns, setRespawns] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const foxRef = useRef<FoxState | null>(null);
  const levelRef = useRef<Level>(generateLevel(levelNumber));
  const keysRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(started);
  const finishedRef = useRef(finished);
  const levelNumberRef = useRef(levelNumber);
  const deathFlashRef = useRef(0);

  useEffect(() => { startedRef.current = started; }, [started]);
  useEffect(() => { finishedRef.current = finished; }, [finished]);
  useEffect(() => { levelNumberRef.current = levelNumber; }, [levelNumber]);
  useEffect(() => { saveProgress(progress); }, [progress]);

  function begin() {
    levelRef.current = generateLevel(levelNumber);
    foxRef.current = createFox(levelRef.current);
    setCollected({ light: false, wind: false, gravity: false, water: false });
    setRespawns(0);
    setFinished(false);
    setStarted(true);
  }

  function nextLevel() {
    setLevelNumber((n) => n + 1);
  }

  // Once levelNumber changes (via nextLevel), start the new level right away.
  useEffect(() => {
    if (started) begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelNumber]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { keysRef.current.add(e.key.toLowerCase()); }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.key.toLowerCase()); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas = canvasEl;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    let width = 0, height = 0;
    let raf = 0;
    let last = performance.now();

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawFox(sx: number, sy: number, facing: 1 | -1, swimming: boolean, t: number) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(facing * 1.5, 1.5);
      const bob = swimming ? Math.sin(t / 200) * 1.4 : 0;
      ctx.translate(0, bob);

      // Tail (drawn first, so the body overlaps its base)
      ctx.fillStyle = "#d9701f";
      ctx.beginPath();
      ctx.moveTo(-9, 3);
      ctx.quadraticCurveTo(-24, 6, -22, -9);
      ctx.quadraticCurveTo(-19, -14, -14, -9);
      ctx.quadraticCurveTo(-16, -2, -9, -1);
      ctx.closePath();
      ctx.fill();
      // White tail tip
      ctx.fillStyle = "#f8ede0";
      ctx.beginPath();
      ctx.ellipse(-20, -8, 4, 3.4, 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Legs (simple, suggest standing/running without full animation)
      ctx.fillStyle = "#2b2018";
      for (const lx of [-5, 4]) {
        ctx.beginPath();
        ctx.roundRect(lx - 1.6, 4, 3.2, 6, 1.5);
        ctx.fill();
      }

      // Body
      ctx.fillStyle = "#e6873f";
      ctx.beginPath();
      ctx.ellipse(-1, 0, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cream belly
      ctx.fillStyle = "#f8ede0";
      ctx.beginPath();
      ctx.ellipse(-1, 4, 9, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = "#e6873f";
      ctx.beginPath();
      ctx.ellipse(11, -4, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ears
      ctx.beginPath();
      ctx.moveTo(6, -9);
      ctx.lineTo(4.5, -17);
      ctx.lineTo(10.5, -10.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(13, -9.5);
      ctx.lineTo(15, -17);
      ctx.lineTo(17.5, -9.5);
      ctx.closePath();
      ctx.fill();
      // Inner ears
      ctx.fillStyle = "#2b2018";
      ctx.beginPath();
      ctx.moveTo(6.8, -10.2);
      ctx.lineTo(6, -14.5);
      ctx.lineTo(9.6, -11);
      ctx.closePath();
      ctx.fill();
      // Snout + cream muzzle
      ctx.fillStyle = "#f8ede0";
      ctx.beginPath();
      ctx.ellipse(16, -2, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b2018";
      ctx.beginPath();
      ctx.arc(19.5, -2, 1.3, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.beginPath();
      ctx.arc(12.5, -6, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function draw(t: number) {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#0b1120");
      sky.addColorStop(1, "#1c2b45");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Distant stars (ambient, decorative)
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137) % width;
        const sy = (i * 71) % (height * 0.6);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      const fox = foxRef.current;
      if (!startedRef.current || !fox) return;

      if (!finishedRef.current) {
        const keys = keysRef.current;
        const input: FoxInput = {
          left: keys.has("arrowleft") || keys.has("a"),
          right: keys.has("arrowright") || keys.has("d"),
          jumpPressed: keys.has("arrowup") || keys.has("w") || keys.has(" "),
          dashPressed: keys.has("shift") || keys.has("x"),
        };
        const wasDead = fox.dead;
        step(fox, levelRef.current, input, dt);
        if (fox.dead && !wasDead) {
          deathFlashRef.current = 1;
          setRespawns(fox.respawns);
        }
        for (const k of STAR_ORDER) {
          if (fox.powers[k]) {
            setCollected((prev) => (prev[k] ? prev : { ...prev, [k]: true }));
          }
        }
        if (fox.finished) {
          finishedRef.current = true;
          setFinished(true);
          setProgress((p) => ({
            levelReached: Math.max(p.levelReached, levelNumberRef.current + 1),
            bestRespawns: p.bestRespawns === null ? fox.respawns : Math.min(p.bestRespawns, fox.respawns),
          }));
        }
      }

      deathFlashRef.current = Math.max(0, deathFlashRef.current - dt * 2.2);

      const camX = Math.max(0, Math.min(levelRef.current.width - width, fox.x - width / 2));
      const toScreen = (x: number, y: number) => ({ x: x - camX, y });

      // Ground/platforms
      for (const p of levelRef.current.platforms) {
        if (p.hidden && !fox.powers.light) continue;
        const s = toScreen(p.x, p.y);
        if (s.x + p.w < 0 || s.x > width) continue;
        ctx.fillStyle = p.hidden ? "#7fae6a" : "#3a4f6b";
        ctx.fillRect(s.x, s.y, p.w, p.h);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(s.x, s.y, p.w, 3);
      }

      // Hazards
      for (const h of levelRef.current.hazards) {
        const s = toScreen(h.x, h.y);
        if (s.x + h.w < 0 || s.x > width) continue;
        if (h.kind === "spike") {
          ctx.fillStyle = "rgba(184,77,77,0.6)";
          const teeth = Math.floor(h.w / 20);
          for (let i = 0; i < teeth; i++) {
            ctx.beginPath();
            ctx.moveTo(s.x + i * 20, s.y + h.h);
            ctx.lineTo(s.x + i * 20 + 10, s.y);
            ctx.lineTo(s.x + i * 20 + 20, s.y + h.h);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          const wave = Math.sin(t / 400) * 3;
          ctx.fillStyle = fox.powers.water ? "rgba(97,206,210,0.5)" : "rgba(80,110,180,0.55)";
          ctx.fillRect(s.x, s.y + wave, h.w, h.h);
        }
      }

      // Stars
      for (const star of levelRef.current.stars) {
        if (star.collected) continue;
        const s = toScreen(star.x, star.y);
        if (s.x < -30 || s.x > width + 30) continue;
        const pulse = 1 + Math.sin(t / 260 + star.x) * 0.18;
        ctx.fillStyle = "#ffe29a";
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const a2 = a + Math.PI / 5;
          ctx.lineTo(Math.cos(a) * star.r, Math.sin(a) * star.r);
          ctx.lineTo(Math.cos(a2) * star.r * 0.42, Math.sin(a2) * star.r * 0.42);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Goal marker
      {
        const s = toScreen(levelRef.current.goal.x, levelRef.current.goal.y);
        if (s.x > -40 && s.x < width + 40) {
          ctx.fillStyle = "rgba(124,130,255,0.4)";
          ctx.beginPath();
          ctx.arc(s.x, s.y, 30, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const fp = toScreen(fox.x, fox.y);
      drawFox(fp.x, fp.y, fox.facing, fox.swimming, t);

      if (deathFlashRef.current > 0) {
        ctx.fillStyle = `rgba(184,77,77,${deathFlashRef.current * 0.35})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <ExperienceLayout title="Fox & the Falling Stars" category="Games" accent="#7c82ff" background="#0b1120">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {started && !finished && (
          <div className={styles.hud}>
            <span className={styles.levelChip}>Level {levelNumber}</span>
            {STAR_ORDER.map((k) => (
              <span key={k} className={`${styles.starChip} ${collected[k] ? styles.starChipOn : ""}`}>
                {STAR_LABELS[k]}
              </span>
            ))}
            {respawns > 0 && <span className={styles.respawnCount}>{respawns}</span>}
          </div>
        )}

        {!started && (
          <div className={styles.menuPanel}>
            <h2 className={styles.menuTitle}>Fox & the Falling Stars</h2>
            <p className={styles.menuHint}>
              A quiet landscape, and stars that change the rules of the world when you find them.
            </p>
            <p className={styles.controlHint}>
              Arrow keys or WASD to move and jump. Shift or X to use a star's power once you have it.
            </p>
            {progress.levelReached > 1 && (
              <p className={styles.progressNote}>You've reached level {progress.levelReached} before.</p>
            )}
            <div className={styles.levelPicker}>
              <button
                className={styles.chip}
                onClick={() => setLevelNumber((n) => Math.max(1, n - 1))}
                disabled={levelNumber <= 1}
              >
                {"\u2190"}
              </button>
              <span className={styles.levelPickerLabel}>Level {levelNumber}</span>
              <button className={styles.chip} onClick={() => setLevelNumber((n) => n + 1)}>{"\u2192"}</button>
            </div>
            <button className={styles.launchButton} onClick={begin}>Begin</button>
          </div>
        )}

        {finished && (
          <div className={styles.endPanel}>
            <p className={styles.endText}>
              The fox sits at the edge of the light, looking back at where the stars fell.
            </p>
            <p className={styles.endSub}>Level {levelNumber} complete. The landscape looks a little different next time.</p>
            <div className={styles.endButtons}>
              <button className={styles.chip} onClick={begin}>Walk it again</button>
              <button className={styles.launchButton} onClick={nextLevel}>Next level {"\u2192"}</button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
