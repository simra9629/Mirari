/**
 * Bug Hotel — presentation layer (canvas).
 *
 * Reads the world; never changes it. An illustrated natural-history cutaway of
 * an old tree, viewed at miniature scale.
 */
import { CH, CHAMBERS, SP, WORLD_H, WORLD_W, doorPoint, type ChamberId, type ItemKind, type SpeciesId } from "./data";
import { clock, snapPoint, type Creature, type Item, type World } from "./engine";

export interface Cam { cx: number; cy: number; z: number; base: number; cw: number; ch: number; dpr: number }
export interface DrawOpts {
  t: number; reduced: boolean; contrast: boolean;
  selCh: ChamberId | null; hoverCh: ChamberId | null;
  ghost: { kind: ItemKind; x: number; y: number; ch: ChamberId | null } | null;
}

export function screenToWorld(cam: Cam, sx: number, sy: number) {
  const s = cam.base * cam.z;
  return { x: (sx - cam.cw / 2) / s + cam.cx, y: (sy - cam.ch / 2) / s + cam.cy };
}
export function baseScale(cw: number, ch: number) {
  return Math.min(cw / WORLD_W, ch / WORLD_H) * 0.98;
}

/* ---- colour helpers ---- */
function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixc(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
const rgba = (h: string, a: number) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const SKY: { f: number; top: string; bot: string }[] = [
  { f: 0, top: "#3a4a78", bot: "#e8a67a" }, { f: 0.12, top: "#7c9ccd", bot: "#f5d3a5" },
  { f: 0.3, top: "#6aa6c8", bot: "#cfe6d2" }, { f: 0.5, top: "#6aa6c8", bot: "#dfe6c4" },
  { f: 0.62, top: "#55507f", bot: "#e89a62" }, { f: 0.72, top: "#1d2547", bot: "#7a4f6e" },
  { f: 0.82, top: "#0b1128", bot: "#1b2547" }, { f: 0.95, top: "#0b1128", bot: "#232e55" },
  { f: 1, top: "#3a4a78", bot: "#e8a67a" },
];
function skyAt(f: number) {
  for (let i = 1; i < SKY.length; i++) {
    if (f <= SKY[i].f) {
      const a = SKY[i - 1], b = SKY[i], k = (f - a.f) / (b.f - a.f);
      return { top: mixc(a.top, b.top, k), bot: mixc(a.bot, b.bot, k) };
    }
  }
  return { top: SKY[0].top, bot: SKY[0].bot };
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ------------------------------------------------------------------ */
/* The tree (drawn once)                                               */
/* ------------------------------------------------------------------ */

let treeSprite: HTMLCanvasElement | null = null;
function getTree(): HTMLCanvasElement {
  if (treeSprite) return treeSprite;
  const S = 2;
  const cv = document.createElement("canvas");
  cv.width = WORLD_W * S; cv.height = WORLD_H * S;
  const g = cv.getContext("2d")!;
  g.scale(S, S);
  // crown
  for (let i = 0; i < 26; i++) {
    const x = 150 + hash(i) * 660, y = 20 + hash(i + 40) * 90, r = 38 + hash(i + 80) * 44;
    g.fillStyle = mixc("#1a3324", "#3c6b3f", hash(i + 120));
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  // branches
  g.strokeStyle = "#2b1d13"; g.lineCap = "round";
  for (const [x0, y0, x1, y1, lw] of [[250, 120, 150, 60, 16], [710, 120, 820, 50, 16], [250, 170, 170, 150, 10], [710, 180, 800, 160, 10]] as number[][]) {
    g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, y0 - 20, x1, y1); g.stroke();
  }
  // roots
  g.fillStyle = "#22160e";
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      const bx = sx < 0 ? 270 + k * 30 : 690 - k * 30;
      g.moveTo(bx - 30, 640); g.quadraticCurveTo(bx + sx * (60 + k * 40), 690, bx + sx * (140 + k * 60), 712 + k * 2);
      g.quadraticCurveTo(bx + sx * (70 + k * 30), 700, bx + 30, 650); g.fill();
    }
  }
  // trunk
  const trunk = new Path2D();
  trunk.moveTo(222, 40); trunk.quadraticCurveTo(205, 220, 205, 400); trunk.quadraticCurveTo(200, 560, 178, 690);
  trunk.lineTo(782, 690); trunk.quadraticCurveTo(760, 560, 755, 400); trunk.quadraticCurveTo(755, 220, 738, 40); trunk.closePath();
  const grad = g.createLinearGradient(190, 0, 770, 0);
  grad.addColorStop(0, "#23170f"); grad.addColorStop(0.2, "#3b281a"); grad.addColorStop(0.5, "#33220f"); grad.addColorStop(0.8, "#3b281a"); grad.addColorStop(1, "#201409");
  g.fillStyle = grad; g.fill(trunk);
  g.save(); g.clip(trunk);
  for (let i = 0; i < 260; i++) {
    const x = 190 + hash(i) * 600, y = hash(i + 9) * 720, l = 20 + hash(i + 3) * 70;
    g.strokeStyle = hash(i + 5) > 0.5 ? "rgba(12,7,3,0.35)" : "rgba(140,100,60,0.12)";
    g.lineWidth = 0.8 + hash(i + 7) * 1.6;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 4, y + l * 0.3, x - 4, y + l * 0.7, x + 2, y + l); g.stroke();
  }
  g.restore();
  g.strokeStyle = "rgba(10,6,3,0.7)"; g.lineWidth = 3; g.stroke(trunk);
  treeSprite = cv;
  return cv;
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

function drawItem(g: CanvasRenderingContext2D, it: Item, t: number, reduced: boolean, dark: number) {
  const k = it.kind, s = it.seed;
  const sway = reduced ? 0 : Math.sin(t * 1.3 + s * 6) * 1.6;
  g.save();
  g.translate(it.x, it.y);
  switch (k) {
    case "bark":
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i === 1 ? "#7a5636" : "#5c3f27";
        g.beginPath(); g.ellipse(-8 + i * 8, -6 + (i % 2) * 2, 9, 5, -0.5 + i * 0.4, 0, 6.3); g.fill();
        g.strokeStyle = "rgba(20,10,4,0.5)"; g.lineWidth = 0.8; g.stroke();
      }
      break;
    case "twigs": {
      g.strokeStyle = "#6a4b30"; g.lineCap = "round"; g.lineWidth = 2.2;
      const dir = s > 0.5 ? 1 : -1;
      g.beginPath(); g.moveTo(0, 6); g.lineTo(dir * 18, -26); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(dir * 9, -10); g.lineTo(dir * -4, -22); g.moveTo(dir * 14, -20); g.lineTo(dir * 26, -26); g.stroke();
      break;
    }
    case "leaves": {
      const a = it.amount;
      g.strokeStyle = "#3d6a37"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(sway, -8, sway * 1.5, -18); g.stroke();
      for (let i = 0; i < 4; i++) {
        const ang = -1.2 + i * 0.8 + sway * 0.05;
        g.fillStyle = mixc("#3d6a37", "#7fb35c", (0.3 + 0.7 * a) * (0.5 + 0.5 * hash(s * 9 + i)));
        g.save(); g.translate(sway * (0.4 + i * 0.3), -4 - i * 4); g.rotate(ang);
        g.beginPath(); g.ellipse(9, 0, 10, 4.5, 0, 0, 6.3); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, 0); g.lineTo(18, 0); g.stroke();
        g.restore();
      }
      break;
    }
    case "stones":
      for (let i = 0; i < 3; i++) {
        g.fillStyle = mixc("#5b606a", "#8a8f99", hash(s * 7 + i));
        g.beginPath(); g.ellipse(-9 + i * 9, -4 - (i === 1 ? 4 : 0), 8 - i, 6 - (i === 2 ? 1 : 0), 0, 0, 6.3); g.fill();
        g.fillStyle = "rgba(255,255,255,0.15)"; g.beginPath(); g.ellipse(-11 + i * 9, -7 - (i === 1 ? 4 : 0), 3, 2, 0, 0, 6.3); g.fill();
      }
      break;
    case "soil":
      g.fillStyle = "#2c1d14"; g.beginPath(); g.moveTo(-18, 4); g.quadraticCurveTo(0, -18, 18, 4); g.closePath(); g.fill();
      g.fillStyle = "#4a3324";
      for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(-10 + hash(s * 5 + i) * 20, -2 - hash(s * 3 + i) * 6, 1.1, 0, 6.3); g.fill(); }
      break;
    case "moss": case "livingmoss": {
      const living = k === "livingmoss";
      if (living) {
        const gl = g.createRadialGradient(0, -4, 2, 0, -4, 38);
        gl.addColorStop(0, "rgba(120,255,214,0.35)"); gl.addColorStop(1, "rgba(120,255,214,0)");
        g.fillStyle = gl; g.fillRect(-40, -44, 80, 80);
      }
      for (let i = 0; i < 9; i++) {
        g.fillStyle = living ? mixc("#2fb38f", "#9affdc", hash(s + i)) : mixc("#3f7a3a", "#79b45a", hash(s * 3 + i));
        g.beginPath(); g.arc(-14 + i * 3.5, -3 - Math.sin(i * 1.7) * 3, 4.5 + hash(i + s) * 2.5, 0, 6.3); g.fill();
      }
      break;
    }
    case "hollowwood": case "deadwood": {
      const dead = k === "deadwood";
      g.fillStyle = dead ? "#6a5a48" : "#5b3d25"; rr(g, -22, -14, 44, 18, 8); g.fill();
      g.fillStyle = dead ? "#3a2f24" : "#1c1008"; g.beginPath(); g.ellipse(-20, -5, 5, 8, 0, 0, 6.3); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-10, -12); g.lineTo(14, -10); g.moveTo(-6, 0); g.lineTo(18, -2); g.stroke();
      if (dead) { g.fillStyle = "rgba(200,180,150,0.55)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-8 + i * 5, -10 + hash(s + i) * 10, 1, 0, 6.3); g.fill(); } }
      break;
    }
    case "seeds":
      g.fillStyle = "#c9a96a";
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(-8 + hash(s + i) * 16, -2 - hash(s * 2 + i) * 4, 2.6, 1.6, hash(i) * 3, 0, 6.3); g.fill(); }
      break;
    case "flower": case "paleflower": {
      const pale = k === "paleflower";
      const open = 0.35 + 0.65 * it.amount;
      const h = 26 + s * 6;
      g.strokeStyle = "#3d6a37"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(sway, -h / 2, sway * 1.4, -h); g.stroke();
      g.fillStyle = "#4f8a47"; g.beginPath(); g.ellipse(-4 + sway * 0.3, -h * 0.35, 5, 2, -0.6, 0, 6.3); g.fill();
      g.translate(sway * 1.4, -h);
      if (pale) { const gl = g.createRadialGradient(0, 0, 1, 0, 0, 22); gl.addColorStop(0, "rgba(200,225,255,0.4)"); gl.addColorStop(1, "rgba(200,225,255,0)"); g.fillStyle = gl; g.fillRect(-24, -24, 48, 48); }
      const pc = pale ? "#e8f1ff" : mixc("#e86a8a", "#f0b840", hash(s * 11));
      for (let i = 0; i < 6; i++) {
        g.fillStyle = pc; g.save(); g.rotate((i / 6) * 6.283 + (it.amount < 0.3 ? 0.2 : 0)); g.beginPath(); g.ellipse(0, -5 * open - 1, 2.6 * open + 0.6, 5.5 * open + 1, 0, 0, 6.3); g.fill(); g.restore();
      }
      g.fillStyle = pale ? "#aac8ff" : "#6a3b12"; g.beginPath(); g.arc(0, 0, 2.2, 0, 6.3); g.fill();
      break;
    }
    case "fruit": {
      const rot = Math.min(1, it.age / 2);
      g.fillStyle = mixc("#d9462f", "#4a2a1a", rot * 0.8); g.beginPath(); g.arc(0, -6, 8 * (0.5 + 0.5 * it.amount), 0, 6.3); g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.arc(-3, -9, 2.2, 0, 6.3); g.fill();
      g.strokeStyle = "#3d6a37"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -13); g.lineTo(2, -17); g.stroke();
      break;
    }
    case "nectar":
      g.fillStyle = "#5a9a4a"; g.beginPath(); g.ellipse(0, -3, 11, 5, 0, 0, Math.PI); g.fill();
      g.fillStyle = "#f2b43a"; g.beginPath(); g.ellipse(0, -4, 6 * it.amount + 1, 2.5, 0, 0, 6.3); g.fill();
      g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.arc(-2, -5, 1, 0, 6.3); g.fill();
      break;
    case "fungi":
      for (let i = 0; i < 3; i++) {
        const x = -8 + i * 8, h = 7 + hash(s + i) * 7;
        g.fillStyle = "#e6dcc4"; g.fillRect(x - 1.2, -h, 2.4, h);
        g.fillStyle = i === 1 ? "#d9884a" : "#f0e9d6"; g.beginPath(); g.ellipse(x, -h, 5.5, 3.2, 0, Math.PI, 0); g.fill();
      }
      break;
    case "water": {
      const wdt = 12 + 14 * it.amount;
      const gr = g.createLinearGradient(0, -8, 0, 4); gr.addColorStop(0, "#5aa0d0"); gr.addColorStop(1, "#245a86");
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, -2, wdt, 6, 0, 0, 6.3); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 0.8;
      const rip = reduced ? 0.4 : (t * 0.5 + s) % 1;
      g.beginPath(); g.ellipse(0, -2, wdt * (0.3 + 0.6 * rip), 6 * (0.3 + 0.6 * rip), 0, 0, 6.3); g.globalAlpha = 1 - rip; g.stroke(); g.globalAlpha = 1;
      break;
    }
    case "shade":
      g.strokeStyle = "rgba(30,60,35,0.7)"; g.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const x = -16 + i * 8, len = 10 + hash(s + i) * 14;
        g.beginPath(); g.moveTo(x, -80); g.lineTo(x + sway * 0.3, -80 + len); g.stroke();
        g.fillStyle = "rgba(34,78,44,0.78)"; g.beginPath(); g.ellipse(x + sway * 0.3, -80 + len, 6, 3.2, 0.3, 0, 6.3); g.fill();
      }
      g.translate(0, 0);
      break;
    case "moisture":
      for (let i = 0; i < 5; i++) {
        const ph = reduced ? 0 : t * 0.3 + i * 1.3;
        g.fillStyle = "rgba(210,230,255,0.13)"; g.beginPath(); g.arc(Math.sin(ph + i) * 14, -Math.cos(ph * 0.8 + i) * 8, 8 + i * 1.5, 0, 6.3); g.fill();
      }
      break;
    case "warm": case "cool": {
      const warm = k === "warm";
      g.fillStyle = warm ? "#a85a35" : "#6f8aa0"; g.beginPath(); g.ellipse(0, -5, 14, 8, 0, 0, 6.3); g.fill();
      const gl = g.createRadialGradient(0, -5, 2, 0, -5, 26);
      gl.addColorStop(0, warm ? "rgba(255,150,70,0.4)" : "rgba(150,210,255,0.3)"); gl.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gl; g.fillRect(-30, -34, 60, 60);
      break;
    }
    case "light": {
      g.strokeStyle = "#241a12"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -80); g.lineTo(0, -8); g.stroke();
      const fl = reduced ? 1 : 0.9 + 0.1 * Math.sin(t * 5 + s * 9);
      g.fillStyle = "#4a3a22"; rr(g, -4, -12, 8, 6, 2); g.fill();
      g.fillStyle = `rgba(255,220,130,${fl})`; g.beginPath(); g.arc(0, -4, 4, 0, 6.3); g.fill();
      break;
    }
  }
  void dark;
  g.restore();
}

function drawGlows(g: CanvasRenderingContext2D, w: World, ch: ChamberId, t: number, dark: number, reduced: boolean) {
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const it of w.items) {
    if (it.ch !== ch) continue;
    if (it.kind === "light") {
      const gl = g.createRadialGradient(it.x, it.y - 4, 2, it.x, it.y - 4, 62);
      gl.addColorStop(0, `rgba(255,205,110,${0.12 + 0.35 * dark})`); gl.addColorStop(1, "rgba(255,205,110,0)");
      g.fillStyle = gl; g.fillRect(it.x - 64, it.y - 68, 128, 128);
    } else if (it.kind === "livingmoss") {
      const gl = g.createRadialGradient(it.x, it.y - 4, 2, it.x, it.y - 4, 34);
      gl.addColorStop(0, `rgba(120,255,214,${0.1 + 0.2 * dark})`); gl.addColorStop(1, "rgba(120,255,214,0)");
      g.fillStyle = gl; g.fillRect(it.x - 36, it.y - 40, 72, 72);
    }
  }
  void t; void reduced;
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Creatures                                                           */
/* ------------------------------------------------------------------ */

type DrawFn = (g: CanvasRenderingContext2D, c: Creature, s: number, t: number) => void;

const ell = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string) => {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.3); g.fill();
};
function legs(g: CanvasRenderingContext2D, n: number, len: number, span: number, col: string, t: number, moving: boolean, lw = 0.8) {
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * i) / Math.max(1, n - 1);
    const sw = moving ? Math.sin(t * 14 + i * 1.7) * len * 0.35 : 0;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, len); g.moveTo(x, 0); g.lineTo(x - sw, -len); g.stroke();
  }
}
const ICON = -99;
const flap = (c: Creature, t: number, f = 16) => (c.id === ICON ? 0.95 : c.mode === "wait" || c.pause > 0.2 ? 0.25 + 0.1 * Math.sin(t * 2 + c.wob) : Math.sin(t * f + c.wob * 3));
const moving = (c: Creature) => c.mode !== "wait" && c.pause <= 0 && c.mode !== "caught";

function wingPair(g: CanvasRenderingContext2D, s: number, f: number, c1: string, c2: string, big: number, small: number) {
  for (const sd of [-1, 1]) {
    g.save(); g.scale(1, sd * (0.35 + 0.65 * Math.abs(f)));
    g.fillStyle = c1; g.beginPath(); g.ellipse(-s * 0.1, s * 0.9, s * big, s * big * 0.7, -0.5, 0, 6.3); g.fill();
    g.fillStyle = c2; g.beginPath(); g.ellipse(-s * 0.6, s * 0.7, s * small, s * small * 0.65, 0.2, 0, 6.3); g.fill();
    g.restore();
  }
}

const DRAW: Record<SpeciesId, DrawFn> = {
  ant: (g, c, s, t) => { const m = moving(c); legs(g, 3, s * 0.9, s * 0.8, "#1a120c", t, m); ell(g, -s * 0.8, 0, s * 0.6, s * 0.5, "#2b2118"); ell(g, 0, 0, s * 0.35, s * 0.3, "#3b2d20"); ell(g, s * 0.7, 0, s * 0.45, s * 0.4, "#2b2118"); if (c.carrying) ell(g, s * 1.3, -s * 0.2, s * 0.35, s * 0.3, "#e8d9a8"); },
  beetle: (g, c, s, t) => { legs(g, 3, s * 0.8, s * 1.0, "#10121c", t, moving(c), 1); ell(g, -s * 0.1, 0, s * 1.05, s * 0.72, "#1c1f2e"); ell(g, s * 0.95, 0, s * 0.4, s * 0.38, "#232842"); g.strokeStyle = "rgba(120,150,220,0.5)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s * 0.7, 0); g.stroke(); ell(g, -s * 0.3, -s * 0.28, s * 0.35, s * 0.15, "rgba(255,255,255,0.18)"); },
  woodlouse: (g, c, s, t) => { legs(g, 5, s * 0.7, s * 1.5, "#44474f", t, moving(c)); for (let i = 0; i < 5; i++) ell(g, -s * 0.8 + i * s * 0.42, 0, s * 0.42, s * (0.7 - Math.abs(i - 2) * 0.08), i % 2 ? "#6d7078" : "#868a94"); ell(g, s * 1.2, 0, s * 0.3, s * 0.4, "#555963"); },
  snail: (g, c, s, t) => { const w = Math.sin(t * 1.5 + c.wob) * 0.1; g.fillStyle = "#c8c0a8"; g.beginPath(); g.ellipse(0, s * 0.25, s * 1.3, s * 0.38 + w, 0, 0, 6.3); g.fill(); ell(g, s * 1.1, s * 0.1, s * 0.4, s * 0.38, "#d6cfb8"); g.strokeStyle = "#8f8a76"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(s * 1.25, -s * 0.1); g.lineTo(s * 1.5, -s * 0.7); g.moveTo(s * 1.1, -s * 0.1); g.lineTo(s * 1.15, -s * 0.8); g.stroke(); ell(g, -s * 0.1, -s * 0.5, s * 0.95, s * 0.95, "#8a6a48"); g.strokeStyle = "#c9a77a"; g.lineWidth = 0.9; g.beginPath(); g.arc(-s * 0.1, -s * 0.5, s * 0.55, 0.3, 5.3); g.stroke(); g.beginPath(); g.arc(-s * 0.1, -s * 0.5, s * 0.25, 0.3, 5.3); g.stroke(); },
  ladybird: (g, c, s, t) => { legs(g, 3, s * 0.8, s * 0.9, "#111", t, moving(c)); ell(g, 0, 0, s * 0.95, s * 0.8, "#c8331f"); ell(g, s * 0.85, 0, s * 0.38, s * 0.4, "#141414"); g.strokeStyle = "#141414"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-s * 0.9, 0); g.lineTo(s * 0.7, 0); g.stroke(); g.fillStyle = "#141414"; for (const [x, y] of [[-0.4, -0.35], [-0.4, 0.35], [0.15, -0.38], [0.15, 0.38]]) { g.beginPath(); g.arc(x * s, y * s, s * 0.14, 0, 6.3); g.fill(); } },
  caterpillar: (g, c, s, t) => { for (let i = 0; i < 6; i++) { const y = Math.sin(t * 6 * (moving(c) ? 1 : 0.2) + i * 0.9) * s * 0.16; ell(g, -s * 1.5 + i * s * 0.62, y, s * 0.42, s * 0.4, i % 2 ? "#9bc25a" : "#b3d672"); } ell(g, s * 2.2, 0, s * 0.4, s * 0.38, "#6f9a3a"); },
  butterfly: (g, c, s, t) => { const f = flap(c, t, 14); wingPair(g, s, f, mixc(SP.butterfly.color, "#7a1e12", 0.2), SP.butterfly.color2, 1.15, 0.75); g.fillStyle = "rgba(255,255,255,0.7)"; for (const sd of [-1, 1]) { g.beginPath(); g.arc(s * 0.1, sd * s * 1.25 * (0.35 + 0.65 * Math.abs(f)), s * 0.14, 0, 6.3); g.fill(); } ell(g, 0, 0, s * 0.8, s * 0.2, "#2a1a12"); ell(g, s * 0.8, 0, s * 0.2, s * 0.2, "#2a1a12"); },
  moth: (g, c, s, t) => { const f = flap(c, t, 20); wingPair(g, s, f, "#a08a6c", "#cbb99a", 1.0, 0.7); ell(g, 0, 0, s * 0.8, s * 0.25, "#6e5c46"); ell(g, s * 0.8, 0, s * 0.22, s * 0.22, "#6e5c46"); g.strokeStyle = "#6e5c46"; g.lineWidth = 0.6; g.beginPath(); g.moveTo(s, -s * 0.1); g.lineTo(s * 1.5, -s * 0.5); g.moveTo(s, s * 0.1); g.lineTo(s * 1.5, s * 0.5); g.stroke(); },
  grasshopper: (g, c, s, t) => { void t; const lift = c.lift > 1; g.strokeStyle = "#5c7a2c"; g.lineWidth = s * 0.14; g.beginPath(); g.moveTo(-s * 0.2, 0); g.lineTo(-s * 0.9, lift ? s * 0.2 : s * 0.7); g.lineTo(-s * 1.5, lift ? -s * 0.2 : s * 0.8); g.stroke(); ell(g, 0, 0, s * 1.3, s * 0.38, "#7fa13b"); ell(g, s * 1.2, -s * 0.05, s * 0.4, s * 0.34, "#92b84a"); g.strokeStyle = "#5c7a2c"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(s * 1.4, -s * 0.2); g.lineTo(s * 2, -s * 0.8); g.stroke(); g.fillStyle = "rgba(200,220,120,0.5)"; g.beginPath(); g.ellipse(-s * 0.2, -s * 0.25, s * 1.0, s * 0.22, 0, 0, 6.3); g.fill(); },
  bee: (g, c, s, t) => { const f = Math.sin(t * 60 + c.wob) * 0.5 + 0.5; g.fillStyle = "rgba(220,235,255,0.55)"; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(-s * 0.1, sd * s * (0.6 + 0.5 * f), s * 0.8, s * 0.38, sd * -0.5, 0, 6.3); g.fill(); } ell(g, 0, 0, s * 1.0, s * 0.72, "#e0a720"); g.fillStyle = "#2a2218"; for (const x of [-0.45, 0.05, 0.5]) g.fillRect(x * s - s * 0.1, -s * 0.7, s * 0.22, s * 1.4); ell(g, s * 1.0, 0, s * 0.38, s * 0.36, "#2a2218"); if (c.carrying) ell(g, -s * 0.2, s * 0.75, s * 0.28, s * 0.22, "#f7d86a"); },
  dragonfly: (g, c, s, t) => { const f = Math.sin(t * 40 + c.wob) * 0.4 + 0.6; g.fillStyle = "rgba(190,230,245,0.5)"; for (const sd of [-1, 1]) for (const x of [0.4, 0]) { g.beginPath(); g.ellipse(s * x, sd * s * 1.3 * f, s * 0.95, s * 0.22, sd * 0.25, 0, 6.3); g.fill(); } g.strokeStyle = "#2f7fb8"; g.lineWidth = s * 0.2; g.lineCap = "round"; g.beginPath(); g.moveTo(-s * 2.2, 0); g.lineTo(s * 0.5, 0); g.stroke(); ell(g, s * 0.7, 0, s * 0.55, s * 0.45, "#2f7fb8"); ell(g, s * 1.15, -s * 0.1, s * 0.34, s * 0.34, "#9ee0f0"); },
  earwig: (g, c, s, t) => { legs(g, 3, s * 0.8, s * 1.1, "#3c2212", t, moving(c)); ell(g, 0, 0, s * 1.3, s * 0.45, "#6a3a22"); ell(g, s * 1.3, 0, s * 0.35, s * 0.32, "#8a4a2a"); g.strokeStyle = "#2c180c"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-s * 1.3, 0); g.quadraticCurveTo(-s * 1.9, -s * 0.5, -s * 1.7, -s * 0.8); g.moveTo(-s * 1.3, 0); g.quadraticCurveTo(-s * 1.9, s * 0.5, -s * 1.7, s * 0.8); g.stroke(); },
  orbspider: (g, c, s, t) => { legs(g, 4, s * 1.5, s * 0.9, "#4a3720", t, moving(c), 0.9); ell(g, -s * 0.5, 0, s * 0.85, s * 0.72, "#7a5a32"); g.fillStyle = "#e8d3a2"; g.beginPath(); g.arc(-s * 0.55, 0, s * 0.15, 0, 6.3); g.arc(-s * 0.2, s * 0.2, s * 0.1, 0, 6.3); g.arc(-s * 0.2, -s * 0.2, s * 0.1, 0, 6.3); g.fill(); ell(g, s * 0.5, 0, s * 0.45, s * 0.38, "#5a4122"); },
  mantis: (g, c, s, t) => { void t; g.strokeStyle = "#5a8a3a"; g.lineWidth = s * 0.1; g.beginPath(); for (const x of [-0.3, 0, 0.3]) { g.moveTo(x * s, 0); g.lineTo(x * s - s * 0.3, s * 0.6); g.moveTo(x * s, 0); g.lineTo(x * s - s * 0.3, -s * 0.6); } g.stroke(); ell(g, -s * 0.3, 0, s * 1.5, s * 0.22, "#6fa04a"); ell(g, s * 0.9, 0, s * 0.8, s * 0.17, "#7fb356"); g.strokeStyle = "#6fa04a"; g.lineWidth = s * 0.14; const hit = c.mode === "hunt" ? 0.9 : 0.2; g.beginPath(); g.moveTo(s * 1.0, s * 0.1); g.lineTo(s * 1.5, s * 0.5 - hit * s * 0.4); g.lineTo(s * 2.0 * (0.8 + hit * 0.4), s * 0.1); g.moveTo(s * 1.0, -s * 0.1); g.lineTo(s * 1.5, -s * 0.5 + hit * s * 0.4); g.lineTo(s * 2.0 * (0.8 + hit * 0.4), -s * 0.1); g.stroke(); g.fillStyle = "#8ec468"; g.beginPath(); g.moveTo(s * 1.7, 0); g.lineTo(s * 2.2, -s * 0.4); g.lineTo(s * 2.2, s * 0.4); g.closePath(); g.fill(); },
  stag: (g, c, s, t) => { legs(g, 3, s * 0.7, s * 1.3, "#1c0e08", t, moving(c), 1.2); ell(g, -s * 0.2, 0, s * 1.15, s * 0.78, "#3a1f14"); ell(g, s * 0.95, 0, s * 0.5, s * 0.45, "#4a2818"); g.strokeStyle = "#7a3e22"; g.lineWidth = s * 0.13; g.lineCap = "round"; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.2, sd * s * 0.2); g.quadraticCurveTo(s * 1.9, sd * s * 0.9, s * 2.2, sd * s * 0.2); g.moveTo(s * 1.9, sd * s * 0.6); g.lineTo(s * 1.9, sd * s * 0.2); g.stroke(); } ell(g, -s * 0.3, -s * 0.25, s * 0.45, s * 0.16, "rgba(255,255,255,0.13)"); },
  jewelspider: (g, c, s, t) => { legs(g, 4, s * 1.4, s * 0.8, "#3a2410", t, moving(c), 0.9); ell(g, -s * 0.4, 0, s * 1.1, s * 0.95, "#c93a74"); g.fillStyle = "#f4d03f"; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; g.beginPath(); g.moveTo(-s * 0.4 + Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.8); g.lineTo(-s * 0.4 + Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.35); g.lineTo(-s * 0.4 + Math.cos(a + 0.35) * s * 0.9, Math.sin(a + 0.35) * s * 0.8); g.fill(); } g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.arc(-s * 0.55, -s * 0.25, s * 0.22, 0, 6.3); g.fill(); ell(g, s * 0.7, 0, s * 0.38, s * 0.34, "#3a2410"); },
  glowworm: (g, c, s, t) => { const night = c.dormant ? 0.3 : 1; for (let i = 0; i < 5; i++) ell(g, -s * 1.1 + i * s * 0.55, Math.sin(t * 2 + i) * s * 0.06, s * 0.36, s * 0.36, i === 0 ? "#b8ff7a" : "#4a5530"); const gl = g.createRadialGradient(-s * 1.2, 0, 1, -s * 1.2, 0, s * 4.5); gl.addColorStop(0, `rgba(184,255,122,${0.7 * night})`); gl.addColorStop(1, "rgba(184,255,122,0)"); if (c.id !== ICON) { g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gl; g.fillRect(-s * 6, -s * 5, s * 10, s * 10); g.restore(); } },
  veilmoth: (g, c, s, t) => { const f = flap(c, t, 10); g.globalAlpha *= 0.85; wingPair(g, s, f, "rgba(225,220,205,0.9)", "rgba(190,180,160,0.85)", 1.15, 0.8); ell(g, 0, 0, s * 0.8, s * 0.26, "#8d8470"); ell(g, s * 0.8, 0, s * 0.24, s * 0.24, "#8d8470"); },
  goldbeetle: (g, c, s, t) => { legs(g, 3, s * 0.8, s, "#7a5a10", t, moving(c), 1); const gr = g.createLinearGradient(0, -s, 0, s); gr.addColorStop(0, "#fff0a0"); gr.addColorStop(0.5, "#e6b422"); gr.addColorStop(1, "#a87a0a"); g.fillStyle = gr; g.beginPath(); g.ellipse(-s * 0.1, 0, s * 1.05, s * 0.78, 0, 0, 6.3); g.fill(); ell(g, s * 0.95, 0, s * 0.4, s * 0.38, "#c8961a"); ell(g, -s * 0.3, -s * 0.3, s * 0.4, s * 0.15, "rgba(255,255,255,0.55)"); const sp = 0.5 + 0.5 * Math.sin(t * 3 + c.wob); g.fillStyle = `rgba(255,250,200,${0.4 * sp})`; g.beginPath(); g.arc(s * 0.3, -s * 0.3, s * 0.2, 0, 6.3); g.fill(); },
  moonmoth: (g, c, s, t) => { const f = flap(c, t, 6); if (c.id !== ICON) { g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(0, 0, 1, 0, 0, s * 3.2); gl.addColorStop(0, "rgba(190,210,255,0.4)"); gl.addColorStop(1, "rgba(190,210,255,0)"); g.fillStyle = gl; g.fillRect(-s * 4, -s * 4, s * 8, s * 8); g.restore(); } wingPair(g, s, f, "rgba(225,235,255,0.92)", "rgba(180,200,255,0.9)", 1.2, 0.95); g.strokeStyle = "rgba(120,150,230,0.7)"; g.lineWidth = 0.7; for (const sd of [-1, 1]) { g.beginPath(); g.arc(-s * 0.1, sd * s * 1.1 * (0.35 + 0.65 * Math.abs(f)), s * 0.28, 0, 6.3); g.stroke(); } ell(g, 0, 0, s * 0.75, s * 0.22, "#c9d6ff"); ell(g, s * 0.75, 0, s * 0.22, s * 0.22, "#c9d6ff"); },
  glassbeetle: (g, c, s, t) => { legs(g, 3, s * 0.8, s, "rgba(190,230,240,0.8)", t, moving(c), 1); g.fillStyle = "rgba(168,224,232,0.35)"; g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 1; g.beginPath(); g.ellipse(-s * 0.1, 0, s * 1.05, s * 0.78, 0, 0, 6.3); g.fill(); g.stroke(); g.beginPath(); g.ellipse(s * 0.95, 0, s * 0.4, s * 0.38, 0, 0, 6.3); g.fill(); g.stroke(); g.strokeStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.moveTo(-s * 0.8, -s * 0.4); g.quadraticCurveTo(0, -s * 0.8, s * 0.6, -s * 0.3); g.stroke(); },
  clockwork: (g, c, s, t) => { const run = c.mode !== "wait"; legs(g, 3, s * 0.7, s * 1.0, "#6a5230", t, run, 1); ell(g, 0, 0, s * 1.05, s * 0.75, "#b08d57"); g.strokeStyle = "#6a5230"; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 0, s * 1.05, s * 0.75, 0, 0, 6.3); g.stroke(); g.save(); g.rotate(run ? t * 3 : t * 0.2); g.strokeStyle = "#e8d3a2"; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.rotate(1.0472); g.beginPath(); g.moveTo(s * 0.18, 0); g.lineTo(s * 0.55, 0); g.stroke(); } g.beginPath(); g.arc(0, 0, s * 0.4, 0, 6.3); g.stroke(); g.restore(); ell(g, s * 1.0, 0, s * 0.35, s * 0.32, "#8a6c3e"); g.save(); g.translate(-s * 0.9, 0); g.rotate(run ? t * 2 : 0); g.strokeStyle = "#e8d3a2"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s * 0.5); g.lineTo(0, s * 0.5); g.stroke(); g.restore(); },
  starbeetle: (g, c, s, t) => { legs(g, 3, s * 0.8, s * 1.0, "#0c1030", t, moving(c), 1); ell(g, -s * 0.1, 0, s * 1.1, s * 0.78, "#1a2250"); ell(g, s * 1.0, 0, s * 0.42, s * 0.38, "#232d66"); for (let i = 0; i < 9; i++) { const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.9); g.fillStyle = `rgba(255,244,184,${0.4 + 0.6 * tw})`; g.beginPath(); g.arc(-s * 0.9 + hash(i + c.id) * s * 1.6, (hash(i * 3 + c.id) - 0.5) * s * 1.2, s * 0.09 + tw * s * 0.05, 0, 6.3); g.fill(); } },
  wisp: (g, c, s, t) => { const p = 0.7 + 0.3 * Math.sin(t * 2 + c.wob); if (c.id === ICON) { ell(g, 0, 0, s * 1.1, s * 1.1, "rgba(120,230,210,0.5)"); ell(g, 0, 0, s * 0.55, s * 0.55, "#2a9d8a"); return; } g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(0, 0, 0.5, 0, 0, s * 5 * p); gl.addColorStop(0, "rgba(180,255,240,0.95)"); gl.addColorStop(0.3, "rgba(120,255,230,0.35)"); gl.addColorStop(1, "rgba(120,255,230,0)"); g.fillStyle = gl; g.fillRect(-s * 6, -s * 6, s * 12, s * 12); g.restore(); ell(g, 0, 0, s * 0.45, s * 0.45, "#ffffff"); },
  pocketwhale: (g, c, s, t) => { g.globalAlpha *= 0.7; const sw = Math.sin(t * 1.2 + c.wob) * 0.3; g.fillStyle = "#4d6fa0"; g.beginPath(); g.moveTo(s * 1.8, 0); g.bezierCurveTo(s * 1.4, -s * 0.9, -s * 0.8, -s * 0.9, -s * 1.3, -s * 0.1); g.lineTo(-s * 2.0, -s * 0.6 + sw * s); g.quadraticCurveTo(-s * 1.7, 0, -s * 2.0, s * 0.6 + sw * s); g.lineTo(-s * 1.3, s * 0.1); g.bezierCurveTo(-s * 0.8, s * 0.7, s * 1.4, s * 0.7, s * 1.8, 0); g.fill(); g.fillStyle = "#bcd4f2"; g.beginPath(); g.ellipse(s * 0.2, s * 0.35, s * 1.3, s * 0.22, 0, 0, Math.PI); g.fill(); g.fillStyle = "#0e1a30"; g.beginPath(); g.arc(s * 1.1, -s * 0.1, s * 0.1, 0, 6.3); g.fill(); if (c.id === ICON) return; g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(0, 0, 1, 0, 0, s * 3.5); gl.addColorStop(0, "rgba(160,200,255,0.25)"); gl.addColorStop(1, "rgba(160,200,255,0)"); g.fillStyle = gl; g.fillRect(-s * 4, -s * 4, s * 8, s * 8); g.restore(); },
};

function drawCreature(g: CanvasRenderingContext2D, c: Creature, t: number, o: DrawOpts, selected: boolean, dark: number) {
  const sp = SP[c.sp];
  let a = c.fade;
  if (c.hidden) a *= 0.32;
  else if (c.dormant && c.mode === "wait") a *= 0.8;
  if (a <= 0.01) return;
  const s = sp.size * 0.66 * (0.88 + 0.24 * c.variant) * (c.stage === "pupa" ? 1 : c.scale);
  g.save();
  g.globalAlpha = Math.min(1, a);
  g.translate(c.x, c.y - (c.lift > 0 ? c.lift : 0));
  // shadow for fliers
  if (sp.move === "flutter" || sp.move === "fly" || sp.move === "hover") {
    g.save(); g.globalAlpha *= 0.15; g.fillStyle = "#000"; g.beginPath(); g.ellipse(0, s * 3 + 6, s, s * 0.35, 0, 0, 6.3); g.fill(); g.restore();
  }
  if (c.stage === "pupa") {
    g.strokeStyle = "rgba(220,230,200,0.7)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -18); g.lineTo(0, -s * 1.5); g.stroke();
    g.fillStyle = "#7a9a4a"; g.beginPath(); g.moveTo(0, -s * 1.6); g.quadraticCurveTo(s * 1.0, 0, 0, s * 1.6); g.quadraticCurveTo(-s * 1.0, 0, 0, -s * 1.6); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.moveTo(-s * 0.5, -s * 0.2); g.lineTo(s * 0.5, -s * 0.2); g.moveTo(-s * 0.6, s * 0.3); g.lineTo(s * 0.6, s * 0.3); g.stroke();
  } else {
    g.rotate(c.heading);
    // keep creatures from being drawn upside-down: flip when facing left
    if (Math.cos(c.heading) < 0 && !(sp.move === "stalk")) { g.rotate(Math.PI); g.scale(-1, 1); }
    if (o.contrast) { g.shadowColor = "#ffffff"; g.shadowBlur = 3; }
    DRAW[c.sp](g, c, s, t);
    g.shadowBlur = 0;
  }
  g.restore();
  // hunger/caught indicators & selection
  if (selected) {
    g.save(); g.translate(c.x, c.y); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.2; g.setLineDash([3, 3]);
    g.lineDashOffset = o.reduced ? 0 : -t * 12; g.beginPath(); g.arc(0, 0, Math.max(12, s * 2.2 + 4), 0, 6.3); g.stroke(); g.restore();
  }
  if (o.contrast) {
    g.save(); g.translate(c.x, c.y - s * 2 - 8); g.font = "bold 9px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "#000"; g.fillStyle = "#fff"; g.strokeText(sp.glyph, 0, 0); g.fillText(sp.glyph, 0, 0); g.restore();
  }
  if (t - (c.born - 0) < 0) return;
  void dark;
}

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

export function draw(g: CanvasRenderingContext2D, w: World, cam: Cam, o: DrawOpts) {
  const { cw, ch, dpr } = cam;
  const { f, phase, sun } = clock(w.t);
  const t = o.t;
  const dark = 1 - sun;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* sky */
  const sky = skyAt(f);
  const sg = g.createLinearGradient(0, 0, 0, ch);
  sg.addColorStop(0, sky.top); sg.addColorStop(1, sky.bot);
  g.fillStyle = sg; g.fillRect(0, 0, cw, ch);
  const gloom = w.weather === "storm" ? 0.4 : w.weather === "rain" ? 0.22 : w.weather === "cold" ? 0.08 : 0;
  if (gloom) { g.fillStyle = `rgba(14,18,34,${gloom})`; g.fillRect(0, 0, cw, ch); }
  if (w.weather === "heat") { g.fillStyle = "rgba(255,170,80,0.07)"; g.fillRect(0, 0, cw, ch); }
  if (dark > 0.6) {
    const al = (dark - 0.6) / 0.4;
    g.fillStyle = "#fff";
    for (let i = 0; i < 70; i++) {
      const tw = o.reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t * (0.6 + hash(i) * 1.5) + i);
      g.globalAlpha = al * tw * (w.weather === "rain" || w.weather === "storm" ? 0.25 : 0.9);
      g.fillRect(hash(i + 1) * cw, hash(i + 2) * ch * 0.7, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    if (w.weather === "clear" || w.weather === "cold" || w.weather === "heat" || w.weather === "wind") {
      g.fillStyle = `rgba(235,240,255,${0.9 * al})`; g.beginPath(); g.arc(cw * 0.14, ch * 0.16, 22, 0, 6.3); g.fill();
      g.fillStyle = sky.top; g.beginPath(); g.arc(cw * 0.14 + 9, ch * 0.16 - 4, 19, 0, 6.3); g.fill();
    }
  }
  // clouds
  const cloudN = w.weather === "rain" || w.weather === "storm" ? 7 : w.weather === "clear" ? 2 : 4;
  g.fillStyle = `rgba(${dark > 0.5 ? "50,60,90" : "235,240,245"},${w.weather === "storm" ? 0.7 : 0.35})`;
  for (let i = 0; i < cloudN; i++) {
    const cx = ((hash(i + 3) * 1.4 + (o.reduced ? 0 : t * 0.004 * (1 + hash(i)))) % 1.3 - 0.15) * cw;
    const cy = ch * (0.05 + hash(i + 8) * 0.2);
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + k * 26, cy + Math.sin(k) * 5, 34, 14, 0, 0, 6.3); g.fill(); }
  }

  /* world transform */
  const s = cam.base * cam.z;
  g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (cw / 2 - cam.cx * s), dpr * (ch / 2 - cam.cy * s));

  // ground
  g.fillStyle = "#16100a"; g.fillRect(-2000, 686, 5000, 2000);
  g.fillStyle = "#24331f"; g.fillRect(-2000, 684, 5000, 6);
  g.drawImage(getTree(), 0, 0, WORLD_W, WORLD_H);

  // autumn falling leaves
  if (w.season === "autumn" && !o.reduced) {
    for (let i = 0; i < 14; i++) {
      const x = 170 + hash(i) * 620 + Math.sin(t * 0.7 + i) * 18, y = ((t * 18 + hash(i + 4) * 700) % 720);
      g.fillStyle = mixc("#c8742a", "#e0b040", hash(i + 9)); g.beginPath(); g.ellipse(x, y, 5, 2.5, t + i, 0, 6.3); g.fill();
    }
  }

  // connectors
  g.lineCap = "round";
  for (const a of CHAMBERS) {
    if (a.stage > w.stage) continue;
    for (const bId of a.adj) {
      const b = CH[bId];
      if (b.stage > w.stage || a.id > b.id) continue;
      const p = doorPoint(a.id, b.id), q = doorPoint(b.id, a.id);
      g.strokeStyle = "#1a110b"; g.lineWidth = 15; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      g.strokeStyle = mixc("#4a321f", "#8a6338", (w.cs[a.id].light + w.cs[b.id].light) * 0.5); g.lineWidth = 11; g.stroke();
    }
  }

  // chambers
  const sorted = [...CHAMBERS];
  for (const c of sorted) {
    if (c.stage > w.stage) {
      const next = c.stage === w.stage + 1;
      g.save();
      g.setLineDash([5, 6]); g.strokeStyle = `rgba(210,180,130,${next ? 0.22 + (o.reduced ? 0.06 : 0.07 * Math.sin(t * 1.5)) : 0.09})`; g.lineWidth = 1.2;
      rr(g, c.x, c.y, c.w, c.h, 16); g.stroke();
      if (next) { g.fillStyle = "rgba(210,180,130,0.18)"; g.font = "600 22px 'Space Grotesk', sans-serif"; g.textAlign = "center"; g.fillText("?", c.x + c.w / 2, c.y + c.h / 2 + 8); }
      g.restore();
      continue;
    }
    const cs = w.cs[c.id];
    g.save();
    rr(g, c.x, c.y, c.w, c.h, 16); g.clip();
    // wall
    const L = Math.pow(cs.light, 0.8);
    const top = mixc("#2a1e15", "#d6a766", L), bot = mixc("#1d140d", "#9c6e3c", L);
    const wg = g.createLinearGradient(0, c.y, 0, c.y + c.h);
    wg.addColorStop(0, top); wg.addColorStop(1, bot);
    g.fillStyle = wg; g.fillRect(c.x, c.y, c.w, c.h);
    // wall grain
    g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 1;
    for (let i = 0; i < Math.floor(c.w / 14); i++) { const x = c.x + 6 + i * 14 + hash(i + c.x) * 6; g.beginPath(); g.moveTo(x, c.y); g.lineTo(x + 3, c.y + c.h); g.stroke(); }
    if (c.open) { // open to the sky: a bright rim along the top
      const sg2 = g.createLinearGradient(0, c.y, 0, c.y + 30); sg2.addColorStop(0, rgba("#bfe0d8", 0.18 * sun)); sg2.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = sg2; g.fillRect(c.x, c.y, c.w, 30);
    }
    // damp tint
    if (cs.humid > 0.6) { g.fillStyle = `rgba(80,130,150,${(cs.humid - 0.6) * 0.25})`; g.fillRect(c.x, c.y, c.w, c.h); }
    // floor
    const fy = c.y + c.h * 0.78;
    const fg = g.createLinearGradient(0, fy, 0, c.y + c.h);
    fg.addColorStop(0, "rgba(30,20,12,0)"); fg.addColorStop(1, `rgba(30,20,12,${0.5 + 0.3 * dark})`);
    g.fillStyle = fg; g.fillRect(c.x, fy, c.w, c.y + c.h - fy);
    // light shafts in lit open chambers
    if (c.open && sun > 0.3 && w.weather !== "storm") {
      g.fillStyle = `rgba(255,236,170,${0.06 * sun})`;
      for (let i = 0; i < 3; i++) { const x = c.x + c.w * (0.2 + i * 0.3) + (o.reduced ? 0 : Math.sin(t * 0.2 + i) * 8); g.beginPath(); g.moveTo(x, c.y); g.lineTo(x + 26, c.y); g.lineTo(x + 60, c.y + c.h); g.lineTo(x + 10, c.y + c.h); g.fill(); }
    }
    // dust motes
    if (cs.light > 0.25 && !o.reduced) {
      g.fillStyle = `rgba(255,240,200,${0.4 * cs.light})`;
      for (let i = 0; i < 9; i++) { g.fillRect(c.x + ((hash(i + c.x) * c.w + t * 3 * (1 + hash(i))) % c.w), c.y + 12 + ((hash(i * 3 + c.y) * (c.h - 20) + Math.sin(t * 0.5 + i) * 6 + c.h) % (c.h - 20)), 1.3, 1.3); }
    }
    // items & webs & creatures (y-sorted)
    const items = w.items.filter((i) => i.ch === c.id).sort((a, b) => a.y - b.y);
    for (const it of items) if (it.kind === "shade") drawItem(g, it, t, o.reduced, dark);
    for (const wb of w.webs) {
      if (wb.ch !== c.id) continue;
      const b = wb.built;
      g.save(); g.strokeStyle = `rgba(240,245,255,${0.35 + 0.25 * (cs.wet > 0.2 ? 1 : 0)})`; g.lineWidth = 0.6;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; g.beginPath(); g.moveTo(wb.x, wb.y); g.lineTo(wb.x + Math.cos(a) * wb.r * b, wb.y + Math.sin(a) * wb.r * b * 0.9); g.stroke(); }
      for (let r = 0.25; r <= 1.01; r += 0.18) { if (r > b) break; g.beginPath(); for (let i = 0; i <= 10; i++) { const a = (i / 10) * 6.283; const px = wb.x + Math.cos(a) * wb.r * r, py = wb.y + Math.sin(a) * wb.r * r * 0.9; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
      if (cs.wet > 0.2 && b >= 1) { g.fillStyle = "rgba(255,255,255,0.8)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(wb.x + Math.cos(i * 0.8) * wb.r * (0.3 + 0.12 * i), wb.y + Math.sin(i * 0.8) * wb.r * (0.3 + 0.12 * i) * 0.9, 1, 0, 6.3); g.fill(); } }
      g.restore();
    }
    const here = w.creatures.filter((k) => k.ch === c.id && SP[k.sp].special !== "visitor");
    const drawables: { y: number; fn: () => void }[] = [];
    for (const it of items) if (it.kind !== "shade") drawables.push({ y: it.y, fn: () => drawItem(g, it, t, o.reduced, dark) });
    for (const k of here) drawables.push({ y: k.y, fn: () => drawCreature(g, k, t, o, w.selected === k.id, dark) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();
    drawGlows(g, w, c.id, t, dark, o.reduced);
    // rain falling into open chambers
    if (c.open && w.rain > 0.2 && !o.reduced) {
      g.strokeStyle = "rgba(190,215,240,0.35)"; g.lineWidth = 0.8;
      for (let i = 0; i < 12; i++) { const x = c.x + hash(i + c.x) * c.w, y = c.y + (((t * 160 + hash(i) * 300) % c.h)); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 7); g.stroke(); }
    }
    // placement ghost
    if (o.ghost && o.ghost.ch === c.id) {
      const p = snapPoint(o.ghost.kind, c.id, o.ghost.x, o.ghost.y);
      g.globalAlpha = 0.55;
      drawItem(g, { id: -1, kind: o.ghost.kind, ch: c.id, x: p.x, y: p.y, age: 0, amount: 1, store: 0, seed: 0.5 }, t, true, dark);
      g.globalAlpha = 1;
    }
    // night veil for unlit rooms
    g.fillStyle = `rgba(6,8,20,${Math.max(0, 0.34 * (1 - cs.light) - 0.1) * (c.open ? 1 : 0.5)})`;
    g.fillRect(c.x, c.y, c.w, c.h);
    g.restore();
    // edge
    const sel = o.selCh === c.id, hov = o.hoverCh === c.id;
    g.strokeStyle = sel ? "rgba(214,230,150,0.9)" : hov ? "rgba(214,230,150,0.45)" : "rgba(10,6,3,0.75)";
    g.lineWidth = sel ? 2.4 : 2; rr(g, c.x, c.y, c.w, c.h, 16); g.stroke();
    if (sel || hov) {
      g.fillStyle = "rgba(240,236,214,0.92)"; g.font = "600 9.5px 'IBM Plex Mono', monospace"; g.textAlign = "left";
      g.fillText(c.name.toUpperCase(), c.x + 12, c.y + 16);
    }
  }

  // visitors drift through everything
  for (const k of w.creatures) if (SP[k.sp].special === "visitor") drawCreature(g, k, t, o, w.selected === k.id, dark);

  // arrival glimmers
  for (const k of w.creatures) {
    const age = w.t - k.born;
    if (age >= 0 && age < 2.4 && !o.reduced) {
      g.strokeStyle = `rgba(255,248,200,${0.7 * (1 - age / 2.4)})`; g.lineWidth = 1.2; g.beginPath(); g.arc(k.x, k.y, 6 + age * 14, 0, 6.3); g.stroke();
    }
  }

  // weather over everything
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (w.rain > 0.15 && !o.reduced) {
    g.strokeStyle = `rgba(190,215,240,${0.3 * w.rain})`; g.lineWidth = 1;
    const n = Math.floor(90 * w.rain);
    for (let i = 0; i < n; i++) { const x = (hash(i) * cw * 1.2 + t * 60) % (cw * 1.2), y = (hash(i + 5) * ch + t * 520) % ch; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 16); g.stroke(); }
  }
  if (w.wind > 0.3 && !o.reduced) {
    g.strokeStyle = `rgba(230,240,230,${0.12 * w.wind})`; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const y = hash(i) * ch, x = (hash(i + 2) * cw + t * 260 * (0.5 + hash(i))) % (cw + 120) - 60; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 4, x + 40, y + 4, x + 70, y); g.stroke(); }
  }
  void phase;
}

/** A small silhouette/portrait of a species, for the field journal. */
export function drawIcon(g: CanvasRenderingContext2D, id: SpeciesId, px: number, known: boolean, t = 0) {
  const sp = SP[id];
  const fake = {
    id: ICON, sp: id, mode: "wait", pause: 1, wob: 0.3, lift: 0, carrying: "", dormant: false, hidden: false, fade: 1,
    stage: "adult", scale: 1, variant: 0.5, heading: 0, born: 0, hunger: 0, tCre: 0, caughtBy: 0,
  } as unknown as Creature;
  g.save();
  g.translate(px / 2, px / 2);
  const s = (px * 0.15) * (sp.size > 16 ? 0.7 : sp.size < 7 ? 1.25 : 1);
  DRAW[id](g, fake, s, t);
  if (!known) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(60,50,38,0.85)";
    g.fillRect(-px, -px, px * 2, px * 2);
  }
  g.restore();
}
