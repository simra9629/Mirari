import { useEffect, useRef } from "react";
import gsap from "gsap";
import { LH, LW, SPRITES, SPRITE_PAD, mix, renderRoom, renderSprite, rgba, rng, type Sprite } from "./paint";

export interface LabEvent { key: number; kind: "new" | "known" | "fizzle" | "heat" | "cool" | "grind" | "wait" | "stage" }

interface Props {
  /** Index of the current stage, 0–6. */
  stage: number;
  /** Colours for the jars on the shelf — one per discovery. */
  jars: string[];
  condition: string;
  event: LabEvent | null;
  reduced: boolean;
  className?: string;
}

interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; kind: "spark" | "smoke" | "dust" | "frost" | "bubble"; color: string }

const TAU = Math.PI * 2;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** The painted lab behind the bench. Grows with the player's stage; reacts to what they combine. */
export function LabScene({ stage, jars, condition, event, reduced, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ stage, jars, condition, reduced });
  props.current = { stage, jars, condition, reduced };
  const lab = useRef({
    reveal: SPRITES.map((s) => (s.stage <= stage ? 1 : 0)), prevStage: stage, flash: 0, flare: 0, frost: 0, shake: 0,
    jarPop: 1, parts: [] as Part[], heat: 0, lastJars: jars.length, sx: 0, sy: 0,
  });
  const api = useRef<{ burst: (k: Part["kind"], x: number, y: number, n: number, color: string, speed?: number) => void } | null>(null);

  /* ---------- the render loop ---------- */
  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d")!;
    let raf = 0, last = performance.now(), room: HTMLCanvasElement | null = null;
    let sprites: Record<string, HTMLCanvasElement> = {};
    let geom = { cw: 0, ch: 0, dpr: 1, s: 1, ox: 0, oy: 0 };
    let rebuildTimer = 0;

    const build = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.max(320, Math.round(r.width)), ch = Math.max(320, Math.round(r.height));
      canvas.width = cw * dpr; canvas.height = ch * dpr;
      const s = Math.max(cw / LW, ch / LH);
      geom = { cw, ch, dpr, s, ox: (cw - LW * s) / 2, oy: (ch - LH * s) / 2 };
      room = renderRoom(cw, ch, dpr);
      sprites = {};
      for (const sp of SPRITES) sprites[sp.id] = renderSprite(sp, s * dpr);
    };
    build();
    const ro = new ResizeObserver(() => { window.clearTimeout(rebuildTimer); rebuildTimer = window.setTimeout(build, 160); });
    ro.observe(canvas);

    const L = lab.current;
    const burst = (kind: Part["kind"], x: number, y: number, n: number, color: string, speed = 90) => {
      if (props.current.reduced) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, v = (0.3 + Math.random() * 0.7) * speed;
        const up = kind === "spark" || kind === "smoke" || kind === "dust" ? -1 : 0;
        if (L.parts.length > 260) L.parts.shift();
        L.parts.push({ x, y, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v * 0.4 + up * v * 0.5, life: 0.8 + Math.random() * 1.2, max: 2, size: 1.5 + Math.random() * 3, kind, color });
      }
    };
    api.current = { burst };

    const spriteDraw = (sp: Sprite, alpha: number, off: [number, number]) => {
      const c = sprites[sp.id]; if (!c || alpha <= 0.002) return;
      g.globalAlpha = alpha;
      g.drawImage(c, sp.x - SPRITE_PAD + off[0], sp.y - SPRITE_PAD + off[1], c.width / (geom.s * geom.dpr), c.height / (geom.s * geom.dpr));
      g.globalAlpha = 1;
    };
    const glow = (x: number, y: number, r: number, col: string, a: number) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      const P = props.current, red = P.reduced;
      const { cw, ch, dpr, s, ox, oy } = geom;

      // eased state
      const heatTarget = P.condition === "heat" ? 1 : 0;
      L.heat += (heatTarget - L.heat) * Math.min(1, dt * 3);
      const frostTarget = P.condition === "cool" ? 1 : 0;
      L.frost += (frostTarget - L.frost) * Math.min(1, dt * 3);

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (room) g.drawImage(room, 0, 0);
      const shx = !red && L.shake > 0.01 ? (Math.random() - 0.5) * L.shake : 0, shy = !red && L.shake > 0.01 ? (Math.random() - 0.5) * L.shake : 0;
      g.setTransform(s * dpr, 0, 0, s * dpr, (ox + shx) * dpr, (oy + shy) * dpr);

      /* the window: night sky, a slow moon, drifting cloud */
      g.save();
      g.beginPath(); g.moveTo(110, 260); g.lineTo(110, 110); g.quadraticCurveTo(205, 20, 300, 110); g.lineTo(300, 260); g.closePath(); g.clip();
      const sg = g.createLinearGradient(0, 40, 0, 260); sg.addColorStop(0, "#0e1038"); sg.addColorStop(1, "#2a2a5a");
      g.fillStyle = sg; g.fillRect(100, 20, 210, 250);
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.abs(Math.sin(t * (0.5 + hash(i)) + i))})`; g.fillRect(112 + hash(i) * 186, 40 + hash(i + 7) * 190, 1.6, 1.6); }
      const mx = 150 + ((t * 1.2) % 160), my = 90 + Math.sin(mx * 0.02) * 14;
      glow(mx, my, 60, "#cfd8ff", 0.35); g.fillStyle = "#e8ecff"; g.beginPath(); g.arc(mx, my, 17, 0, TAU); g.fill(); g.fillStyle = "#0e1038"; g.beginPath(); g.arc(mx + 7, my - 3, 15, 0, TAU); g.fill();
      g.fillStyle = "rgba(60,64,110,0.55)"; for (let k = 0; k < 3; k++) { const cx = 100 + ((t * (4 + k * 2) + k * 90) % 260); g.beginPath(); g.ellipse(cx, 150 + k * 36, 44, 9, 0, 0, TAU); g.fill(); }
      g.restore();
      g.strokeStyle = "rgba(10,6,14,0.75)"; g.lineWidth = 3; g.beginPath(); g.moveTo(205, 62); g.lineTo(205, 260); g.moveTo(110, 170); g.lineTo(300, 170); g.stroke();
      // a shaft of moonlight onto the bench
      g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(160,180,255,0.07)";
      g.beginPath(); g.moveTo(130, 200); g.lineTo(290, 200); g.lineTo(420, 470); g.lineTo(190, 470); g.closePath(); g.fill(); g.restore();

      /* the stage's pieces, in depth order */
      const order = ["herbs", "shelves", "oculus", "chart", "drawer", "stairs", "greenhouse", "furnace", "still", "orrery", "bench", "grinder"];
      for (const id of order) {
        const idx = SPRITES.findIndex((q) => q.id === id), sp = SPRITES[idx];
        const r = L.reveal[idx];
        spriteDraw(sp, r, [(1 - r) * sp.from[0], (1 - r) * sp.from[1]]);
        // things that move, drawn right after their piece so they sit in the right layer
        if (r <= 0.01) continue;
        if (id === "oculus") {
          g.save(); g.beginPath(); g.arc(470, 122, 90, 0, TAU); g.clip(); g.globalAlpha = r;
          const ag = g.createLinearGradient(380, 40, 560, 200); ag.addColorStop(0, "#1a0e48"); ag.addColorStop(0.5, "#0e3a58"); ag.addColorStop(1, "#2a1a58"); g.fillStyle = ag; g.fillRect(370, 30, 200, 200);
          g.globalCompositeOperation = "lighter";
          for (let k = 0; k < 3; k++) { const gx = 400 + k * 60 + Math.sin(t * 0.4 + k) * 20; const ga = g.createLinearGradient(gx, 40, gx + 30, 200); ga.addColorStop(0, "rgba(90,255,200,0)"); ga.addColorStop(0.5, `rgba(${k ? 160 : 90},${k === 1 ? 120 : 255},${k === 1 ? 255 : 200},0.18)`); ga.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = ga; g.beginPath(); g.moveTo(gx, 30); g.quadraticCurveTo(gx + 40, 110, gx + 10, 200); g.lineTo(gx + 50, 200); g.quadraticCurveTo(gx + 80, 110, gx + 40, 30); g.fill(); }
          g.globalCompositeOperation = "source-over";
          for (let i = 0; i < 40; i++) { const a = hash(i) * TAU + t * 0.02, d = 14 + hash(i + 3) * 84; g.fillStyle = `rgba(255,255,255,${0.4 + 0.5 * Math.abs(Math.sin(t + i))})`; g.fillRect(470 + Math.cos(a) * d, 122 + Math.sin(a) * d, 1.8, 1.8); }
          g.restore(); g.globalAlpha = 1;
        }
        if (id === "orrery") {
          g.save(); g.globalAlpha = r; g.translate(325, 380);
          g.fillStyle = "#e8c860"; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); glow(0, 0, 30, "#ffd870", 0.3);
          for (let k = 0; k < 3; k++) {
            const rx = 36 + k * 22, ry = 11 + k * 7, a = t * (0.6 - k * 0.15) + k * 2;
            g.strokeStyle = "#b8903a"; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, 0, rx, ry, -0.2, 0, TAU); g.stroke();
            g.fillStyle = ["#6ab0e8", "#e8786a", "#a8e8a0"][k]; g.beginPath(); g.arc(Math.cos(a) * rx, Math.sin(a) * ry, 5 - k, 0, TAU); g.fill();
          }
          g.restore(); g.globalAlpha = 1;
        }
        if (id === "greenhouse") {
          g.save(); g.globalAlpha = r;
          for (let i = 0; i < 4; i++) {
            const bx = 330 + 26 + i * 48 + 17, by = 70 + 324, h = (60 + i * 26) * r, sway = red ? 0 : Math.sin(t * 0.9 + i * 1.3) * 5;
            g.strokeStyle = "#3a6a3a"; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sway * 0.5, by - h * 0.5, bx + sway, by - h); g.stroke();
            for (let k = 1; k <= 4; k++) { const ly = by - (h * k) / 4.4, lx = bx + sway * (k / 4.4), dir = k % 2 ? 1 : -1; g.fillStyle = mix("#3d7a3d", "#7ab85a", hash(i * 9 + k)); g.beginPath(); g.ellipse(lx + dir * 11, ly, 12, 5, dir * 0.6 + sway * 0.02, 0, TAU); g.fill(); }
            if (i % 2 === 0) { g.fillStyle = ["#e8708a", "#e8d070"][i / 2]; g.beginPath(); g.arc(bx + sway, by - h - 4, 6, 0, TAU); g.fill(); glow(bx + sway, by - h - 4, 22, ["#e8708a", "#e8d070"][i / 2], 0.18); }
          }
          g.restore(); g.globalAlpha = 1;
        }
        if (id === "still") {
          g.save(); g.globalAlpha = r;
          for (const [fx, fy, fc] of [[750, 380, "#6ad8a8"], [782, 400, "#c86ad8"]] as [number, number, string][]) {
            glow(fx, fy + 16, 40, fc, 0.14);
            if (!red) for (let k = 0; k < 4; k++) { const ph = (t * 0.5 + k * 0.27 + fx * 0.01) % 1; g.fillStyle = rgba("#ffffff", 0.5 * (1 - ph)); g.beginPath(); g.arc(fx + Math.sin(ph * 9 + k) * 8, fy + 26 - ph * 36, 2.2 + ph * 2, 0, TAU); g.fill(); }
          }
          const dp = (t * 0.8) % 1; g.fillStyle = "rgba(180,235,220,0.8)"; g.beginPath(); g.ellipse(744, 360 + dp * 20, 2, 3.4, 0, 0, TAU); g.fill();
          g.strokeStyle = "#2a1a10"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(620, 360); g.lineTo(620 + Math.cos(-2.2 + Math.sin(t * 0.8) * 0.5) * 10, 360 + Math.sin(-2.2 + Math.sin(t * 0.8) * 0.5) * 10); g.stroke();
          g.restore(); g.globalAlpha = 1;
        }
        if (id === "furnace") {
          const fl = r * (0.7 + 0.3 * L.heat + L.flare * 0.8 + L.flash * 0.3);
          const cx = 889, cy = 430;
          glow(cx, cy - 20, 300 * (0.8 + fl * 0.4), "#ff8a3a", 0.32 * fl * (red ? 0.9 : 0.85 + 0.15 * Math.sin(t * 9)));
          g.save(); g.beginPath(); g.moveTo(836, 452); g.lineTo(836, 350 + 10); g.quadraticCurveTo(cx, 300 + 10, 942, 360); g.lineTo(942, 452); g.closePath(); g.clip();
          g.fillStyle = "#2a0a06"; g.fillRect(830, 340, 120, 120);
          for (let k = 0; k < 7; k++) {
            const fx = 846 + k * 14, wob = red ? 0 : Math.sin(t * (5 + k) + k * 2) * 5, h = (42 + hash(k) * 36 + L.heat * 28 + L.flare * 30) * r * (red ? 0.8 : 0.85 + 0.15 * Math.sin(t * 8 + k));
            const fg = g.createLinearGradient(0, 452, 0, 452 - h); fg.addColorStop(0, "#ffd870"); fg.addColorStop(0.45, "#ff8a2a"); fg.addColorStop(1, "rgba(200,40,10,0)");
            g.fillStyle = fg; g.beginPath(); g.moveTo(fx - 9, 452); g.quadraticCurveTo(fx - 6 + wob, 452 - h * 0.6, fx + wob, 452 - h); g.quadraticCurveTo(fx + 6 + wob, 452 - h * 0.6, fx + 9, 452); g.fill();
          }
          g.fillStyle = "#4a1a0a"; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(850 + k * 20, 448, 12, 5, 0, 0, TAU); g.fill(); }
          g.restore();
          if (!red && Math.random() < 0.16 * fl) burst("spark", 880 + Math.random() * 40, 440, 1, "#ffb050", 60);
          if (!red && Math.random() < 0.05 * fl) burst("smoke", 959, 160, 1, "#8a7a82", 20);
        }
        if (id === "bench") {
          const flick = red ? 1 : 0.8 + 0.2 * Math.sin(t * 11) + 0.08 * Math.sin(t * 23);
          glow(128, 436, 150, "#ffb860", 0.2 * flick);
          g.fillStyle = "#ffd890"; g.beginPath(); g.ellipse(128, 440 - 3 * flick, 3.4, 7 * flick, 0, 0, TAU); g.fill();
          g.fillStyle = "#fff6d0"; g.beginPath(); g.ellipse(128, 442 - 2 * flick, 1.6, 3.4, 0, 0, TAU); g.fill();
          if (L.frost > 0.05) { g.fillStyle = `rgba(190,230,255,${0.1 * L.frost})`; g.fillRect(0, 470, LW, 40); if (!red && Math.random() < 0.3 * L.frost) burst("frost", Math.random() * LW, 480 + Math.random() * 30, 1, "#cfeaff", 12); }
        }
        if (id === "drawer") {
          g.save(); g.globalAlpha = r; g.globalCompositeOperation = "lighter";
          const gx = 490, gy = 572;
          for (let k = 0; k < 5; k++) { const a = -1.9 + k * 0.45 + Math.sin(t * 0.6 + k) * 0.06; g.fillStyle = "rgba(190,150,255,0.07)"; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(a) * 380 - 14, gy + Math.sin(a) * 380); g.lineTo(gx + Math.cos(a) * 380 + 14, gy + Math.sin(a) * 380); g.closePath(); g.fill(); }
          glow(gx, gy, 90, "#b890ff", 0.25 + 0.1 * Math.sin(t * 2)); g.restore(); g.globalAlpha = 1;
        }
        if (id === "stairs") {
          g.save(); g.globalAlpha = r;
          // a few things that ought not to float
          for (let k = 0; k < 3; k++) {
            const fx = 640 + k * 130, fy = 190 + Math.sin(t * 0.7 + k * 2) * 12 + k * 14;
            g.save(); g.translate(fx, fy); g.rotate(Math.sin(t * 0.5 + k) * 0.3); g.fillStyle = ["#7a3a5a", "#3a5a7a", "#5a7a3a"][k]; g.fillRect(-12, -9, 24, 18); g.fillStyle = "#f0e6c8"; g.fillRect(-10, -7, 20, 3); g.strokeStyle = "rgba(10,6,14,0.7)"; g.lineWidth = 1.6; g.strokeRect(-12, -9, 24, 18); g.restore();
          }
          g.globalCompositeOperation = "lighter"; g.strokeStyle = `rgba(180,130,255,${0.35 + 0.2 * Math.sin(t * 1.3)})`; g.lineWidth = 2;
          for (const [x0, y0] of [[520, 300], [600, 220]] as [number, number][]) { g.beginPath(); g.moveTo(x0, y0); for (let i = 1; i < 6; i++) g.lineTo(x0 + (hash(i + x0) - 0.4) * 26, y0 - i * 24); g.stroke(); }
          g.restore(); g.globalAlpha = 1;
        }
      }

      /* the shelf of jars — one for everything the player has found */
      const jarsList = P.jars.slice(-22);
      for (let i = 0; i < jarsList.length; i++) {
        const jx = 560 + (i % 11) * 32, jy = 258;
        const lastOne = i === jarsList.length - 1;
        const pop = lastOne ? L.jarPop : 1;
        g.save(); g.translate(jx, jy); g.scale(pop, pop);
        g.fillStyle = "rgba(210,230,240,0.2)"; g.fillRect(-9, -26, 18, 26); g.fillStyle = jarsList[i]; g.globalAlpha = 0.85; g.fillRect(-8, -18, 16, 17); g.globalAlpha = 1;
        g.fillStyle = "#8a6a4a"; g.fillRect(-7, -30, 14, 5); g.strokeStyle = "rgba(10,6,14,0.7)"; g.lineWidth = 1.4; g.strokeRect(-9, -26, 18, 26);
        g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(-6, -22, 2, 14);
        if (lastOne && L.flash > 0.05) glow(0, -12, 34, jarsList[i], 0.5 * L.flash);
        g.restore();
      }

      /* particles */
      for (const q of L.parts) {
        q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.kind === "smoke") { q.vy -= 8 * dt; q.size += dt * 3; }
        else if (q.kind === "dust") q.vy += 40 * dt;
        else if (q.kind === "spark") q.vy += 40 * dt;
        const k = Math.max(0, q.life / q.max);
        g.globalAlpha = Math.min(1, k * (q.kind === "smoke" ? 0.35 : 1));
        g.fillStyle = q.color;
        if (q.kind === "spark") { g.globalCompositeOperation = "lighter"; }
        g.beginPath(); g.arc(q.x, q.y, q.size * (q.kind === "smoke" ? 1 : Math.max(0.4, k)), 0, TAU); g.fill();
        g.globalCompositeOperation = "source-over";
      }
      g.globalAlpha = 1;
      L.parts = L.parts.filter((q) => q.life > 0);
      // drifting dust in the moonlight
      if (!red) { g.fillStyle = "rgba(210,220,255,0.35)"; for (let i = 0; i < 22; i++) { const px = 160 + ((hash(i) * 260 + t * (4 + hash(i + 2) * 5)) % 260), py = 210 + hash(i + 4) * 240 + Math.sin(t * 0.4 + i) * 8; g.fillRect(px + (py - 210) * 0.4, py, 1.4, 1.4); } }
      // a flash of light when something new is made
      if (L.flash > 0.01) { g.fillStyle = `rgba(255,236,200,${0.1 * L.flash})`; g.fillRect(-50, -50, LW + 100, LH + 100); }
      void cw; void ch;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.clearTimeout(rebuildTimer); api.current = null; };
  }, []);

  /* ---------- the lab grows when you reach a new stage (GSAP) ---------- */
  useEffect(() => {
    const L = lab.current;
    if (stage === L.prevStage) return;
    const up = stage > L.prevStage;
    L.prevStage = stage;
    SPRITES.forEach((sp, i) => {
      if (sp.stage > stage) { gsap.to(L.reveal, { [i]: 0, duration: 0.4 }); return; }
      if (reduced || !up) { L.reveal[i] = 1; return; }
      if (L.reveal[i] < 1) {
        gsap.to(L.reveal, { [i]: 1, duration: 2.2, ease: "power3.out", delay: 0.35 });
        window.setTimeout(() => api.current?.burst("dust", sp.x + sp.w / 2, sp.y + sp.h / 2, 26, "#e8d8b0", 140), 500);
      }
    });
    if (up && !reduced) {
      gsap.fromTo(L, { shake: 7, flash: 1 }, { shake: 0, flash: 0, duration: 1.6, ease: "power2.out" });
    }
  }, [stage, reduced]);

  /* ---------- reactions ---------- */
  useEffect(() => {
    if (!event) return;
    const L = lab.current;
    const b = api.current?.burst;
    if (event.kind === "new" || event.kind === "known") {
      if (event.kind === "new") {
        gsap.killTweensOf(L, "jarPop,flash");
        gsap.fromTo(L, { jarPop: 0.2, flash: 1 }, { jarPop: 1, flash: 0, duration: 1.1, ease: "back.out(2.4)" });
      } else gsap.fromTo(L, { flash: 0.5 }, { flash: 0, duration: 0.7 });
      b?.("spark", 520, 380, 14, "#ffe9a8", 150);
    } else if (event.kind === "fizzle") b?.("smoke", 500, 400, 8, "#6a5a70", 40);
    else if (event.kind === "heat") gsap.fromTo(L, { flare: 1 }, { flare: 0, duration: 1.3, ease: "power2.out" });
    else if (event.kind === "grind" && stage >= 2) b?.("dust", 160, 500, 22, "#d8ccb0", 90);
    else if (event.kind === "cool") b?.("frost", 500, 440, 18, "#cfeaff", 70);
  }, [event, stage]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export { rng };
