import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./PlantsMove.module.css";
import { makeRng } from "../../lib/rng";

type Kind = "sun" | "water" | "skittish" | "creeper";

interface Plant {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  health: number; // 0..1, drives size and color
  size: number;
  target: 0 | 1; // which of the two same-type resources this plant currently favors
}

interface Resource {
  x: number;
  y: number;
  capacity: number;
}

const KIND_COLOR: Record<Kind, string> = { sun: "#e6b968", water: "#61ced2", skittish: "#d67574", creeper: "#9b6fd6" };
const KIND_LABEL: Record<Kind, string> = {
  sun: "sun-seeking", water: "water-seeking", skittish: "skittish", creeper: "creeper (competes for ground)",
};
const CAPACITY_RADIUS = 90;

let nextId = 0;

export function PlantsMove() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState(
    "Drag a sun or a pool of water. Everything else keeps moving on its own \u2014 come back later and something will have changed.",
  );
  const [thriving, setThriving] = useState(0);
  const [wilting, setWilting] = useState(0);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let raf = 0;
    const rand = makeRng(3131);
    let plants: Plant[] = [];
    const suns: Resource[] = [{ x: 0, y: 0, capacity: 3 }, { x: 0, y: 0, capacity: 3 }];
    const waters: Resource[] = [{ x: 0, y: 0, capacity: 3 }, { x: 0, y: 0, capacity: 3 }];
    let dangerPos: { x: number; y: number; life: number } | null = null;
    let dragging: { kind: "sun" | "water"; index: number } | null = null;
    let statTimer = 0;

    function seed() {
      suns[0].x = width * 0.18; suns[0].y = height * 0.16;
      suns[1].x = width * 0.5; suns[1].y = height * 0.1;
      waters[0].x = width * 0.84; waters[0].y = height * 0.18;
      waters[1].x = width * 0.6; waters[1].y = height * 0.12;
      plants = [];
      const kinds: Kind[] = ["sun", "water", "skittish", "sun", "water", "creeper"];
      for (let i = 0; i < 18; i++) {
        const kind = kinds[i % kinds.length];
        const x = width * 0.12 + rand() * width * 0.76;
        const y = height * 0.42 + rand() * height * 0.5;
        plants.push({ id: nextId++, kind, x, y, health: 0.5 + rand() * 0.3, size: 10 + rand() * 6, target: rand() < 0.5 ? 0 : 1 });
      }
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (plants.length === 0) seed();
    }

    /** How crowded a resource is right now: plants of its own kind within range, vs its capacity. */
    function crowding(res: Resource, kind: Kind): number {
      let n = 0;
      for (const p of plants) if (p.kind === kind && Math.hypot(p.x - res.x, p.y - res.y) < CAPACITY_RADIUS) n++;
      return n / res.capacity;
    }

    function densestNeighbor(p: Plant): { x: number; y: number } | null {
      let bx = 0, by = 0, n = 0;
      for (const o of plants) {
        if (o === p) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d < 140) { bx += o.x; by += o.y; n++; }
      }
      if (n < 2) return null;
      return { x: bx / n, y: by / n };
    }

    function step(dt: number) {
      const creepers = plants.filter((p) => p.kind === "creeper");

      for (const p of plants) {
        let tx = p.x;
        let ty = p.y;
        let speed = 6;
        let fed = false;

        if (p.kind === "sun" || p.kind === "water") {
          const list = p.kind === "sun" ? suns : waters;
          // Re-evaluate which resource is the better deal (closer, less crowded)
          // every so often, so plants can and do migrate between the two.
          const scoreOf = (i: number) => {
            const r = list[i];
            const d = Math.hypot(p.x - r.x, p.y - r.y);
            return crowding(r, p.kind) * 140 + d * 0.3;
          };
          if (rand() < dt * 0.4) {
            p.target = scoreOf(0) <= scoreOf(1) ? 0 : 1;
          }
          const res = list[p.target];
          const crowd = crowding(res, p.kind);
          const angle = (p.id % 7) / 7 * Math.PI * 2;
          const spread = 20 + crowd * 26;
          tx = res.x + Math.cos(angle) * spread;
          ty = res.y + Math.sin(angle) * spread + height * 0.32;
          speed = 9;
          fed = crowd <= 1.05;
        } else if (p.kind === "skittish") {
          let threatX = 0, threatY = 0, threatD = Infinity, hasThreat = false;
          if (dangerPos) {
            const d = Math.hypot(p.x - dangerPos.x, p.y - dangerPos.y);
            if (d < 140) { threatX = dangerPos.x; threatY = dangerPos.y; threatD = d; hasThreat = true; }
          }
          for (const c of creepers) {
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (d < 90 && d < threatD) { threatX = c.x; threatY = c.y; threatD = d; hasThreat = true; }
          }
          if (hasThreat) {
            const dx = p.x - threatX, dy = p.y - threatY;
            const d = Math.hypot(dx, dy) || 1;
            tx = p.x + (dx / d) * 60;
            ty = p.y + (dy / d) * 60;
            speed = 26;
          } else {
            // idle drift so it never looks frozen even with nothing nearby
            tx = p.x + Math.sin(p.id + performance.now() / 4000) * 18;
            ty = p.y + Math.cos(p.id * 1.3 + performance.now() / 5000) * 12;
            speed = 2;
          }
          fed = true;
        } else if (p.kind === "creeper") {
          const target = densestNeighbor(p);
          if (target) {
            tx = target.x;
            ty = target.y;
            speed = 5;
          } else {
            tx = p.x + Math.sin(p.id + performance.now() / 3500) * 22;
            ty = p.y + Math.cos(p.id + performance.now() / 3000) * 22;
            speed = 4;
          }
          fed = true;
        }

        p.x += (tx - p.x) * Math.min(1, speed * dt * 0.05);
        p.y += (ty - p.y) * Math.min(1, speed * dt * 0.05);
        p.x = Math.max(10, Math.min(width - 10, p.x));
        p.y = Math.max(10, Math.min(height - 10, p.y));

        // Creepers encroaching on a plant's ground count against it too.
        if (p.kind !== "creeper") {
          for (const c of creepers) if (Math.hypot(c.x - p.x, c.y - p.y) < 26) fed = false;
        }

        const rate = fed ? 0.05 : 0.09;
        p.health += (fed ? 1 : -1) * rate * dt;
        p.health = Math.max(0, Math.min(1, p.health));
        p.size = 6 + p.health * 12;
      }

      // Wilted plants eventually die and, after a pause, a new seedling
      // sprouts somewhere else \u2014 the scene keeps turning over on its own.
      const alive: Plant[] = [];
      for (const p of plants) {
        if (p.health <= 0 && rand() < dt * 0.15) continue;
        alive.push(p);
      }
      plants = alive;
      if (plants.length < 16 && rand() < dt * 0.25) {
        const kinds: Kind[] = ["sun", "water", "skittish", "creeper"];
        const kind = kinds[Math.floor(rand() * kinds.length)];
        plants.push({
          id: nextId++, kind,
          x: width * 0.12 + rand() * width * 0.76,
          y: height * 0.42 + rand() * height * 0.5,
          health: 0.25, size: 6, target: rand() < 0.5 ? 0 : 1,
        });
      }

      statTimer -= dt;
      if (statTimer <= 0) {
        statTimer = 0.5;
        let t = 0, w = 0;
        for (const p of plants) if (p.health > 0.55) t++; else if (p.health < 0.3) w++;
        setThriving(t);
        setWilting(w);
      }

      if (dangerPos) {
        dangerPos.life -= dt;
        if (dangerPos.life <= 0) dangerPos = null;
      }
    }

    function drawResource(r: Resource, kind: "sun" | "water") {
      const crowd = crowding(r, kind);
      const glowColor = kind === "sun" ? "255,226,154" : "97,206,210";
      ctx.fillStyle = `rgba(${glowColor},${crowd > 1 ? 0.06 : 0.13})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, kind === "sun" ? 55 : 42, 0, Math.PI * 2);
      ctx.fill();
      if (kind === "sun") {
        ctx.fillStyle = "#ffe29a";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#61ced2";
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - 11);
        ctx.quadraticCurveTo(r.x + 9, r.y + 4, r.x, r.y + 11);
        ctx.quadraticCurveTo(r.x - 9, r.y + 4, r.x, r.y - 11);
        ctx.fill();
      }
      if (crowd > 1) {
        ctx.strokeStyle = "rgba(214,117,116,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, (kind === "sun" ? 55 : 42) + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawPlant(p: Plant, t: number) {
      const sway = reducedMotion.current ? 0 : Math.sin(t / 1600 + p.x) * (2 + p.health * 2);
      const wilted = p.health < 0.3;
      ctx.strokeStyle = wilted ? "#5a4a34" : "#3f6b45";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.size * 0.6);
      const lean = wilted ? p.size * 0.5 : 0;
      ctx.quadraticCurveTo(p.x + sway + lean * 0.5, p.y, p.x + sway * 0.6 + lean, p.y - p.size * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.4 + p.health * 0.6;
      ctx.fillStyle = KIND_COLOR[p.kind];
      ctx.beginPath();
      ctx.arc(p.x + sway * 0.6 + lean, p.y - p.size * 0.5, p.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function pointFromEvent(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (width / rect.width), y: (e.clientY - rect.top) * (height / rect.height) };
    }

    function onDown(e: PointerEvent) {
      const p = pointFromEvent(e);
      for (let i = 0; i < suns.length; i++) {
        if (Math.hypot(p.x - suns[i].x, p.y - suns[i].y) < 20) { dragging = { kind: "sun", index: i }; return; }
      }
      for (let i = 0; i < waters.length; i++) {
        if (Math.hypot(p.x - waters[i].x, p.y - waters[i].y) < 20) { dragging = { kind: "water", index: i }; return; }
      }
      dangerPos = { x: p.x, y: p.y, life: 14 };
      setCaption("Danger placed \u2014 it'll pass in a while. Skittish plants scatter, and creepers moving in on them push them out too.");
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      const p = pointFromEvent(e);
      const list = dragging.kind === "sun" ? suns : waters;
      list[dragging.index].x = p.x;
      list[dragging.index].y = p.y;
      setCaption(
        dragging.kind === "sun"
          ? "Sun-seeking plants are weighing both patches of light \u2014 crowd one and some will drift to the other."
          : "Water-seeking plants are doing the same with both pools.",
      );
    }
    function onUp() {
      dragging = null;
    }

    let last = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (!reducedMotion.current) step(dt);

      ctx.fillStyle = "#182013";
      ctx.fillRect(0, 0, width, height);

      for (const r of suns) drawResource(r, "sun");
      for (const r of waters) drawResource(r, "water");

      if (dangerPos) {
        ctx.strokeStyle = "#d36b6b";
        ctx.lineWidth = 2.5;
        const s = 8;
        ctx.beginPath();
        ctx.moveTo(dangerPos.x - s, dangerPos.y - s);
        ctx.lineTo(dangerPos.x + s, dangerPos.y + s);
        ctx.moveTo(dangerPos.x + s, dangerPos.y - s);
        ctx.lineTo(dangerPos.x - s, dangerPos.y + s);
        ctx.stroke();
      }

      for (const p of plants) drawPlant(p, t);

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <ExperienceLayout title="What If Plants Could Move?" category="Experiment" accent="#7fae7a" background="#182013">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <p className={styles.caption}>{caption}</p>
          <div className={styles.readout}>{thriving} thriving &middot; {wilting} wilting</div>
          <div className={styles.legend}>
            {(["sun", "water", "skittish", "creeper"] as const).map((k) => (
              <span key={k} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: KIND_COLOR[k] }} />
                {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
