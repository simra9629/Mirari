/**
 * Little Alchemist — the lab, painted.
 *
 * Everything here is drawn procedurally onto canvases: hand-painted-feeling
 * stone, plaster and wood (mottled colour, brush strokes, soft grime), and one
 * sprite per lab stage. The sprites are painted once and composited every frame
 * by LabScene, which adds the moving parts (fire, bubbles, orrery…).
 */

export const LW = 1000, LH = 700;   // logical scene size
export const WALL_BOTTOM = 470;     // where the wall meets the bench/floor

type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export function rng(seed: number) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function hex(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a: string, b: string, t: number) { const A = hex(a), B = hex(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; }
export const rgba = (h: string, a: number) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d")!];
}

/** Soft mottling + tiny speckles + faint brush strokes, over whatever is already there. */
function paintTexture(g: G, w: number, h: number, r: () => number, strength = 1, dir = 0) {
  g.save();
  for (let i = 0; i < 40 * strength; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.55;
    gr.addColorStop(0, dark ? "rgba(0,0,0,0.10)" : "rgba(255,240,220,0.06)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < w * h / 160 * strength; i++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,245,230,0.05)"; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  g.lineCap = "round";
  for (let i = 0; i < 60 * strength; i++) {
    const x = r() * w, y = r() * h, l = 14 + r() * 50, a = dir + (r() - 0.5) * 0.5;
    g.strokeStyle = r() < 0.5 ? "rgba(0,0,0,0.045)" : "rgba(255,240,220,0.035)"; g.lineWidth = 1 + r() * 3;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.restore();
}

export function stoneTile(size: number, seed: number, base = "#443a4c", light = "#5a4e62"): HTMLCanvasElement {
  const [c, g] = canvas(size, size); const r = rng(seed);
  g.fillStyle = "#1c1620"; g.fillRect(0, 0, size, size);
  const rows = 4, rh = size / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 40;
    while (x < size) {
      const bw = 50 + r() * 60;
      const t = r();
      g.fillStyle = mix(base, light, t * 0.8);
      const inset = 2.5;
      g.beginPath();
      const x0 = x + inset, y0 = row * rh + inset, x1 = x + bw - inset, y1 = (row + 1) * rh - inset, rad = 6;
      g.moveTo(x0 + rad, y0); g.arcTo(x1, y0, x1, y1, rad); g.arcTo(x1, y1, x0, y1, rad); g.arcTo(x0, y1, x0, y0, rad); g.arcTo(x0, y0, x1, y0, rad); g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,240,230,0.07)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + 3, y0 + 1.5); g.lineTo(x1 - 6, y0 + 1.5); g.stroke();
      x += bw;
    }
  }
  paintTexture(g, size, size, r, 1.2, 0.1);
  return c;
}

export function woodTile(w: number, h: number, seed: number, base = "#5b3d28", light = "#7a5538", plankH = 46): HTMLCanvasElement {
  const [c, g] = canvas(w, h); const r = rng(seed);
  for (let y = 0, i = 0; y < h; y += plankH, i++) {
    g.fillStyle = mix(base, light, 0.15 + r() * 0.6);
    g.fillRect(0, y, w, plankH - 2);
    g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, y + plankH - 2, w, 2);
    g.strokeStyle = "rgba(20,10,4,0.28)"; g.lineWidth = 1;
    for (let k = 0; k < 9; k++) {
      const gy = y + 4 + r() * (plankH - 10), ph = r() * 6;
      g.beginPath(); for (let x = 0; x <= w; x += 20) g.lineTo(x, gy + Math.sin(x * 0.02 + ph) * 1.8); g.stroke();
    }
    if (r() < 0.5) { const kx = r() * w, ky = y + plankH / 2; g.strokeStyle = "rgba(20,10,4,0.35)"; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(kx, ky, 4 + k * 4, 2 + k * 1.6, 0, 0, TAU); g.stroke(); } }
    const seam = r() * w; g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(seam, y, 2, plankH - 2);
  }
  paintTexture(g, w, h, r, 1, 0);
  return c;
}

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

export interface Sprite { id: string; stage: number; x: number; y: number; w: number; h: number; from: [number, number]; draw: (g: G, r: () => number) => void }

const outline = (g: G, w = 2.5) => { g.strokeStyle = "rgba(10,6,14,0.7)"; g.lineWidth = w; g.stroke(); };
function rr(g: G, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shelfPlank(g: G, x: number, y: number, w: number) {
  const gr = g.createLinearGradient(0, y, 0, y + 14); gr.addColorStop(0, "#8a6240"); gr.addColorStop(1, "#4a3020");
  g.fillStyle = gr; rr(g, x, y, w, 14, 3); g.fill(); outline(g);
  g.fillStyle = "#3a2618"; g.beginPath(); g.moveTo(x + 24, y + 14); g.lineTo(x + 24, y + 38); g.lineTo(x + 40, y + 14); g.fill(); g.beginPath(); g.moveTo(x + w - 24, y + 14); g.lineTo(x + w - 24, y + 38); g.lineTo(x + w - 40, y + 14); g.fill();
}

export const SPRITES: Sprite[] = [
  /* ---- 0 · the workbench: shelves of books, hanging herbs, a map ---- */
  { id: "shelves", stage: 0, x: 540, y: 90, w: 440, h: 190, from: [0, 0], draw: (g, r) => {
    for (const sy of [70, 170]) {
      shelfPlank(g, 10, sy, 420);
      let x = 24;
      while (x < 400 && sy === 70) { const bw = 12 + r() * 14, bh = 34 + r() * 26; g.fillStyle = mix("#5a2e3a", "#2e4a5a", r()); rr(g, x, sy - bh, bw, bh, 2); g.fill(); outline(g, 1.6); g.fillStyle = "rgba(255,220,150,0.5)"; g.fillRect(x + 2, sy - bh + 8, bw - 4, 2); x += bw + 2; }
      if (sy === 70) { g.save(); g.translate(380, sy - 4); g.rotate(-0.4); g.fillStyle = "#6a2e3a"; rr(g, 0, -40, 14, 40, 2); g.fill(); outline(g, 1.6); g.restore(); }
    }
    g.fillStyle = "#8a7a5a"; g.beginPath(); g.moveTo(30, 0); g.lineTo(34, 40); g.lineTo(60, 36); g.lineTo(58, 2); g.closePath(); g.fill(); outline(g, 1.6);
  } },
  { id: "herbs", stage: 0, x: 430, y: 0, w: 120, h: 170, from: [0, -30], draw: (g, r) => {
    for (let k = 0; k < 3; k++) {
      const cx = 24 + k * 36; g.strokeStyle = "#5a4630"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, 40); g.stroke();
      for (let i = 0; i < 16; i++) { const a = -1.2 + r() * 2.4, l = 20 + r() * 50; g.strokeStyle = mix("#6a8a4a", "#a8b868", r()); g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx, 40); g.quadraticCurveTo(cx + Math.sin(a) * l * 0.4, 40 + l * 0.6, cx + Math.sin(a) * l * 0.8, 40 + Math.cos(a) * l); g.stroke(); }
      g.fillStyle = "#8a5a3a"; g.fillRect(cx - 5, 38, 10, 6);
    }
  } },
  { id: "bench", stage: 0, x: 0, y: 450, w: 1000, h: 250, from: [0, 0], draw: (g, r) => {
    // the bench top & a front rail, with a few resting tools
    const gr = g.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, "#7a5538"); gr.addColorStop(1, "#4a3020");
    g.fillStyle = gr; g.fillRect(0, 20, 1000, 40); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, 60, 1000, 190);
    g.strokeStyle = "rgba(255,230,200,0.18)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 21); g.lineTo(1000, 21); g.stroke();
    paintTexture(g, 1000, 60, r, 0.6, 0);
    // candle stub & tin
    g.fillStyle = "#c8b8a0"; rr(g, 120, -4, 16, 26, 3); g.fill(); outline(g, 1.6); g.fillStyle = "#7a6a58"; g.beginPath(); g.ellipse(128, 22, 22, 5, 0, 0, TAU); g.fill();
  } },
  /* ---- 1 · the furnace ---- */
  { id: "furnace", stage: 1, x: 770, y: 170, w: 230, h: 300, from: [60, 0], draw: (g, r) => {
    g.fillStyle = "#4a3a38"; g.fillRect(150, 0, 34, 80); outline(g);   // flue
    for (let i = 0; i < 5; i++) { g.fillStyle = mix("#6a4a44", "#8a5a4a", r()); g.fillRect(150, i * 16, 34, 14); }
    const x0 = 24, y0 = 70, w = 190, h = 220;
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, "#7a5248"); gr.addColorStop(1, "#4a3430");
    g.fillStyle = gr; rr(g, x0, y0, w, h, 10); g.fill(); outline(g, 3);
    for (let row = 0; row < 12; row++) for (let col = 0; col < 5; col++) { const bx = x0 + 4 + col * 38 + (row % 2) * 19, by = y0 + 6 + row * 18; if (bx < x0 + w - 6) { g.fillStyle = mix("#6a4640", "#9a6a58", r() * 0.8); g.fillRect(bx, by, 34, 14); } }
    g.fillStyle = "#14080a"; g.beginPath(); g.moveTo(x0 + 42, y0 + h - 8); g.lineTo(x0 + 42, y0 + 110); g.quadraticCurveTo(x0 + w / 2, y0 + 50, x0 + w - 42, y0 + 110); g.lineTo(x0 + w - 42, y0 + h - 8); g.closePath(); g.fill(); outline(g, 3);
    g.fillStyle = "#2a2226"; g.fillRect(x0 - 6, y0 + h - 10, w + 12, 14); outline(g, 2);
    g.strokeStyle = "#3a3236"; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 20, y0 + 40); g.lineTo(x0 + 20, y0 - 8); g.moveTo(x0 + 34, y0 + 40); g.lineTo(x0 + 34, y0 - 14); g.stroke();   // tongs
  } },
  /* ---- 2 · the grinding table ---- */
  { id: "grinder", stage: 2, x: 20, y: 440, w: 330, h: 200, from: [-60, 0], draw: (g, r) => {
    const gr = g.createLinearGradient(0, 60, 0, 130); gr.addColorStop(0, "#8a8490"); gr.addColorStop(1, "#4a4652");
    g.fillStyle = gr; rr(g, 8, 70, 314, 46, 10); g.fill(); outline(g, 3);
    g.fillStyle = "#3a3640"; g.fillRect(34, 114, 46, 80); g.fillRect(250, 114, 46, 80); outline(g, 2.5);
    paintTexture(g, 330, 200, r, 0.5, 0);
    g.fillStyle = "#6a6672"; g.beginPath(); g.ellipse(100, 68, 62, 14, 0, 0, TAU); g.fill(); outline(g, 2);   // mortar
    g.fillStyle = "#9a96a2"; g.beginPath(); g.ellipse(100, 62, 52, 10, 0, 0, TAU); g.fill();
    g.fillStyle = "#c8c0b0"; g.beginPath(); g.ellipse(100, 64, 38, 6, 0, 0, TAU); g.fill();
    g.strokeStyle = "#a89a7a"; g.lineWidth = 12; g.lineCap = "round"; g.beginPath(); g.moveTo(112, 62); g.lineTo(150, 6); g.stroke();   // pestle
    g.strokeStyle = "#6a5a42"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#7a7480"; g.beginPath(); g.arc(250, 38, 36, 0, TAU); g.fill(); outline(g, 3);   // millstone
    g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = 2; for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(250, 38); g.lineTo(250 + Math.cos(a * 1.05) * 32, 38 + Math.sin(a * 1.05) * 32); g.stroke(); }
    g.fillStyle = "#4a4652"; g.beginPath(); g.arc(250, 38, 7, 0, TAU); g.fill();
    for (let i = 0; i < 4; i++) { g.fillStyle = ["#c85a4a", "#7aa86a", "#c8a84a", "#6a7ac8"][i]; g.beginPath(); g.ellipse(180 + i * 12, 70 - (i % 2) * 2, 5, 3.4, 0, 0, TAU); g.fill(); }
  } },
  /* ---- 3 · the greenhouse ---- */
  { id: "greenhouse", stage: 3, x: 330, y: 70, w: 230, h: 380, from: [0, 30], draw: (g) => {
    g.fillStyle = "rgba(120,180,170,0.10)"; g.fillRect(14, 20, 202, 340);
    g.strokeStyle = "#3a5a52"; g.lineWidth = 7; g.strokeRect(14, 20, 202, 340);
    g.lineWidth = 4; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(14 + i * 67, 20); g.lineTo(14 + i * 67, 360); g.stroke(); }
    for (let j = 1; j < 4; j++) { g.beginPath(); g.moveTo(14, 20 + j * 85); g.lineTo(216, 20 + j * 85); g.stroke(); }
    g.fillStyle = "#2a4a42"; g.beginPath(); g.moveTo(8, 22); g.lineTo(115, -6); g.lineTo(222, 22); g.closePath(); g.fill(); outline(g, 3);
    g.fillStyle = "#4a3426"; g.fillRect(14, 346, 202, 18); outline(g, 2);
    for (let i = 0; i < 4; i++) { g.fillStyle = "#8a5a3a"; rr(g, 26 + i * 48, 322, 34, 26, 4); g.fill(); outline(g, 2); }
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 3; g.beginPath(); g.moveTo(34, 40); g.lineTo(60, 100); g.moveTo(100, 30); g.lineTo(122, 76); g.stroke();
  } },
  /* ---- 4 · the apparatus ---- */
  { id: "still", stage: 4, x: 590, y: 240, w: 220, h: 240, from: [0, 40], draw: (g) => {
    g.fillStyle = "#6a4a30"; rr(g, 0, 214, 220, 16, 4); g.fill(); outline(g);
    const cop = g.createLinearGradient(30, 0, 120, 0); cop.addColorStop(0, "#9a5a3a"); cop.addColorStop(0.5, "#e0905a"); cop.addColorStop(1, "#7a4228");
    g.fillStyle = cop; g.beginPath(); g.ellipse(70, 160, 56, 54, 0, 0, TAU); g.fill(); outline(g, 3);
    g.beginPath(); g.moveTo(44, 112); g.lineTo(56, 60); g.lineTo(84, 60); g.lineTo(96, 112); g.closePath(); g.fillStyle = cop; g.fill(); outline(g, 3);
    g.fillStyle = cop; g.beginPath(); g.ellipse(70, 56, 20, 12, 0, 0, TAU); g.fill(); outline(g, 3);
    g.strokeStyle = "#c8784a"; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(84, 50); g.quadraticCurveTo(140, 20, 154, 80); g.lineTo(154, 120); g.stroke();
    g.strokeStyle = "#7a4228"; g.lineWidth = 2.4; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(144, 78 + i * 9); g.lineTo(164, 82 + i * 9); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(48, 142, 10, 22, -0.4, 0, TAU); g.fill();
    for (const [fx, fy, fc] of [[160, 140, "#6ad8a8"], [192, 160, "#c86ad8"]] as [number, number, string][]) {
      g.fillStyle = "rgba(210,235,245,0.22)"; g.beginPath(); g.moveTo(fx - 7, fy - 40); g.lineTo(fx + 7, fy - 40); g.lineTo(fx + 7, fy - 22); g.quadraticCurveTo(fx + 26, fy - 4, fx + 22, fy + 26); g.lineTo(fx - 22, fy + 26); g.quadraticCurveTo(fx - 26, fy - 4, fx - 7, fy - 22); g.closePath(); g.fill(); outline(g, 2.2);
      g.fillStyle = fc; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(fx - 23, fy + 6); g.lineTo(fx + 23, fy + 6); g.lineTo(fx + 22, fy + 26); g.lineTo(fx - 22, fy + 26); g.fill(); g.globalAlpha = 1;
    }
    g.fillStyle = "#f0e0c0"; g.beginPath(); g.arc(30, 120, 14, 0, TAU); g.fill(); outline(g, 2); g.strokeStyle = "#2a1a10"; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const a = Math.PI * 0.8 + i * 0.3; g.beginPath(); g.moveTo(30 + Math.cos(a) * 10, 120 + Math.sin(a) * 10); g.lineTo(30 + Math.cos(a) * 13, 120 + Math.sin(a) * 13); g.stroke(); }
  } },
  /* ---- 5 · the astronomical wing ---- */
  { id: "oculus", stage: 5, x: 360, y: 12, w: 220, h: 220, from: [0, -50], draw: (g, r) => {
    void r;
    g.fillStyle = "#14122e"; g.beginPath(); g.arc(110, 110, 92, 0, TAU); g.fill();
    g.strokeStyle = "#8a6a3a"; g.lineWidth = 12; g.beginPath(); g.arc(110, 110, 98, 0, TAU); g.stroke(); outline(g, 2);
    g.strokeStyle = "#5a4020"; g.lineWidth = 3; g.beginPath(); g.arc(110, 110, 104, 0, TAU); g.stroke();
    g.strokeStyle = "#8a6a3a"; g.lineWidth = 5; g.beginPath(); g.moveTo(110, 12); g.lineTo(110, 208); g.moveTo(12, 110); g.lineTo(208, 110); g.stroke();
  } },
  { id: "orrery", stage: 5, x: 230, y: 300, w: 190, h: 190, from: [-40, 0], draw: (g) => {
    g.fillStyle = "#6a4a30"; g.beginPath(); g.ellipse(95, 176, 70, 12, 0, 0, TAU); g.fill(); outline(g);
    g.strokeStyle = "#a07a3a"; g.lineWidth = 6; g.beginPath(); g.moveTo(95, 176); g.lineTo(95, 80); g.stroke();
  } },
  { id: "chart", stage: 5, x: 40, y: 250, w: 150, h: 190, from: [-30, 0], draw: (g, r) => {
    g.fillStyle = "#d8c8a0"; g.beginPath(); g.moveTo(10, 10); g.lineTo(140, 6); g.lineTo(144, 176); g.lineTo(8, 180); g.closePath(); g.fill(); outline(g, 2);
    g.fillStyle = "#6a4a30"; g.fillRect(4, 4, 142, 8); g.fillRect(2, 172, 146, 8);
    g.strokeStyle = "#3a4a7a"; g.lineWidth = 1.4; g.beginPath(); g.arc(76, 92, 54, 0, TAU); g.stroke(); g.beginPath(); g.arc(76, 92, 34, 0, TAU); g.stroke();
    g.fillStyle = "#3a4a7a"; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(76 + (r() - 0.5) * 110, 92 + (r() - 0.5) * 110, 1.8, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(22, 140); g.lineTo(52, 120); g.lineTo(76, 134); g.lineTo(102, 96); g.lineTo(128, 108); g.stroke();
  } },
  /* ---- 6 · the impossible wing ---- */
  { id: "drawer", stage: 6, x: 380, y: 540, w: 220, h: 130, from: [0, 30], draw: (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 130); gr.addColorStop(0, "#8a6240"); gr.addColorStop(1, "#4a3020");
    g.fillStyle = gr; rr(g, 10, 20, 200, 90, 6); g.fill(); outline(g, 3);
    g.fillStyle = "#e8d8a0"; g.beginPath(); g.ellipse(110, 64, 14, 8, 0, 0, TAU); g.fill(); outline(g, 2);
    // the inside is bigger than the outside
    g.fillStyle = "#0e0a1e"; g.beginPath(); g.moveTo(20, 20); g.lineTo(200, 20); g.lineTo(150, -6); g.lineTo(70, -6); g.closePath(); g.fill(); outline(g, 2);
  } },
  { id: "stairs", stage: 6, x: 620, y: 4, w: 300, h: 90, from: [0, -40], draw: (g) => {
    // a staircase on the ceiling
    g.fillStyle = "#6a5a72"; for (let i = 0; i < 8; i++) { g.fillRect(10 + i * 34, 6 + i * 6, 34, 14); g.strokeStyle = "rgba(10,6,14,0.7)"; g.lineWidth = 2; g.strokeRect(10 + i * 34, 6 + i * 6, 34, 14); }
    g.fillStyle = "#3a2a48"; g.fillRect(8, 0, 280, 6);
    g.fillStyle = "#4a3a58"; rr(g, 256, 40, 34, 46, 3); g.fill(); outline(g, 2); g.fillStyle = "#e8d8a0"; g.beginPath(); g.arc(262, 66, 2.6, 0, TAU); g.fill();
  } },
];

/** Paint a sprite into its own canvas at the given pixel scale. */
export function renderSprite(s: Sprite, scale: number): HTMLCanvasElement {
  const pad = 16;
  const [c, g] = canvas((s.w + pad * 2) * scale, (s.h + pad * 2) * scale);
  g.scale(scale, scale); g.translate(pad, pad);
  s.draw(g, rng(s.id.length * 977 + s.stage * 31));
  return c;
}
export const SPRITE_PAD = 16;

/** The static room: stone wall, plaster stains, window, floor, vignette. */
export function renderRoom(cw: number, ch: number, dpr: number): HTMLCanvasElement {
  const [c, g] = canvas(cw * dpr, ch * dpr);
  const s = Math.max(cw / LW, ch / LH) * dpr;
  const ox = (cw * dpr - LW * s) / 2, oy = (ch * dpr - LH * s) / 2;
  g.save(); g.translate(ox, oy); g.scale(s, s);
  const wall = g.createPattern(stoneTile(256, 7), "repeat")!;
  g.fillStyle = wall; g.fillRect(-LW, -LH, LW * 3, WALL_BOTTOM + LH + 20);
  // plaster stains & damp
  const r = rng(42);
  for (let i = 0; i < 9; i++) { const x = r() * LW, y = r() * 360, rad = 50 + r() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(20,10,30,0.22)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 6; i++) { const x = r() * LW; g.fillStyle = "rgba(70,100,60,0.16)"; g.beginPath(); g.ellipse(x, WALL_BOTTOM - 4 - r() * 20, 30 + r() * 40, 12 + r() * 10, 0, 0, TAU); g.fill(); }
  // window with a stone surround (the glass itself is drawn live)
  g.fillStyle = "#171226"; g.beginPath(); g.moveTo(110, 260); g.lineTo(110, 110); g.quadraticCurveTo(205, 20, 300, 110); g.lineTo(300, 260); g.closePath(); g.fill();
  g.strokeStyle = "#6a5a62"; g.lineWidth = 16; g.stroke(); g.strokeStyle = "#2a2230"; g.lineWidth = 3; g.stroke();
  // floor
  g.fillStyle = g.createPattern(woodTile(256, 128, 11), "repeat")!; g.fillRect(-LW, WALL_BOTTOM + 40, LW * 3, 300);
  const fl = g.createLinearGradient(0, WALL_BOTTOM + 40, 0, LH); fl.addColorStop(0, "rgba(0,0,0,0.0)"); fl.addColorStop(1, "rgba(0,0,0,0.55)"); g.fillStyle = fl; g.fillRect(-LW, WALL_BOTTOM + 40, LW * 3, 300);
  g.fillStyle = "#3a2a22"; g.fillRect(-LW, WALL_BOTTOM + 20, LW * 3, 22);   // skirting
  g.restore();
  // vignette
  const v = g.createRadialGradient(cw * dpr / 2, ch * dpr * 0.45, Math.min(cw, ch) * dpr * 0.25, cw * dpr / 2, ch * dpr * 0.5, Math.max(cw, ch) * dpr * 0.78);
  v.addColorStop(0, "rgba(10,6,16,0)"); v.addColorStop(1, "rgba(10,6,16,0.72)");
  g.fillStyle = v; g.fillRect(0, 0, cw * dpr, ch * dpr);
  return c;
}
