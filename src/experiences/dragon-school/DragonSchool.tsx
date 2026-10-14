import { useEffect, useMemo, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import {
  WORLD_W, WORLD_H,
  createRingRun, stepRingRun, type RingRunState,
  createFireRun, stepFireRun, type FireRunState,
  createLandingRun, stepLandingRun, type LandingRunState,
  createRescueRun, stepRescueRun, type RescueRunState,
} from "./engine";
import { LESSONS, RANKS, loadProgress, saveProgress, completeLesson, currentRank, type Lesson, type Progress } from "./data";
import styles from "./DragonSchool.module.css";

type Screen = "menu" | "ready" | "playing" | "result";

export function DragonSchool() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>("menu");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"success" | "failed" | null>(null);
  const [liveInfo, setLiveInfo] = useState({ time: 0, extra: "" });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef(screen);
  const keysRef = useRef<Set<string>>(new Set());
  const pointerRef = useRef({ x: WORLD_W / 2, y: WORLD_H / 2, down: false });
  const runRef = useRef<RingRunState | FireRunState | LandingRunState | RescueRunState | null>(null);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { saveProgress(progress); }, [progress]);

  const activeLesson = useMemo(() => LESSONS.find((l) => l.id === activeLessonId) ?? null, [activeLessonId]);
  const rank = currentRank(progress);

  function startLesson(lesson: Lesson) {
    setActiveLessonId(lesson.id);
    setOutcome(null);
    runRef.current = null;
    setScreen("ready");
  }

  function beginPlay() {
    if (!activeLesson) return;
    if (activeLesson.kind === "flight" || activeLesson.kind === "speed") {
      runRef.current = createRingRun(activeLesson.ring!);
    } else if (activeLesson.kind === "fire") {
      runRef.current = createFireRun(activeLesson.fire!);
    } else if (activeLesson.kind === "precision") {
      runRef.current = createLandingRun(activeLesson.landing!);
    } else if (activeLesson.kind === "rescue") {
      runRef.current = createRescueRun(activeLesson.rescue!);
    }
    setScreen("playing");
  }

  function retry() {
    setOutcome(null);
    runRef.current = null;
    setScreen("ready");
  }

  function backToMenu() {
    setActiveLessonId(null);
    runRef.current = null;
    setScreen("menu");
  }

  // Keyboard + pointer input, active for the whole component lifetime.
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

  // Main render/simulation loop.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas = canvasEl;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    let width = 0, height = 0, scale = 1, offX = 0, offY = 0;
    let raf = 0;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(width / WORLD_W, height / WORLD_H);
      offX = (width - WORLD_W * scale) / 2;
      offY = (height - WORLD_H * scale) / 2;
    }

    function toScreen(x: number, y: number) {
      return { x: offX + x * scale, y: offY + y * scale };
    }
    function toWorld(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const sx = (clientX - rect.left) * (width / rect.width);
      const sy = (clientY - rect.top) * (height / rect.height);
      return { x: (sx - offX) / scale, y: (sy - offY) / scale };
    }

    function drawDragon(x: number, y: number, angle: number, flap: number) {
      const p = toScreen(x, y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      const s = scale;
      ctx.fillStyle = "#6fae5a";
      // wings
      ctx.fillStyle = "rgba(111,174,90,0.85)";
      ctx.beginPath();
      ctx.moveTo(-4 * s, 0);
      ctx.lineTo(-20 * s, -14 * s * flap);
      ctx.lineTo(-6 * s, 6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4 * s, 0);
      ctx.lineTo(-20 * s, 14 * s * flap);
      ctx.lineTo(-6 * s, -6 * s);
      ctx.closePath();
      ctx.fill();
      // body
      ctx.fillStyle = "#6fae5a";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.ellipse(14 * s, 0, 7 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // snout
      ctx.fillStyle = "#5a9048";
      ctx.beginPath();
      ctx.ellipse(20 * s, 0, 3.5 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBackground() {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#fdeecb");
      sky.addColorStop(1, "#f7d9a8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
    }

    let last = performance.now();

    function draw(t: number) {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;

      drawBackground();

      const scr = screenRef.current;
      const lesson = activeLesson;
      if (!lesson || scr === "menu") return;

      const run = runRef.current;
      const flap = 1 + Math.sin(t / 90) * 0.4;

      if (scr === "playing" && run) {
        // Step simulation based on current input.
        const keys = keysRef.current;
        const ax = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
        const ay = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);

        if (lesson.kind === "flight" || lesson.kind === "speed") {
          stepRingRun(run as RingRunState, lesson.ring!, { ax, ay }, dt);
        } else if (lesson.kind === "fire") {
          const fr = run as FireRunState;
          fr.aimX = pointerRef.current.x;
          fr.aimY = pointerRef.current.y;
          fr.breathing = pointerRef.current.down;
          stepFireRun(fr, lesson.fire!, dt);
        } else if (lesson.kind === "precision") {
          stepLandingRun(run as LandingRunState, lesson.landing!, ax, dt);
        } else if (lesson.kind === "rescue") {
          stepRescueRun(run as RescueRunState, lesson.rescue!, { ax, ay }, dt);
        }

        const r = run as { done: boolean; failed: boolean; time: number };
        if (r.done || r.failed) {
          const result = r.done ? "success" : "failed";
          setOutcome(result);
          setScreen("result");
          if (result === "success") {
            setProgress((p) => completeLesson(p, lesson.id, r.time));
          }
        }
      }

      // Render per lesson kind.
      if (lesson.kind === "flight" || lesson.kind === "speed") {
        const rr = run as RingRunState | null;
        const level = lesson.ring!;
        level.rings.forEach((ring, i) => {
          const hit = rr?.hit[i];
          const p = toScreen(ring.x, ring.y);
          ctx.strokeStyle = hit ? "rgba(111,174,90,0.4)" : "#e6b968";
          ctx.lineWidth = 4 * scale;
          ctx.beginPath();
          ctx.arc(p.x, p.y, ring.r * scale, 0, Math.PI * 2);
          ctx.stroke();
          if (level.ordered && !hit) {
            const nextIdx = rr?.hit.findIndex((h) => !h);
            if (nextIdx === i) {
              ctx.fillStyle = "rgba(230,185,104,0.9)";
              ctx.font = `${11 * scale}px var(--font-mono, monospace)`;
              ctx.textAlign = "center";
              ctx.fillText(String(i + 1), p.x, p.y - ring.r * scale - 8 * scale);
            }
          }
        });
        const body = rr ? rr.body : { x: level.startX, y: level.startY, vx: 0, vy: 0 };
        const angle = Math.atan2(body.vy, body.vx || 1);
        drawDragon(body.x, body.y, Math.hypot(body.vx, body.vy) > 4 ? angle : 0, flap);
        setLiveInfo({ time: rr?.time ?? 0, extra: `${rr?.hit.filter(Boolean).length ?? 0}/${level.rings.length}` });
      } else if (lesson.kind === "fire") {
        const fr = run as FireRunState | null;
        const level = lesson.fire!;
        const mouthX = WORLD_W / 2, mouthY = WORLD_H - 40;
        if (fr?.breathing) {
          const p = toScreen(mouthX, mouthY);
          const aim = toScreen(fr.aimX, fr.aimY);
          const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
          const half = 0.34;
          ctx.fillStyle = "rgba(255,140,60,0.55)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.arc(p.x, p.y, 340 * scale, angle - half, angle + half);
          ctx.closePath();
          ctx.fill();
        }
        for (const target of fr?.targets ?? level.targets) {
          const alive = "appearAt" in target && (fr ? fr.time >= target.appearAt : true);
          if (!alive || target.hitAt !== null) continue;
          const p = toScreen(target.x, target.y);
          ctx.fillStyle = "#c95c58";
          ctx.beginPath();
          ctx.arc(p.x, p.y, target.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        drawDragon(mouthX, mouthY + 8, -Math.PI / 2, flap * 0.3);
        setLiveInfo({ time: fr?.time ?? 0, extra: `${fr?.hits ?? 0}/${level.requiredHits}` });
      } else if (lesson.kind === "precision") {
        const lr = run as LandingRunState | null;
        const level = lesson.landing!;
        level.pads.forEach((pad, i) => {
          const done = lr ? i < lr.padIndex : false;
          const p = toScreen(pad.x, pad.y);
          ctx.fillStyle = done ? "rgba(111,174,90,0.5)" : "#8a8c8e";
          ctx.fillRect(p.x - pad.halfW * scale, p.y, pad.halfW * 2 * scale, 6 * scale);
        });
        const x = lr?.x ?? WORLD_W / 2;
        const y = lr?.y ?? 40;
        drawDragon(x, y, Math.PI / 2, flap * 0.6);
        setLiveInfo({ time: 0, extra: `${lr?.landed ?? 0}/${level.pads.length}` });
      } else if (lesson.kind === "rescue") {
        const rr = run as RescueRunState | null;
        const level = lesson.rescue!;
        const safe = toScreen(level.safeX, level.safeY);
        ctx.fillStyle = "rgba(111,174,90,0.35)";
        ctx.beginPath();
        ctx.arc(safe.x, safe.y, 26 * scale, 0, Math.PI * 2);
        ctx.fill();
        if (!rr || (!rr.carrying && !rr.delivered)) {
          const sp = toScreen(level.studentX, level.studentY);
          ctx.fillStyle = "#e6b968";
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 8 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const h of rr?.hazards ?? level.hazards) {
          const hp = toScreen(h.x, h.y);
          ctx.fillStyle = "#b84d4d";
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, h.r * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        const body = rr ? rr.body : { x: 40, y: WORLD_H / 2, vx: 0, vy: 0 };
        const angle = Math.atan2(body.vy, body.vx || 1);
        drawDragon(body.x, body.y, Math.hypot(body.vx, body.vy) > 4 ? angle : 0, flap);
        setLiveInfo({ time: rr?.time ?? 0, extra: rr?.carrying ? "carrying" : rr?.delivered ? "delivered" : "find the student" });
      }
    }

    function onMouseMove(e: MouseEvent) {
      const w = toWorld(e.clientX, e.clientY);
      pointerRef.current.x = w.x;
      pointerRef.current.y = w.y;
    }
    function onMouseDown() { pointerRef.current.down = true; }
    function onMouseUp() { pointerRef.current.down = false; }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson]);

  const groupedLessons = RANKS.map((r) => ({ rank: r, lessons: LESSONS.filter((l) => l.rank === r) }));

  return (
    <ExperienceLayout title="Dragon School" category="Games" accent="#6fae5a" background="#fdeecb" light>
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        {screen === "menu" && (
          <div className={styles.menuPanel}>
            <h2 className={styles.menuTitle}>Dragon School</h2>
            <p className={styles.menuHint}>Current rank: {rank}</p>
            {groupedLessons.map(({ rank: r, lessons }) => (
              <div key={r} className={styles.rankGroup}>
                <div className={styles.rankLabel}>{r}</div>
                {lessons.map((lesson) => {
                  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
                  const done = progress.completed.includes(lesson.id);
                  const locked = idx > 0 && !progress.completed.includes(LESSONS[idx - 1].id) && !done;
                  return (
                    <button
                      key={lesson.id}
                      className={`${styles.lessonRow} ${done ? styles.lessonDone : ""}`}
                      onClick={() => !locked && startLesson(lesson)}
                      disabled={locked}
                    >
                      <span className={styles.lessonCheck}>{done ? "\u2713" : locked ? "\u2013" : "\u2022"}</span>
                      <span className={styles.lessonText}>
                        <strong>{lesson.title}</strong>
                        <span className={styles.lessonDetail}>{lesson.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {screen === "ready" && activeLesson && (
          <div className={styles.readyPanel}>
            <h3 className={styles.readyTitle}>{activeLesson.title}</h3>
            <p className={styles.readyDetail}>{activeLesson.detail}</p>
            <p className={styles.readyControl}>{activeLesson.controlHint}</p>
            <div className={styles.readyButtons}>
              <button className={styles.chip} onClick={backToMenu}>{"\u2190"} Menu</button>
              <button className={styles.launchButton} onClick={beginPlay}>Begin</button>
            </div>
          </div>
        )}

        {screen === "playing" && activeLesson && (
          <div className={styles.hud}>
            <span>{liveInfo.extra}</span>
            {(activeLesson.kind === "speed" || activeLesson.kind === "flight" || activeLesson.kind === "rescue") && (
              <span>{liveInfo.time.toFixed(1)}s</span>
            )}
          </div>
        )}

        {screen === "result" && activeLesson && (
          <div className={styles.resultPanel}>
            <div className={outcome === "success" ? styles.resultSuccess : styles.resultFailed}>
              {outcome === "success" ? "Well flown." : "Not this time."}
            </div>
            <div className={styles.readyButtons}>
              <button className={styles.chip} onClick={retry}>Try again</button>
              <button className={styles.launchButton} onClick={backToMenu}>Back to school</button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
