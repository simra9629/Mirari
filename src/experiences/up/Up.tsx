import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  createSim, step, checkChallenge, GRAVITY,
  type SimState, type PlacedBalloon,
} from "./engine";
import {
  OBJECTS, OBJECT_BY_ID, BALLOON_TYPES, BALLOON_BY_ID, CHALLENGES,
  SANDBOX_UNLOCK_CHALLENGE, loadProgress, saveProgress, completeChallenge,
  type Progress,
} from "./data";
import { makeRng } from "../../lib/rng";
import styles from "./Up.module.css";

type Mode = "menu" | "build" | "flying" | "sandbox-build" | "sandbox-flying";
type Outcome = "success" | "failed" | null;

const GROUND_SCREEN_Y = 380;
const WORLD_SCALE = 1.4;

let nextBalloonId = 0;

export function Up() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [mode, setMode] = useState<Mode>("menu");
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [objectId, setObjectId] = useState<string>("paper");
  const [balloons, setBalloons] = useState<PlacedBalloon[]>([]);
  const [selectedBalloonType, setSelectedBalloonType] = useState<string>("standard");
  const [wind, setWind] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [readout, setReadout] = useState({ altitude: 0, tiltDeg: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SimState | null>(null);
  const balloonsRef = useRef(balloons);
  const windRef = useRef(wind);
  const modeRef = useRef(mode);
  const outcomeRef = useRef(outcome);

  useEffect(() => { balloonsRef.current = balloons; }, [balloons]);
  useEffect(() => { windRef.current = wind; }, [wind]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { outcomeRef.current = outcome; }, [outcome]);
  useEffect(() => { saveProgress(progress); }, [progress]);

  const activeChallenge = useMemo(
    () => CHALLENGES.find((c) => c.id === activeChallengeId) ?? null,
    [activeChallengeId],
  );
  const sandboxUnlocked = progress.completed.includes(SANDBOX_UNLOCK_CHALLENGE);
  const obj = OBJECT_BY_ID[objectId];

  function startChallenge(challengeId: string) {
    const challenge = CHALLENGES.find((c) => c.id === challengeId);
    if (!challenge) return;
    setActiveChallengeId(challengeId);
    setObjectId(challenge.objectId);
    setBalloons([]);
    setOutcome(null);
    setWind(0);
    setMode("build");
  }

  function enterSandbox() {
    setActiveChallengeId(null);
    setObjectId(progress.unlockedObjects[0] ?? "paper");
    setBalloons([]);
    setOutcome(null);
    setWind(0);
    setMode("sandbox-build");
  }

  function placeBalloon(lx: number, ly: number) {
    setBalloons((prev) => [...prev, { id: nextBalloonId++, type: selectedBalloonType, lx, ly }]);
  }

  function removeBalloon(id: number) {
    setBalloons((prev) => prev.filter((b) => b.id !== id));
  }

  function launch() {
    simRef.current = createSim(objectId, balloonsRef.current);
    setOutcome(null);
    setMode(mode === "sandbox-build" ? "sandbox-flying" : "flying");
  }

  function backToBuild() {
    simRef.current = null;
    setMode(mode === "sandbox-flying" ? "sandbox-build" : "build");
  }

  function backToMenu() {
    simRef.current = null;
    setMode("menu");
  }

  // Main sim/render loop — always mounted so the canvas never has to reinitialize between modes.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas = canvasEl;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    let width = 0;
    let height = 0;
    let raf = 0;
    const rand = makeRng(9001);

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function worldToScreen(wx: number, wy: number, cameraY: number) {
      return { x: width / 2 + wx * WORLD_SCALE, y: GROUND_SCREEN_Y + (wy + cameraY) * WORLD_SCALE };
    }

    function drawObject(centerX: number, centerY: number, angle: number) {
      const o = OBJECT_BY_ID[objectId];
      if (!o) return;
      const w = o.halfW * WORLD_SCALE * 2;
      const h = o.halfH * WORLD_SCALE * 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.fillStyle = o.color;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1.5;

      switch (o.id) {
        case "paper": {
          ctx.beginPath();
          ctx.moveTo(-w / 2, -h / 2);
          ctx.lineTo(w / 2 - 6, -h / 2);
          ctx.lineTo(w / 2, -h / 2 + 6);
          ctx.lineTo(w / 2, h / 2);
          ctx.lineTo(-w / 2, h / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(w / 2 - 6, -h / 2);
          ctx.lineTo(w / 2 - 6, -h / 2 + 6);
          ctx.lineTo(w / 2, -h / 2 + 6);
          ctx.closePath();
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fill();
          break;
        }
        case "leaf": {
          ctx.beginPath();
          ctx.moveTo(0, -h / 2);
          ctx.quadraticCurveTo(w / 2, -h / 4, 0, h / 2);
          ctx.quadraticCurveTo(-w / 2, -h / 4, 0, -h / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -h / 2 + 2);
          ctx.lineTo(0, h / 2 - 2);
          ctx.strokeStyle = "rgba(0,0,0,0.3)";
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        }
        case "spoon": {
          ctx.beginPath();
          ctx.ellipse(0, -h * 0.28, w * 0.46, h * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(-w * 0.1, -h * 0.02, w * 0.2, h * 0.55, 3);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "cup": {
          ctx.beginPath();
          ctx.ellipse(0, 0, o.halfW * WORLD_SCALE, o.halfH * WORLD_SCALE, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(w * 0.44, 0, w * 0.16, h * 0.2, 0, -Math.PI * 0.6, Math.PI * 0.6);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-w * 0.32, -h * 0.22);
          ctx.lineTo(w * 0.32, -h * 0.22);
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.stroke();
          break;
        }
        case "toy-car": {
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h * 0.15, w, h * 0.65, 4);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(-w * 0.22, -h / 2, w * 0.44, h * 0.4, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#2b2f3d";
          for (const wx of [-w * 0.28, w * 0.28]) {
            ctx.beginPath();
            ctx.arc(wx, h * 0.42, h * 0.22, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case "backpack": {
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h * 0.42, w, h * 0.9, 6);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(-w * 0.28, -h * 0.1, w * 0.56, h * 0.36, 4);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          for (const sx of [-w * 0.18, w * 0.18]) {
            ctx.beginPath();
            ctx.moveTo(sx, -h * 0.42);
            ctx.lineTo(sx, -h * 0.6);
            ctx.lineWidth = 3;
            ctx.stroke();
          }
          break;
        }
        case "bicycle": {
          const r = h * 0.5;
          ctx.strokeStyle = "#2b2f3d";
          ctx.lineWidth = 2.5;
          for (const wx of [-w * 0.32, w * 0.32]) {
            ctx.beginPath();
            ctx.arc(wx, h * 0.02, r * 0.62, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(-w * 0.32, h * 0.02);
          ctx.lineTo(0, -h * 0.3);
          ctx.lineTo(w * 0.32, h * 0.02);
          ctx.lineTo(0, h * 0.02);
          ctx.lineTo(-w * 0.05, -h * 0.28);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, -h * 0.3);
          ctx.lineTo(w * 0.06, -h * 0.46);
          ctx.stroke();
          break;
        }
        case "sofa": {
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h * 0.1, w, h * 0.55, 6);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h * 0.5, w, h * 0.4, 6);
          ctx.fill();
          ctx.stroke();
          for (const ax of [-w * 0.5, w * 0.5 - w * 0.12]) {
            ctx.beginPath();
            ctx.roundRect(ax, -h * 0.42, w * 0.12, h * 0.75, 5);
            ctx.fill();
            ctx.stroke();
          }
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.beginPath();
          ctx.moveTo(0, -h * 0.1);
          ctx.lineTo(0, h * 0.45);
          ctx.stroke();
          break;
        }
        case "piano": {
          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h * 0.78, 3);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-w / 2, -h / 2);
          ctx.lineTo(w * 0.1, -h / 2);
          ctx.lineTo(w / 2, -h * 0.62);
          ctx.lineTo(-w / 2 + w * 0.15, -h * 0.62);
          ctx.closePath();
          ctx.fillStyle = "#2a2a2a";
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#f2ede0";
          const keyW = w * 0.85 / 7;
          for (let i = 0; i < 7; i++) {
            ctx.fillRect(-w * 0.42 + i * keyW, h * 0.2, keyW - 1.5, h * 0.18);
          }
          break;
        }
        case "small-house": {
          ctx.beginPath();
          ctx.rect(-w / 2, -h * 0.1, w, h * 0.6);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-w / 2 - 6, -h * 0.1);
          ctx.lineTo(0, -h * 0.62);
          ctx.lineTo(w / 2 + 6, -h * 0.1);
          ctx.closePath();
          ctx.fillStyle = "#8a4a3a";
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#4a3226";
          ctx.fillRect(-w * 0.12, h * 0.1, w * 0.24, h * 0.4);
          ctx.fillStyle = "#8a4a3a";
          ctx.fillRect(w * 0.22, -h * 0.55, w * 0.08, h * 0.22);
          break;
        }
        case "sand-grain": {
          ctx.beginPath();
          ctx.ellipse(0, 0, o.halfW * WORLD_SCALE, o.halfH * WORLD_SCALE, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 1;
          for (const a of [0, 1.1, 2.4]) {
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * w * 0.7, Math.sin(a) * w * 0.7);
            ctx.lineTo(Math.cos(a) * w * 0.95, Math.sin(a) * w * 0.95);
            ctx.stroke();
          }
          break;
        }
        default: {
          if (o.shape === "circle") {
            ctx.beginPath();
            ctx.ellipse(0, 0, o.halfW * WORLD_SCALE, o.halfH * WORLD_SCALE, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, 4);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }

    function drawBalloon(attachX: number, attachY: number, stringToX: number, stringToY: number, type: string, highlight: boolean) {
      const def = BALLOON_BY_ID[type];
      if (!def) return;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(stringToX, stringToY);
      ctx.lineTo(attachX, attachY);
      ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(attachX, attachY - 9, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (highlight) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    function draw() {
      const m = modeRef.current;
      const flying = m === "flying" || m === "sandbox-flying";
      const sim = simRef.current;

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#bcd9f2");
      sky.addColorStop(1, "#eaf4fb");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const cameraY = flying && sim ? Math.max(0, -sim.body.y - 60) : 0;

      // Ground
      const groundScreenY = GROUND_SCREEN_Y + cameraY * WORLD_SCALE;
      ctx.fillStyle = "#8fbf7a";
      ctx.fillRect(0, groundScreenY, width, Math.max(0, height - groundScreenY));
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.moveTo(0, groundScreenY);
      ctx.lineTo(width, groundScreenY);
      ctx.stroke();

      if (flying && sim) {
        const screenPos = worldToScreen(sim.body.x, sim.body.y, cameraY);
        for (const b of sim.balloons) {
          const c = Math.cos(sim.body.angle);
          const s = Math.sin(sim.body.angle);
          const wx = sim.body.x + (b.lx * c - b.ly * s);
          const wy = sim.body.y + (b.lx * s + b.ly * c);
          const bp = worldToScreen(wx, wy, cameraY);
          drawBalloon(bp.x, bp.y, screenPos.x, screenPos.y, b.type, false);
        }
        drawObject(screenPos.x, screenPos.y, sim.body.angle);
      } else {
        const screenPos = worldToScreen(0, 0, 0);
        for (const b of balloonsRef.current) {
          const bp = worldToScreen(b.lx, b.ly, 0);
          drawBalloon(bp.x, bp.y, screenPos.x, screenPos.y, b.type, true);
        }
        drawObject(screenPos.x, screenPos.y, 0);
      }

      if (flying && sim) {
        const challengeWind = m === "flying" && activeChallenge?.condition.wind !== undefined
          ? activeChallenge.condition.wind
          : windRef.current;
        step(sim, 1 / 60, OBJECT_BY_ID, BALLOON_BY_ID, { wind: challengeWind, gravity: GRAVITY }, rand);
        const tiltDeg = (Math.abs(sim.body.angle) * 180) / Math.PI;
        setReadout({ altitude: Math.max(0, -sim.body.y), tiltDeg });

        if (!outcomeRef.current) {
          if (m === "flying" && activeChallenge) {
            const result = checkChallenge(sim, activeChallenge.condition, 1 / 60);
            if (result !== "flying") {
              outcomeRef.current = result;
              setOutcome(result);
              if (result === "success") {
                setProgress((p) => completeChallenge(p, activeChallenge));
              }
            }
          } else if (sim.crashed) {
            outcomeRef.current = "failed";
            setOutcome("failed");
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    function screenToLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const sx = (clientX - rect.left) * (width / rect.width);
      const sy = (clientY - rect.top) * (height / rect.height);
      return { lx: (sx - width / 2) / WORLD_SCALE, ly: (sy - GROUND_SCREEN_Y) / WORLD_SCALE };
    }

    function onClick(e: MouseEvent) {
      const m = modeRef.current;
      if (m !== "build" && m !== "sandbox-build") return;
      const { lx, ly } = screenToLocal(e.clientX, e.clientY);

      // Clicking an existing balloon detaches it; otherwise attach a new one nearby.
      for (const b of balloonsRef.current) {
        if (Math.hypot(b.lx - lx, b.ly - ly) < 12) {
          removeBalloon(b.id);
          return;
        }
      }
      const o = OBJECT_BY_ID[objectId];
      const reach = Math.max(o.halfW, o.halfH) + 50;
      const d = Math.hypot(lx, ly) || 1;
      const clamped = d > reach ? { x: (lx / d) * reach, y: (ly / d) * reach } : { x: lx, y: ly };
      placeBalloon(clamped.x, clamped.y);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId, activeChallenge]);

  const availableBalloons = BALLOON_TYPES.filter((b) => progress.unlockedBalloons.includes(b.id));

  return (
    <ExperienceLayout title="Up!" category="Games" accent="#5aa8e0" background="#bcd9f2" light>
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {mode === "menu" && (
          <div className={styles.menuPanel}>
            <h2 className={styles.menuTitle}>Make it fly.</h2>
            <p className={styles.menuHint}>Attach balloons. Release. See what happens.</p>
            <div className={styles.challengeList}>
              {CHALLENGES.map((c, i) => {
                const done = progress.completed.includes(c.id);
                const prevDone = i === 0 || progress.completed.includes(CHALLENGES[i - 1].id);
                const locked = !prevDone && !done;
                return (
                  <button
                    key={c.id}
                    className={`${styles.challengeRow} ${done ? styles.challengeDone : ""}`}
                    onClick={() => !locked && startChallenge(c.id)}
                    disabled={locked}
                  >
                    <span className={styles.challengeCheck}>{done ? "\u2713" : locked ? "\u2013" : "\u2022"}</span>
                    <span className={styles.challengeText}>
                      <strong>{c.title}</strong>
                      <span className={styles.challengeDetail}>{c.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              className={styles.sandboxButton}
              onClick={enterSandbox}
              disabled={!sandboxUnlocked}
            >
              {sandboxUnlocked ? "Open the sandbox \u2192" : "Sandbox unlocks after \u201cDon't spill it\u201d"}
            </button>
          </div>
        )}

        {(mode === "build" || mode === "sandbox-build") && (
          <>
            <div className={styles.topBar}>
              <button className={styles.chip} onClick={backToMenu}>{"\u2190"} Menu</button>
              <div className={styles.objectLabel}>{obj.label}</div>
              <button className={styles.chip} onClick={() => setBalloons([])}>Clear balloons</button>
            </div>

            {mode === "sandbox-build" && (
              <div className={styles.sandboxRow}>
                <select
                  className={styles.select}
                  value={objectId}
                  onChange={(e) => { setObjectId(e.target.value); setBalloons([]); }}
                >
                  {OBJECTS.filter((o) => progress.unlockedObjects.includes(o.id)).map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <label className={styles.windLabel}>
                  Wind {wind.toFixed(0)}
                  <input
                    type="range" min={-30} max={30} value={wind}
                    onChange={(e) => setWind(Number(e.target.value))}
                  />
                </label>
              </div>
            )}

            <div className={styles.hintStack}>
              <p className={styles.hintLine}>{obj.detail}</p>
              <p className={styles.hintLine}>Click the object to attach a balloon. Click a balloon to remove it.</p>
            </div>

            <div className={styles.balloonPalette}>
              {availableBalloons.map((b) => (
                <button
                  key={b.id}
                  className={`${styles.balloonChip} ${selectedBalloonType === b.id ? styles.balloonChipActive : ""}`}
                  style={{ borderColor: b.color }}
                  onClick={() => setSelectedBalloonType(b.id)}
                  title={b.detail}
                >
                  <span className={styles.balloonDot} style={{ background: b.color }} />
                  {b.label}
                </button>
              ))}
            </div>

            <button className={styles.launchButton} onClick={launch} disabled={balloons.length === 0}>
              Release
            </button>
          </>
        )}

        {(mode === "flying" || mode === "sandbox-flying") && (
          <>
            <div className={styles.topBar}>
              <button className={styles.chip} onClick={backToBuild}>{"\u2190"} Adjust</button>
              <div className={styles.readoutBar}>
                Altitude {readout.altitude.toFixed(0)} &middot; Tilt {readout.tiltDeg.toFixed(0)}{"\u00b0"}
              </div>
            </div>

            {activeChallenge && mode === "flying" && (
              <div className={styles.challengeBanner}>
                <strong>{activeChallenge.title}</strong> — needs {activeChallenge.condition.minAltitude} altitude
                {activeChallenge.condition.maxTiltDeg !== undefined && `, under ${activeChallenge.condition.maxTiltDeg}\u00b0 tilt`}
                {activeChallenge.condition.holdSeconds !== undefined && `, held for ${activeChallenge.condition.holdSeconds}s`}
                {activeChallenge.condition.timeLimit !== undefined && `, within ${activeChallenge.condition.timeLimit}s`}
                {activeChallenge.condition.wind !== undefined && `, wind ${activeChallenge.condition.wind}`}
              </div>
            )}

            {outcome && (
              <div className={styles.outcomePanel}>
                <div className={outcome === "success" ? styles.outcomeSuccess : styles.outcomeFailed}>
                  {outcome === "success" ? "It flew." : "It didn't quite make it."}
                </div>
                <div className={styles.outcomeButtons}>
                  <button className={styles.chip} onClick={backToBuild}>Try again</button>
                  {outcome === "success" && mode === "flying" && (
                    <button className={styles.launchButtonInline} onClick={backToMenu}>Back to menu</button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ExperienceLayout>
  );
}
