/**
 * The Witch's Delivery Service — presentation layer (canvas).
 * A hand-painted-feeling town: strong silhouettes, soft atmospheric depth,
 * tiny animated details, magical lighting.
 */
import { CUSTOMER, GROUND, LANDMARKS, LOC, WORLD_W, districtAt, type Hat, type PkgId } from "./data";
import { flockPos, hazards, lightLevel, timeOfDay, upgradeLv, type Game } from "./engine";
import { SEA, RIVER, TUNNELS, terrainY, type Building } from "./world";

export interface DrawOpts { t: number; reduced: boolean; contrast: boolean; cw: number; ch: number; dpr: number }

type G2 = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
const shade = (h: string, k: number) => mix(h, k < 0 ? "#000000" : "#ffffff", Math.abs(k));
const rgba = (h: string, a: number) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

const SKY: { f: number; top: string; bot: string }[] = [
  { f: 0, top: "#0b1130", bot: "#222a5c" }, { f: 0.18, top: "#2a2f6e", bot: "#e8905a" },
  { f: 0.3, top: "#5d9ad4", bot: "#f6d9a8" }, { f: 0.5, top: "#4f8fd0", bot: "#bfe1f2" },
  { f: 0.68, top: "#5d6fb8", bot: "#f2b27a" }, { f: 0.78, top: "#3a2c6e", bot: "#c0587a" },
  { f: 0.88, top: "#0e1236", bot: "#2a2a60" }, { f: 1, top: "#0b1130", bot: "#222a5c" },
];
function skyAt(f: number) {
  for (let i = 1; i < SKY.length; i++) if (f <= SKY[i].f) {
    const a = SKY[i - 1], b = SKY[i], k = (f - a.f) / (b.f - a.f);
    return { top: mix(a.top, b.top, k), bot: mix(a.bot, b.bot, k) };
  }
  return { top: SKY[0].top, bot: SKY[0].bot };
}

function rr(g: G2, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const ell = (g: G2, x: number, y: number, rx: number, ry: number, col: string) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); };

/* ------------------------------------------------------------------ */
/* Package glyphs (also used for the delivery board icons)             */
/* ------------------------------------------------------------------ */

export function drawPackage(g: G2, id: PkgId, s: number, t: number, st: Record<string, number> = {}, night = 0) {
  const sw = Math.sin(t * 3) * 0.5;
  switch (id) {
    case "letter": g.fillStyle = "#f1e7cf"; rr(g, -s * 0.9, -s * 0.6, s * 1.8, s * 1.2, 2); g.fill(); g.strokeStyle = "#a89a78"; g.lineWidth = 1; g.stroke(); g.beginPath(); g.moveTo(-s * 0.9, -s * 0.6); g.lineTo(0, s * 0.1); g.lineTo(s * 0.9, -s * 0.6); g.stroke(); ell(g, 0, s * 0.05, s * 0.2, s * 0.2, "#c8402a"); break;
    case "book": g.fillStyle = "#7a4a3a"; rr(g, -s * 0.8, -s * 0.9, s * 1.6, s * 1.8, 2); g.fill(); g.fillStyle = "#e8d8b0"; g.fillRect(-s * 0.7, -s * 0.8, s * 1.4, s * 0.12); g.fillStyle = "#d9b36a"; g.fillRect(-s * 0.55, -s * 0.4, s * 1.1, s * 0.25); break;
    case "flowers": for (let i = 0; i < 5; i++) { g.strokeStyle = "#4f8a47"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, s * 0.8); g.lineTo((i - 2) * s * 0.28, -s * 0.2); g.stroke(); ell(g, (i - 2) * s * 0.3, -s * 0.35 - (i % 2) * s * 0.15 + (st.wilt ?? 0) * s * 0.3, s * 0.26, s * 0.26, ["#e8708a", "#f0b840", "#e8708a", "#c78af0", "#f0b840"][i]); } g.fillStyle = "#e8d8b0"; g.beginPath(); g.moveTo(-s * 0.5, s * 0.3); g.lineTo(s * 0.5, s * 0.3); g.lineTo(0, s); g.fill(); break;
    case "cake": { const up = (st.flip ?? 0) % 2 ? -1 : 1; g.save(); g.scale(1, up); const melt = st.melt ?? 0; g.fillStyle = "#f4d4d8"; rr(g, -s * 0.9, -s * 0.1, s * 1.8, s * 0.8 * (1 - melt * 0.4), 3); g.fill(); g.fillStyle = "#fff0f2"; rr(g, -s * 0.6, -s * 0.6, s * 1.2, s * 0.55, 3); g.fill(); ell(g, 0, -s * 0.75, s * 0.12, s * 0.12, "#d9302a"); if (melt > 0.3) { g.fillStyle = "#f4d4d8"; g.fillRect(-s * 0.5, s * 0.6, s * 0.18, s * 0.4 * melt); g.fillRect(s * 0.3, s * 0.6, s * 0.14, s * 0.5 * melt); } g.restore(); break; }
    case "clothes": g.fillStyle = "#6a5aa8"; g.beginPath(); g.moveTo(-s * 0.9, -s * 0.7); g.lineTo(s * 0.9, -s * 0.7); g.lineTo(s * 0.7, s * 0.8); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fill(); g.strokeStyle = "#a89ae0"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s * 0.7); g.lineTo(0, s * 0.8); g.stroke(); break;
    case "gift": g.fillStyle = "#d9584a"; rr(g, -s * 0.8, -s * 0.6, s * 1.6, s * 1.4, 2); g.fill(); g.fillStyle = "#f0d070"; g.fillRect(-s * 0.12, -s * 0.6, s * 0.24, s * 1.4); g.fillRect(-s * 0.8, s * 0.05, s * 1.6, s * 0.24); ell(g, -s * 0.22, -s * 0.72, s * 0.24, s * 0.16, "#f0d070"); ell(g, s * 0.22, -s * 0.72, s * 0.24, s * 0.16, "#f0d070"); break;
    case "potion": { g.fillStyle = "#cfe6dc"; g.beginPath(); g.moveTo(-s * 0.2, -s * 0.9); g.lineTo(s * 0.2, -s * 0.9); g.lineTo(s * 0.25, -s * 0.3); g.lineTo(s * 0.8, s * 0.7); g.lineTo(-s * 0.8, s * 0.7); g.lineTo(-s * 0.25, -s * 0.3); g.closePath(); g.fill(); g.fillStyle = "#7ad88a"; g.beginPath(); g.moveTo(-s * 0.6, s * 0.1); g.lineTo(s * 0.6, s * 0.1); g.lineTo(s * 0.8, s * 0.7); g.lineTo(-s * 0.8, s * 0.7); g.fill(); g.fillStyle = "#b08a5a"; g.fillRect(-s * 0.24, -s * 1.05, s * 0.48, s * 0.2); for (let i = 0; i < 3; i++) ell(g, Math.sin(t * 3 + i * 2) * s * 0.3, s * 0.35 - ((t * 0.7 + i * 0.33) % 1) * s * 0.7, s * 0.1, s * 0.1, "#d8ffe0"); break; }
    case "teapot": g.fillStyle = "#c8a05a"; g.beginPath(); g.ellipse(0, s * 0.1, s * 0.8, s * 0.65, 0, 0, TAU); g.fill(); ell(g, 0, -s * 0.6, s * 0.28, s * 0.14, "#a8803a"); g.strokeStyle = "#a8803a"; g.lineWidth = s * 0.18; g.beginPath(); g.arc(-s * 0.95, 0, s * 0.35, -1.2, 1.2); g.stroke(); g.beginPath(); g.moveTo(s * 0.7, -s * 0.1); g.quadraticCurveTo(s * 1.2, -s * 0.4, s * 1.1, -s * 0.8); g.stroke(); ell(g, -s * 0.3, -s * 0.1, s * 0.12, s * 0.16, "#2a1a10"); ell(g, s * 0.25, -s * 0.1, s * 0.12, s * 0.16, "#2a1a10"); if (st.sing !== 0) { g.strokeStyle = "#2a1a10"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, s * 0.25, s * 0.2, s * (0.1 + 0.1 * Math.abs(Math.sin(t * 6))), 0, 0, TAU); g.stroke(); } break;
    case "sleepcloud": { g.fillStyle = (st.awake ?? 0) ? "#9aa4bc" : "#dfe6f2"; for (const [x, y, r] of [[-0.5, 0.1, 0.5], [0.1, -0.15, 0.62], [0.65, 0.12, 0.45], [0.05, 0.25, 0.5]]) { g.beginPath(); g.arc(x * s, y * s, r * s, 0, TAU); g.fill(); } g.strokeStyle = "#5a6480"; g.lineWidth = 1.2; if (st.awake) { g.beginPath(); g.moveTo(-s * 0.35, s * 0.05); g.lineTo(-s * 0.1, s * 0.12); g.moveTo(s * 0.3, s * 0.12); g.lineTo(s * 0.05, s * 0.05); g.stroke(); } else { g.beginPath(); g.arc(-s * 0.22, s * 0.08, s * 0.1, 0.2, Math.PI - 0.2); g.arc(s * 0.22, s * 0.08, s * 0.1, 0.2, Math.PI - 0.2); g.stroke(); const z = (t * 0.6) % 1; g.fillStyle = `rgba(90,100,140,${1 - z})`; g.font = `${Math.round(s * 0.5)}px sans-serif`; g.fillText("z", s * 0.6, -s * 0.4 - z * s * 0.6); } break; }
    case "umbrella": if ((st.open ?? 0) > 0.5) { g.strokeStyle = "rgba(180,200,255,0.55)"; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.arc(0, -s * 0.2, s * 1.3, Math.PI, 0); g.stroke(); g.setLineDash([]); } else { g.fillStyle = "rgba(180,200,255,0.25)"; g.beginPath(); g.arc(0, 0, s * 0.18 + sw * 0.3, 0, TAU); g.fill(); } break;
    case "frogs": g.fillStyle = "#8a6a3a"; rr(g, -s * 0.9, -s * 0.5, s * 1.8, s * 1.3, 2); g.fill(); g.fillStyle = "#3a2a14"; for (let i = 0; i < 4; i++) g.fillRect(-s * 0.7 + i * s * 0.42, -s * 0.4, s * 0.14, s * 1.1); ell(g, -s * 0.2, -s * 0.5, s * 0.34, s * 0.26, "#6ab04a"); ell(g, -s * 0.34, -s * 0.72, s * 0.1, s * 0.1, "#fff"); ell(g, -s * 0.06, -s * 0.72, s * 0.1, s * 0.1, "#fff"); break;
    case "storm": g.fillStyle = "#4a4a5a"; rr(g, -s * 0.8, -s * 0.5, s * 1.6, s * 1.3, 3); g.fill(); g.fillStyle = "#6a7aa0"; for (const [x, y, r] of [[-0.35, -0.5, 0.38], [0.1, -0.7, 0.46], [0.5, -0.45, 0.34]]) { g.beginPath(); g.arc(x * s, y * s, r * s, 0, TAU); g.fill(); } g.strokeStyle = "#ffe98a"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -s * 0.2); g.lineTo(-s * 0.18, s * 0.2); g.lineTo(s * 0.1, s * 0.15); g.lineTo(-s * 0.1, s * 0.6); g.stroke(); break;
    case "egg": { const warm = st.warm ?? 0.5; g.fillStyle = mix("#7a5a8a", "#e0603a", clamp(warm)); g.beginPath(); g.ellipse(0, 0, s * 0.62, s * 0.85, 0, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.ellipse(-s * 0.2, -s * 0.25, s * 0.15, s * 0.3, 0.3, 0, TAU); g.fill(); g.fillStyle = "rgba(0,0,0,0.2)"; for (const [x, y] of [[0.2, 0.2], [-0.15, 0.4], [0.3, -0.2]]) { g.beginPath(); g.arc(x * s, y * s, s * 0.1, 0, TAU); g.fill(); } break; }
    case "moonlight": { const gl = 0.4 + 0.6 * night * (1 - (st.fade ?? 0)); g.save(); g.globalCompositeOperation = "lighter"; const gr = g.createRadialGradient(0, 0, 1, 0, 0, s * (2 + gl * 3)); gr.addColorStop(0, `rgba(190,215,255,${0.7 * gl})`); gr.addColorStop(1, "rgba(190,215,255,0)"); g.fillStyle = gr; g.fillRect(-s * 6, -s * 6, s * 12, s * 12); g.restore(); g.fillStyle = "#dbe8ff"; g.beginPath(); g.moveTo(-s * 0.18, -s * 0.9); g.lineTo(s * 0.18, -s * 0.9); g.lineTo(s * 0.22, -s * 0.3); g.lineTo(s * 0.6, s * 0.7); g.lineTo(-s * 0.6, s * 0.7); g.lineTo(-s * 0.22, -s * 0.3); g.closePath(); g.fill(); g.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * gl})`; g.beginPath(); g.arc(0, s * 0.2, s * 0.32, 0, TAU); g.fill(); g.fillStyle = "#b08a5a"; g.fillRect(-s * 0.2, -s * 1.05, s * 0.4, s * 0.2); break; }
    case "homesick": g.fillStyle = "#b88a5a"; rr(g, -s * 0.85, -s * 0.6, s * 1.7, s * 1.3, 3); g.fill(); g.strokeStyle = "#8a6a3a"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-s * 0.85, 0); g.lineTo(s * 0.85, 0); g.moveTo(0, -s * 0.6); g.lineTo(0, s * 0.7); g.stroke(); g.fillStyle = "#2a1a10"; g.beginPath(); g.arc(-s * 0.3, -s * 0.28, s * 0.09, 0, TAU); g.arc(s * 0.3, -s * 0.28, s * 0.09, 0, TAU); g.fill(); g.strokeStyle = "#2a1a10"; g.beginPath(); g.arc(0, s * 0.35, s * 0.2, Math.PI + 0.4, TAU - 0.4); g.stroke(); break;
    case "dream": g.save(); g.globalCompositeOperation = "lighter"; { const gr = g.createRadialGradient(0, 0, 1, 0, 0, s * 2); gr.addColorStop(0, "rgba(190,150,255,0.6)"); gr.addColorStop(1, "rgba(190,150,255,0)"); g.fillStyle = gr; g.fillRect(-s * 2, -s * 2, s * 4, s * 4); } g.restore(); g.fillStyle = "rgba(190,160,255,0.85)"; g.beginPath(); g.arc(0, 0, s * 0.7, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,0.7)"; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(Math.sin(t + i * 1.7) * s * 0.35, Math.cos(t * 0.8 + i * 2.1) * s * 0.35, s * 0.08, 0, TAU); g.fill(); } break;
    case "shadow": g.fillStyle = "rgba(20,14,34,0.92)"; g.beginPath(); g.ellipse(0, 0, s * 0.9, s * 0.35, 0, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(-s * 0.25, -s * 0.05, s * 0.07, 0, TAU); g.arc(s * 0.25, -s * 0.05, s * 0.07, 0, TAU); g.fill(); break;
    case "yesterday": g.fillStyle = "#c8b48a"; rr(g, -s * 0.8, -s * 0.8, s * 1.6, s * 1.6, 3); g.fill(); g.strokeStyle = "#7a6840"; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.moveTo(0, 0); g.lineTo(0, -s * 0.38); g.moveTo(0, 0); g.lineTo(-s * 0.26 * Math.cos(t), s * 0.12 * Math.sin(t)); g.stroke(); break;
    case "ocean": { g.save(); g.beginPath(); rr(g, -s * 0.9, -s * 0.8, s * 1.8, s * 1.6, 3); g.clip(); g.fillStyle = "#cfe0f0"; g.fillRect(-s, -s, s * 2, s * 2); const v = st.vol ?? 1, sl = st.slosh ?? 0, ly = s * 0.8 - v * s * 1.2; g.fillStyle = "#3a7ac8"; g.beginPath(); g.moveTo(-s, s); g.lineTo(-s, ly + sl * s * 0.8); g.lineTo(s, ly - sl * s * 0.8); g.lineTo(s, s); g.fill(); g.restore(); g.strokeStyle = "#7a96b0"; g.lineWidth = 1.5; rr(g, -s * 0.9, -s * 0.8, s * 1.8, s * 1.6, 3); g.stroke(); break; }
    case "reflection": g.strokeStyle = "#a8d8e0"; g.lineWidth = s * 0.14; g.fillStyle = "rgba(170,225,235,0.45)"; g.beginPath(); g.ellipse(0, 0, s * 0.6, s * 0.9, 0, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-s * 0.3, -s * 0.4); g.lineTo(-s * 0.05, -s * 0.7); g.stroke(); break;
    case "refuse": g.fillStyle = "#cfd4de"; for (const [x, y, r] of [[-0.5, 0.1, 0.5], [0.1, -0.15, 0.62], [0.65, 0.12, 0.45], [0.05, 0.25, 0.5]]) { g.beginPath(); g.arc(x * s, y * s, r * s, 0, TAU); g.fill(); } g.strokeStyle = "#4a5470"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-s * 0.4, -s * 0.02); g.lineTo(-s * 0.1, s * 0.06); g.moveTo(s * 0.4, -s * 0.02); g.lineTo(s * 0.1, s * 0.06); g.stroke(); g.beginPath(); g.arc(0, s * 0.42, s * 0.2, Math.PI + 0.3, TAU - 0.3); g.stroke(); break;
    case "bigbox": { const k = st.size ?? 1; g.save(); g.scale(0.85 + k * 0.15, 0.85 + k * 0.15); g.fillStyle = "#8a6a4a"; rr(g, -s * 0.9, -s * 0.8, s * 1.8, s * 1.6, 2); g.fill(); g.strokeStyle = "#5a4630"; g.lineWidth = 1.4; g.stroke(); g.fillStyle = "#2a1a10"; g.beginPath(); g.moveTo(-s * 0.3, -s * 0.8); g.lineTo(s * 0.3, -s * 0.8); g.lineTo(s * 0.5 + Math.sin(t * 2) * s * 0.2, -s * 1.5 - k * s * 0.3); g.lineTo(-s * 0.5, -s * 1.5 - k * s * 0.3); g.closePath(); g.fill(); g.fillStyle = "#e8c860"; g.beginPath(); g.arc(s * 0.1, -s * 1.15, s * 0.1, 0, TAU); g.fill(); g.restore(); break; }
  }
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export function drawPerson(g: G2, x: number, y: number, s: number, color: string, hat: Hat, t: number, wave = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = shade(color, -0.1); g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.lineTo(6, -26); g.lineTo(-6, -26); g.closePath(); g.fill();
  g.fillStyle = "#e8c4a0"; g.beginPath(); g.arc(0, -32, 6.5, 0, TAU); g.fill();
  g.strokeStyle = shade(color, -0.2); g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(5, -22); g.lineTo(11, -22 - 6 - wave * Math.sin(t * 7) * 6); g.stroke();
  g.fillStyle = "#2a1a10"; g.beginPath(); g.arc(-2.4, -32, 0.9, 0, TAU); g.arc(2.4, -32, 0.9, 0, TAU); g.fill();
  const hc = shade(color, -0.35);
  switch (hat) {
    case "wizard": case "pointed": g.fillStyle = hat === "wizard" ? "#4a3a98" : "#3a3a4a"; g.beginPath(); g.moveTo(-9, -37); g.lineTo(9, -37); g.lineTo(0, -62); g.closePath(); g.fill(); g.fillRect(-11, -38, 22, 3); break;
    case "chef": g.fillStyle = "#fff"; g.fillRect(-6, -45, 12, 9); ell(g, 0, -46, 8, 5, "#fff"); break;
    case "glasses": g.strokeStyle = "#3a2a1a"; g.lineWidth = 1; g.beginPath(); g.arc(-2.6, -32, 2.2, 0, TAU); g.arc(2.6, -32, 2.2, 0, TAU); g.stroke(); g.fillStyle = "#4a3a3a"; g.beginPath(); g.arc(0, -36, 7, Math.PI, TAU); g.fill(); break;
    case "goggles": g.fillStyle = "#b08d57"; g.fillRect(-7, -36, 14, 3); ell(g, -3, -34.5, 3, 3, "#9ad8e8"); ell(g, 3, -34.5, 3, 3, "#9ad8e8"); break;
    case "bun": g.fillStyle = "#cfcfd8"; g.beginPath(); g.arc(0, -36, 7, Math.PI, TAU); g.fill(); ell(g, 0, -42, 4, 4, "#cfcfd8"); break;
    case "scarf": g.fillStyle = "#c85a3a"; g.fillRect(-6, -27, 12, 3); g.fillStyle = hc; g.beginPath(); g.arc(0, -36, 7, Math.PI, TAU); g.fill(); break;
    case "fisher": g.fillStyle = "#e0b040"; g.beginPath(); g.ellipse(0, -37, 11, 3, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -38, 7, Math.PI, TAU); g.fill(); break;
    case "cap": g.fillStyle = hc; g.beginPath(); g.arc(0, -36, 7, Math.PI, TAU); g.fill(); g.fillRect(-3, -37, 12, 2); break;
    case "fancy": g.fillStyle = "#a85a8a"; g.beginPath(); g.ellipse(0, -38, 11, 3, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -39, 6, Math.PI, TAU); g.fill(); ell(g, 6, -42, 3, 3, "#f0d070"); break;
    case "hood": g.fillStyle = hc; g.beginPath(); g.arc(0, -32, 8, Math.PI * 0.95, TAU * 1.0 + 0.1); g.fill(); break;
    case "small": g.fillStyle = "#e0505a"; g.beginPath(); g.arc(0, -36, 7, Math.PI, TAU); g.fill(); break;
    default: break;
  }
  g.restore();
}

/* ------------------------------------------------------------------ */
/* The witch                                                           */
/* ------------------------------------------------------------------ */

function drawWitch(g: G2, G: Game, t: number, opts: { alpha?: number; tint?: string; mirror?: boolean } = {}) {
  const p = G.p;
  g.save();
  g.globalAlpha = opts.alpha ?? 1;
  g.translate(0, 0);
  const spin = p.flourishT > 0 ? (1 - p.flourishT / 0.55) * TAU : 0;
  const tumble = p.tumble > 0 ? (1 - p.tumble / 0.5) * TAU * 1.0 : 0;
  g.rotate(p.ang * p.face + spin * p.face + tumble);
  g.scale(p.face, opts.mirror ? -1 : 1);
  const hat = p.hat || "#3a2d6e";
  // hair streaming back
  g.strokeStyle = "#2a1a1a"; g.lineWidth = 3; g.lineCap = "round";
  const wv = Math.sin(t * 9) * 2;
  g.beginPath(); g.moveTo(-6, -6); g.quadraticCurveTo(-16, -4 + wv, -22, -1 + wv * 1.4); g.stroke();
  // broom
  g.strokeStyle = "#8a5a2a"; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-20, 8); g.lineTo(26, 6); g.stroke();
  g.fillStyle = "#c8a050"; g.beginPath(); g.moveTo(-18, 8); g.lineTo(-40, 1 + wv * 0.6); g.lineTo(-40, 15 - wv * 0.6); g.closePath(); g.fill();
  g.strokeStyle = "#8a6a30"; g.lineWidth = 1; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-20, 8 + i * 2); g.lineTo(-39, 8 + i * 5.5); g.stroke(); }
  // cloak
  g.fillStyle = opts.tint ?? "#5b4aa8"; g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, -14); g.lineTo(12 + wv * 0.3, 4); g.lineTo(-14, 6 + wv * 0.5); g.closePath(); g.fill();
  // legs
  g.strokeStyle = "#2a2038"; g.lineWidth = 3; g.beginPath(); g.moveTo(-3, 3); g.lineTo(-2, 9); g.moveTo(5, 3); g.lineTo(8, 9); g.stroke();
  g.fillStyle = "#4a2a1a"; g.fillRect(-5, 9, 6, 3); g.fillRect(6, 9, 6, 3);
  // satchel
  g.fillStyle = "#a8743a"; rr(g, -13, -4, 8, 8, 2); g.fill();
  // arms to handle
  g.strokeStyle = opts.tint ?? "#5b4aa8"; g.lineWidth = 3; g.beginPath(); g.moveTo(3, -10); g.lineTo(14, 3); g.stroke();
  // head
  g.fillStyle = "#e8c4a0"; g.beginPath(); g.arc(2, -22, 7, 0, TAU); g.fill();
  g.fillStyle = "#2a1a10"; g.beginPath(); g.arc(5, -22.5, 1.1, 0, TAU); g.fill();
  g.strokeStyle = "#c8785a"; g.lineWidth = 1; g.beginPath(); g.arc(6, -19.5, 2, 0.2, Math.PI - 0.5); g.stroke();
  g.fillStyle = "#2a1a1a"; g.beginPath(); g.arc(0, -24, 7.5, Math.PI * 0.9, TAU * 0.95); g.fill();
  // hat
  const flop = clamp(-p.vx * p.face / 500, -0.4, 0.9) + Math.sin(t * 8) * 0.04;
  g.save(); g.translate(1, -28); g.rotate(-flop * 0.8);
  g.fillStyle = hat; g.beginPath(); g.ellipse(0, 0, 13, 3.4, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(-8, -1); g.quadraticCurveTo(0, -16, -2 - flop * 14, -24 - flop * 4); g.quadraticCurveTo(6, -14, 8, -1); g.closePath(); g.fill();
  g.fillStyle = "#e0b040"; g.fillRect(-8, -4, 16, 2.4);
  if (G.pkg?.def.id === "egg" && G.pkg.s.hatched) { ell(g, 5, -9, 5, 4.5, "#e0603a"); ell(g, 9, -12, 3, 2.6, "#e0603a"); g.fillStyle = "#fff"; g.beginPath(); g.arc(10, -12.5, 0.8, 0, TAU); g.fill(); }
  g.restore();
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Scenery                                                             */
/* ------------------------------------------------------------------ */

function drawBuilding(g: G2, b: Building, t: number, light: number, night: boolean, o: DrawOpts, G: Game) {
  const top = b.baseY - b.h;
  const wall = b.color;
  const x = b.x, w = b.w;
  // body
  const gr = g.createLinearGradient(0, top, 0, b.baseY);
  gr.addColorStop(0, shade(wall, 0.08)); gr.addColorStop(1, shade(wall, -0.22));
  g.fillStyle = b.style === "tree" ? "#4a3a24" : b.style === "lighthouse" ? "#f0e6d4" : gr;
  const re = b.baseY - b.h - b.roofTop;
  if (b.style === "lighthouse") {
    g.beginPath(); g.moveTo(x + 6, b.baseY); g.lineTo(x + w - 6, b.baseY); g.lineTo(x + w - 14, top); g.lineTo(x + 14, top); g.closePath(); g.fill();
    g.fillStyle = "#c8402a"; for (let i = 0; i < 6; i++) { const y0 = top + (i * 2 + 1) * (b.h / 12); const k = (y0 - top) / b.h; g.fillRect(x + lerp(14, 6, k), y0, w - lerp(28, 12, k), b.h / 12); }
    g.fillStyle = "#3a3a4a"; g.fillRect(x + 12, top - 6, w - 24, 8); g.fillStyle = night ? "#fff2b0" : "#ffe9a0"; g.fillRect(x + 20, top - 32, w - 40, 26); g.fillStyle = "#c8402a"; g.beginPath(); g.moveTo(x + 14, top - 32); g.lineTo(x + w / 2, top - 52); g.lineTo(x + w - 14, top - 32); g.closePath(); g.fill();
    if (night || light < 0.5) { const a = (t * 0.7) % TAU; g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(x + w / 2, top - 20, 4, x + w / 2, top - 20, 320); gl.addColorStop(0, "rgba(255,240,170,0.5)"); gl.addColorStop(1, "rgba(255,240,170,0)"); g.fillStyle = gl; g.translate(x + w / 2, top - 20); g.rotate(Math.cos(a) > 0 ? 0 : Math.PI); g.beginPath(); g.moveTo(0, 0); g.lineTo(520, -50 * Math.sin(a)); g.lineTo(520, 50 * Math.sin(a) + 30); g.closePath(); g.fill(); g.restore(); }
    return;
  }
  if (b.style === "tree") {
    g.fillStyle = "#4a3a24"; g.beginPath(); g.moveTo(x, b.baseY); g.quadraticCurveTo(x + 20, top + b.h * 0.5, x + 24, top + 30); g.lineTo(x + w - 24, top + 30); g.quadraticCurveTo(x + w - 20, top + b.h * 0.5, x + w, b.baseY); g.closePath(); g.fill();
    for (let i = 0; i < 7; i++) ell(g, x + w / 2 + (hash(i) - 0.5) * w * 1.3, top + 20 + hash(i + 9) * 24, 38 + hash(i + 3) * 18, 28 + hash(i + 5) * 14, mix("#2f5a38", "#4f8a4a", hash(i + 1)));
    g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(x + w / 2, b.baseY - 38, 22, 38, 0, Math.PI, TAU); g.fill(); g.fillRect(x + w / 2 - 22, b.baseY - 38, 44, 38);
    g.fillStyle = night ? "#ffd47a" : "#a89868"; ell(g, x + w / 2, b.baseY - 38, 6, 8, g.fillStyle as string);
    return;
  }
  if (b.style === "stall") {
    g.fillStyle = "#8a6a3a"; g.fillRect(x, top + 10, w, b.h - 10);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#e8d8b0" : "#c8402a"; g.beginPath(); g.moveTo(x + i * w / 8, top - 8); g.lineTo(x + (i + 1) * w / 8, top - 8); g.lineTo(x + (i + 1) * w / 8 + 3, top + 14); g.lineTo(x + i * w / 8 - 3, top + 14); g.fill(); }
    for (let i = 0; i < 5; i++) ell(g, x + 20 + i * (w - 40) / 4, top + 34, 9, 7, ["#e8a040", "#d0402a", "#7ab04a", "#e8d070", "#c070c0"][i]);
    return;
  }
  g.beginPath(); g.rect(x, top, w, b.h); g.fill();
  g.strokeStyle = "rgba(20,12,30,0.5)"; g.lineWidth = 2; g.strokeRect(x, top, w, b.h);
  // timber/brick hints
  g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 1;
  for (let yy = top + 16; yy < b.baseY; yy += 16) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
  // windows
  const cols = Math.max(1, Math.floor(w / 34)), rows = Math.max(1, Math.floor((b.h - 50) / 50));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = x + (c + 0.5) * (w / cols) - 7, wy = top + 22 + r * 50;
    if (wy + 20 > b.baseY - 36) continue;
    const lit = night && hash(b.id * 31 + r * 7 + c) > 0.35;
    g.fillStyle = lit ? `rgba(255,214,120,${0.85 + 0.1 * Math.sin(t * 2 + b.id + r)})` : mix("#6a8aa8", "#a8c8e0", light * 0.7);
    rr(g, wx, wy, 14, 20, 5); g.fill();
    g.strokeStyle = "rgba(40,24,20,0.7)"; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.moveTo(wx + 7, wy); g.lineTo(wx + 7, wy + 20); g.moveTo(wx, wy + 10); g.lineTo(wx + 14, wy + 10); g.stroke();
    if (lit) { g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(wx + 7, wy + 10, 1, wx + 7, wy + 10, 26); gl.addColorStop(0, "rgba(255,200,100,0.25)"); gl.addColorStop(1, "rgba(255,200,100,0)"); g.fillStyle = gl; g.fillRect(wx - 20, wy - 16, 54, 52); g.restore(); }
  }
  // door
  if (!b.noDoor && b.h > 70) { g.fillStyle = "#4a2e1c"; g.beginPath(); g.ellipse(x + w / 2, b.baseY - 22, 11, 22, 0, Math.PI, TAU); g.rect(x + w / 2 - 11, b.baseY - 22, 22, 22); g.fill(); g.fillStyle = "#d9b36a"; g.beginPath(); g.arc(x + w / 2 + 5, b.baseY - 12, 1.6, 0, TAU); g.fill(); }
  // roof
  const roof = b.roof;
  const cx = x + w / 2;
  switch (b.style) {
    case "tower": g.fillStyle = roof; g.beginPath(); g.moveTo(x - 6, top); g.lineTo(cx, top - re); g.lineTo(x + w + 6, top); g.closePath(); g.fill(); g.strokeStyle = "rgba(20,12,30,0.5)"; g.stroke(); ell(g, cx, top - re - 2, 3, 3, "#ffe28a"); break;
    case "dome": g.fillStyle = shade(roof, 0.1); g.beginPath(); g.arc(cx, top, w * 0.5, Math.PI, TAU); g.fill(); g.strokeStyle = "rgba(20,12,30,0.5)"; g.lineWidth = 2; g.stroke(); g.strokeStyle = "rgba(255,255,255,0.2)"; g.beginPath(); g.moveTo(cx, top - w * 0.5); g.lineTo(cx, top); g.stroke(); if (b.lm === "observatory") { g.fillStyle = "#1a2040"; g.beginPath(); g.moveTo(cx - 8, top - w * 0.5 + 6); g.lineTo(cx + 8, top - w * 0.5 + 6); g.lineTo(cx + 14, top); g.lineTo(cx - 14, top); g.fill(); g.strokeStyle = "#8a8aa0"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, top - 26); g.lineTo(cx + 22, top - 52); g.stroke(); } break;
    case "dock": case "hut": g.fillStyle = roof; g.beginPath(); g.moveTo(x - 4, top); g.lineTo(cx, top - Math.max(14, re)); g.lineTo(x + w + 4, top); g.closePath(); g.fill(); break;
    case "well": g.fillStyle = "#6a6a7a"; g.fillRect(x + 6, top - 4, 8, 4); g.fillRect(x + w - 14, top - 4, 8, 4); g.fillStyle = "#8a6a4a"; g.beginPath(); g.moveTo(x, top - 10); g.lineTo(cx, top - 24); g.lineTo(x + w, top - 10); g.closePath(); g.fill(); g.fillStyle = "rgba(160,200,255,0.55)"; g.beginPath(); g.ellipse(cx, top + 6, w * 0.3, 5, 0, 0, TAU); g.fill(); break;
    default: g.fillStyle = roof; g.beginPath(); g.moveTo(x - 8, top); g.lineTo(cx, top - re); g.lineTo(x + w + 8, top); g.closePath(); g.fill(); g.strokeStyle = "rgba(20,12,30,0.5)"; g.lineWidth = 2; g.stroke(); g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 1; for (let i = 1; i < 4; i++) { const k = i / 4; g.beginPath(); g.moveTo(lerp(x - 8, cx, k), lerp(top, top - re, k)); g.lineTo(lerp(x + w + 8, cx, k), lerp(top, top - re, k)); g.stroke(); }
  }
  if (b.style === "mill") { g.save(); g.translate(x - 4, b.baseY - 60); g.rotate(t * 0.5); g.strokeStyle = "#6a4a2a"; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -44); g.stroke(); g.fillStyle = "#8a6a3a"; g.fillRect(-4, -48, 8, 10); } g.restore(); }
  if (b.chimney && !G.w.portals.length) { g.fillStyle = "#6a4a3a"; g.fillRect(x + w * 0.7, top - re - 10, 14, 24); }
  void o;
}

function drawPortalStack(g: G2, x: number, mouthY: number, t: number) {
  g.fillStyle = "#6a3a3a"; g.fillRect(x - 27, mouthY, 54, 134);
  g.strokeStyle = "rgba(20,12,30,0.5)"; g.lineWidth = 1.5; for (let yy = mouthY + 12; yy < mouthY + 130; yy += 12) { g.beginPath(); g.moveTo(x - 27, yy); g.lineTo(x + 27, yy); g.stroke(); }
  g.fillStyle = "#4a2a2a"; g.fillRect(x - 31, mouthY - 6, 62, 10);
  const gr = g.createRadialGradient(x, mouthY + 6, 2, x, mouthY + 6, 30);
  gr.addColorStop(0, "rgba(220,190,255,0.9)"); gr.addColorStop(1, "rgba(120,70,200,0)");
  g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(x - 40, mouthY - 30, 80, 70); g.restore();
  g.strokeStyle = "rgba(210,180,255,0.8)"; g.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; g.beginPath(); g.ellipse(x, mouthY + 4, 18, 5, 0, a, a + 2.2); g.stroke(); }
}

function drawRing(g: G2, r: { x: number; y: number; r: number; lane: boolean }, cool: number, t: number, shimmer: boolean) {
  const used = cool > 0;
  g.save(); g.translate(r.x, r.y);
  const col = r.lane ? "#ffd47a" : "#d8e4ff";
  g.save(); g.globalCompositeOperation = "lighter";
  const gl = g.createRadialGradient(0, 0, r.r * 0.6, 0, 0, r.r * 1.7); gl.addColorStop(0, rgba(col, used ? 0.08 : (shimmer ? 0.35 : 0.22))); gl.addColorStop(1, rgba(col, 0)); g.fillStyle = gl; g.fillRect(-r.r * 2, -r.r * 2, r.r * 4, r.r * 4); g.restore();
  g.strokeStyle = used ? "rgba(160,160,180,0.5)" : col; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, r.r, 0, TAU); g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, r.r + 3, t, t + 1.2); g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.fillStyle = used ? "#8a8a9a" : "#fff"; g.beginPath(); g.arc(Math.cos(a) * r.r, Math.sin(a) * r.r, 2.4, 0, TAU); g.fill(); }
  g.restore();
}

function drawBirdsFlock(g: G2, G: Game, i: number, t: number) {
  const f = G.flocks[i], d = G.w.flocks[i];
  const col = d.kind === "crow" ? "#1d1a28" : d.kind === "gull" ? "#f0f0f4" : "#8a6a4a";
  g.strokeStyle = col; g.lineWidth = 2; g.lineCap = "round";
  const dir = f.vx >= 0 ? 1 : -1;
  for (let k = 0; k < d.n; k++) {
    const bx = f.x + Math.sin(k * 2.3 + t * 0.7) * 26 + (k - d.n / 2) * 7 * dir * -1, by = f.y + Math.cos(k * 1.7 + t * 0.9) * 14;
    const fl = Math.sin(t * 12 + k * 1.3) * 5;
    g.beginPath(); g.moveTo(bx - 7, by - fl * 0.2); g.quadraticCurveTo(bx - 3, by - 3 - fl, bx, by); g.quadraticCurveTo(bx + 3, by - 3 + fl, bx + 7, by - fl * 0.2); g.stroke();
  }
  if (f.hasPkg && G.pkg) { g.save(); g.translate(f.x, f.y + 16); drawPackage(g, G.pkg.def.id, 8, t, G.pkg.s); g.restore(); }
}

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

export function draw(g: G2, G: Game, o: DrawOpts) {
  const { cw, ch, dpr, t } = o;
  const W = G.w;
  const f = timeOfDay(G.clock);
  const light = lightLevel(f);
  const night = light < 0.4;
  const sc = clamp(ch / 760, 0.5, 1.6);
  const shk = o.reduced ? 0 : G.shake;
  const camX = G.cam.x + (shk ? (Math.random() - 0.5) * shk : 0), camY = G.cam.y + (shk ? (Math.random() - 0.5) * shk : 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const wx2sx = (x: number) => (x - camX) * sc + cw / 2;
  const wy2sy = (y: number) => (y - camY) * sc + ch / 2;
  const left = camX - cw / 2 / sc - 160, right = camX + cw / 2 / sc + 160;
  const top = camY - ch / 2 / sc, bottom = camY + ch / 2 / sc;
  const wthr = G.weather;

  /* ---- sky ---- */
  const sky = skyAt(f);
  const sg = g.createLinearGradient(0, 0, 0, ch);
  sg.addColorStop(0, sky.top); sg.addColorStop(1, sky.bot);
  g.fillStyle = sg; g.fillRect(0, 0, cw, ch);
  if (wthr.magic > 0.05) { g.fillStyle = `rgba(150,90,255,${0.22 * wthr.magic})`; g.fillRect(0, 0, cw, ch); }
  const grey = clamp(wthr.rain * 0.35 + wthr.storm * 0.25 + wthr.snow * 0.2 + wthr.fog * 0.3, 0, 0.6);
  if (grey) { g.fillStyle = `rgba(${night ? "20,24,44" : "120,132,150"},${grey})`; g.fillRect(0, 0, cw, ch); }
  if (night) {
    g.fillStyle = "#fff";
    for (let i = 0; i < 90; i++) { g.globalAlpha = clamp((0.45 - light) * 3) * (0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + hash(i)) + i))) * (1 - grey * 1.4); g.fillRect(hash(i) * cw, hash(i + 4) * ch * 0.75, 1.6, 1.6); }
    g.globalAlpha = 1;
  }
  // sun / moon
  const sunA = (f - 0.25) * TAU;
  const sunX = cw * (0.5 - Math.cos(sunA) * 0.42), sunY = ch * (0.62 - Math.sin(sunA) * 0.5);
  if (Math.sin(sunA) > -0.15) { const k = clamp(Math.sin(sunA) * 3 + 0.5); g.fillStyle = `rgba(255,236,180,${k * (1 - grey)})`; g.beginPath(); g.arc(sunX, sunY, 34, 0, TAU); g.fill(); }
  { const mA = sunA + Math.PI; const mx = cw * (0.5 - Math.cos(mA) * 0.42), my = ch * (0.62 - Math.sin(mA) * 0.5); if (Math.sin(mA) > -0.15) { g.fillStyle = `rgba(235,240,255,${clamp(Math.sin(mA) * 3 + 0.5) * (1 - grey)})`; g.beginPath(); g.arc(mx, my, 24, 0, TAU); g.fill(); g.fillStyle = sky.top; g.beginPath(); g.arc(mx + 8, my - 4, 21, 0, TAU); g.fill(); } }
  // clouds (parallax)
  for (let layer = 0; layer < 2; layer++) {
    const par = 0.12 + layer * 0.18;
    g.fillStyle = night ? "rgba(70,80,120,0.4)" : `rgba(255,255,255,${0.5 - layer * 0.12})`;
    for (let i = 0; i < 12; i++) {
      const base = hash(i * 3 + layer * 17) * 14000;
      const cx = ((base - camX * par + (o.reduced ? 0 : t * (6 + layer * 5)) * sc) % 6000 + 6000) % 6000 - 600;
      const cy = ch * (0.05 + hash(i + layer * 9) * 0.34 + layer * 0.08);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + k * 38 * sc, cy + Math.sin(k) * 7, 50 * sc, 20 * sc, 0, 0, TAU); g.fill(); }
    }
  }
  // far mountains & mid skyline (parallax)
  for (const [par, base, amp, col, a] of [[0.2, 0.74, 0.16, "#3a3a6a", 0.55], [0.38, 0.8, 0.12, "#2e3258", 0.7]] as [number, number, number, string, number][]) {
    g.fillStyle = mix(col, night ? "#0a0c22" : "#6a78b0", night ? 0.55 : 0.18);
    g.globalAlpha = a;
    g.beginPath(); g.moveTo(0, ch);
    for (let x = 0; x <= cw + 20; x += 20) {
      const px = (camX * par) + (x - cw / 2) / sc;
      const h = (Math.sin(px * 0.0021) * 0.5 + Math.sin(px * 0.0057 + 1.3) * 0.35 + Math.sin(px * 0.011) * 0.15) * amp * ch;
      g.lineTo(x, ch * base - h - 30);
    }
    g.lineTo(cw, ch); g.closePath(); g.fill();
  }
  g.globalAlpha = 1;
  { // far town silhouettes
    const par = 0.55;
    const d = districtAt(camX);
    g.fillStyle = mix(d.palette.far, night ? "#080a1e" : "#8a96c8", night ? 0.5 : 0.22);
    const x0 = camX * par - cw / 2 / sc - 100, x1 = camX * par + cw / 2 / sc + 100;
    for (let bx = Math.floor(x0 / 90) * 90; bx < x1; bx += 90) {
      const h = 90 + hash(bx * 0.013) * 220, w = 60 + hash(bx * 0.031) * 40;
      const sx = (bx - camX * par) * sc + cw / 2 - (camX - camX) * sc;
      const sy = wy2sy(GROUND + 20) - h * sc * 0.9 * (1 - (camY - 500) / 3000);
      g.fillRect(sx, sy, w * sc, ch);
      g.beginPath(); g.moveTo(sx - 4, sy); g.lineTo(sx + w * sc / 2, sy - 30 * sc); g.lineTo(sx + w * sc + 4, sy); g.fill();
    }
  }

  /* ---- world space ---- */
  g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (cw / 2 - camX * sc), dpr * (ch / 2 - camY * sc));

  // underground & ground
  g.fillStyle = "#1c1424"; g.fillRect(left, GROUND + 4, right - left, 400);
  g.strokeStyle = "rgba(255,255,255,0.04)"; g.lineWidth = 2;
  for (let yy = GROUND + 40; yy < 1340; yy += 46) { g.beginPath(); for (let x = left; x < right; x += 40) g.lineTo(x, yy + Math.sin(x * 0.01 + yy) * 5); g.stroke(); }
  for (const tn of TUNNELS) {
    if (tn.x1 < left || tn.x0 > right) continue;
    g.fillStyle = "#0b0812";
    g.fillRect(tn.x0, tn.top, tn.x1 - tn.x0, tn.bottom - tn.top);
    for (const sh of [tn.sh1, tn.sh2]) g.fillRect(sh[0], GROUND - 6, sh[1] - sh[0], tn.top - GROUND + 8);
    for (let x = tn.x0 + 60; x < tn.x1; x += 120) { g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(x, tn.top + 14, 1, x, tn.top + 14, 70); gl.addColorStop(0, "rgba(255,190,100,0.35)"); gl.addColorStop(1, "rgba(255,190,100,0)"); g.fillStyle = gl; g.fillRect(x - 70, tn.top - 56, 140, 140); g.restore(); g.fillStyle = "#ffd890"; g.beginPath(); g.arc(x, tn.top + 14, 3, 0, TAU); g.fill(); }
    g.strokeStyle = "#3a2a1a"; g.lineWidth = 4; for (let x = tn.x0 + 30; x < tn.x1; x += 90) { g.beginPath(); g.moveTo(x, tn.top); g.lineTo(x, tn.bottom); g.stroke(); }
  }
  // terrain
  {
    const x0 = Math.max(0, Math.floor(left / 40) * 40), x1 = Math.min(WORLD_W, right + 40);
    const dk = night ? 0.45 : 0;
    g.fillStyle = mix("#4a6a3a", "#0e1a14", dk);
    g.beginPath(); g.moveTo(x0, GROUND + 60);
    for (let x = x0; x <= x1; x += 40) g.lineTo(x, terrainY(x));
    g.lineTo(x1, GROUND + 60); g.closePath(); g.fill();
    g.strokeStyle = mix("#7aa05a", "#1a2a1a", dk); g.lineWidth = 5; g.beginPath(); for (let x = x0; x <= x1; x += 40) g.lineTo(x, terrainY(x)); g.stroke();
    // hill grass, cobbles
    g.fillStyle = mix("#6a5a4a", "#16120e", dk); g.beginPath(); g.moveTo(x0, GROUND + 4); for (let x = x0; x <= x1; x += 40) g.lineTo(x, terrainY(x) + 10 + Math.sin(x * 0.2) * 1); g.lineTo(x1, GROUND + 70); g.lineTo(x0, GROUND + 70); g.fill();
  }
  // water
  for (const [a, b] of [RIVER, SEA]) {
    if (b < left || a > right) continue;
    const wg = g.createLinearGradient(0, GROUND, 0, GROUND + 120); wg.addColorStop(0, night ? "#1a3a68" : "#4a8ac8"); wg.addColorStop(1, night ? "#0a1a38" : "#1f4a88");
    g.fillStyle = wg; g.fillRect(a, GROUND + 6, b - a, 330);
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2; g.beginPath();
    for (let x = a; x <= b; x += 12) g.lineTo(x, GROUND + 6 + Math.sin(x * 0.05 + (o.reduced ? 0 : t * 1.8)) * 2.4);
    g.stroke();
    for (let i = 0; i < 14; i++) { const wx = a + ((hash(i) * (b - a) + (o.reduced ? 0 : t * 12)) % (b - a)); g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(wx, GROUND + 14 + hash(i + 3) * 40, 24, 2); }
  }

  // forest back layer (trees)
  for (const tr of W.trees) {
    if (tr.x < left - 160 || tr.x > right + 160) continue;
    const dk = night ? 0.3 : 0;
    g.fillStyle = mix("#4a3a28", "#120e0a", dk);
    g.beginPath(); g.moveTo(tr.x - tr.w / 2 - 4, GROUND); g.lineTo(tr.x - tr.w / 2 + 2, tr.topY + 50); g.lineTo(tr.x + tr.w / 2 - 2, tr.topY + 50); g.lineTo(tr.x + tr.w / 2 + 4, GROUND); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(tr.x - tr.w / 4 + i * tr.w / 6, GROUND); g.lineTo(tr.x - tr.w / 4 + i * tr.w / 6, tr.topY + 60); g.stroke(); }
    const sway = o.reduced ? 0 : Math.sin(t * 0.8 + tr.seed * 6) * 3;
    for (let i = 0; i < 6; i++) ell(g, tr.x + (hash(i + tr.seed * 9) - 0.5) * tr.canopy * 1.5 + sway, tr.topY + 20 + (hash(i * 3 + tr.seed * 5) - 0.5) * tr.canopy * 0.7, tr.canopy * (0.5 + hash(i) * 0.3), tr.canopy * 0.42, mix(mix("#27502f", "#4a8a48", hash(i + tr.seed * 7)), "#0a1410", dk));
    if (tr.giant) {
      // the tiny village
      g.fillStyle = "#6a4a2a"; g.fillRect(tr.x - 90, tr.topY + 62, 180, 6);
      for (const [dx, dy] of [[-70, 0], [-20, -6], [30, 0], [68, -4]]) { g.fillStyle = "#d8b878"; g.fillRect(tr.x + dx - 8, tr.topY + 44 + dy, 16, 18); g.fillStyle = "#a83a2a"; g.beginPath(); g.moveTo(tr.x + dx - 11, tr.topY + 44 + dy); g.lineTo(tr.x + dx, tr.topY + 32 + dy); g.lineTo(tr.x + dx + 11, tr.topY + 44 + dy); g.fill(); if (night) { g.fillStyle = "#ffd47a"; g.fillRect(tr.x + dx - 2, tr.topY + 50 + dy, 4, 5); } }
    }
  }
  // witch path (wind tunnel) leaves
  for (const z of W.windTunnels) {
    if (z.x + z.w < left || z.x > right) continue;
    g.fillStyle = "#8fc46a";
    for (let i = 0; i < 12; i++) { const lx = z.x + ((hash(i) * z.w + (o.reduced ? 0 : t * 160)) % z.w), ly = z.y + 8 + hash(i + 4) * (z.h - 16) + Math.sin(t * 3 + i) * 5; g.globalAlpha = 0.4; g.beginPath(); g.ellipse(lx, ly, 6, 2.4, Math.sin(t + i), 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }

  // buildings
  for (const b of W.buildings) {
    if (b.x + b.w < left - 40 || b.x > right + 40) continue;
    drawBuilding(g, b, t, light, night, o, G);
  }
  // clocktower face
  { const lm = LOC.clock, cx = lm.x; if (cx > left - 100 && cx < right + 100) { g.fillStyle = "#f0e6c8"; g.beginPath(); g.arc(cx, GROUND - 440, 34, 0, TAU); g.fill(); g.strokeStyle = "#4a3a2a"; g.lineWidth = 3; g.stroke(); const a = G.clock * 0.1; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, GROUND - 440); g.lineTo(cx + Math.sin(a) * 20, GROUND - 440 - Math.cos(a) * 20); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, GROUND - 440); g.lineTo(cx + Math.sin(a * 12) * 28, GROUND - 440 - Math.cos(a * 12) * 28); g.stroke(); const h = W.towerHole; g.fillStyle = "#150f1c"; g.fillRect(h.x + 30, h.y, h.w - 60, h.h); g.fillStyle = "rgba(255,214,120,0.1)"; g.fillRect(h.x + 30, h.y, h.w - 60, h.h); } }
  // portals
  for (const po of W.portals) if (po.x > left - 60 && po.x < right + 60) drawPortalStack(g, po.x, po.mouthY, t);
  // bridges
  for (const b of W.bridges) {
    if (b.x + b.w < left || b.x > right) continue;
    g.fillStyle = "#8a7a6a"; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = "#6a5a4a"; g.fillRect(b.x, b.y - 8, b.w, 4);
    for (let x = b.x; x < b.x + b.w; x += 20) { g.fillRect(x, b.y - 22, 3, 14); }
    g.fillStyle = "#6a5a4a"; g.fillRect(b.x, b.y - 24, b.w, 3);
    const spans = Math.round(b.w / 120);
    g.fillStyle = "#22304a";
    for (let i = 0; i < spans; i++) { const sx = b.x + (i + 0.5) * (b.w / spans); g.beginPath(); g.ellipse(sx, GROUND + 6, b.w / spans * 0.4, GROUND + 6 - b.y - b.h - 2, 0, Math.PI, TAU); g.fill(); }
    g.strokeStyle = "#5a4a3a"; g.lineWidth = 3; for (let i = 0; i < spans; i++) { const sx = b.x + (i + 0.5) * (b.w / spans); g.beginPath(); g.ellipse(sx, GROUND + 6, b.w / spans * 0.4, GROUND + 6 - b.y - b.h - 2, 0, Math.PI, TAU); g.stroke(); }
  }
  for (const s of W.solids) {
    // piers / masts / crane are drawn from solids that lack building art
    if (s.x + s.w < left || s.x > right) continue;
    if ((s.w <= 28 && s.h > 100 && s.x > 2160 && s.x < 2840) || (s.x > 8170 && s.x < 9040 && s.y > GROUND - 500 && s.y < GROUND - 40 && s.x < 9100)) { g.fillStyle = s.x > 8000 ? "#5a4a3a" : "#6a6a74"; g.fillRect(s.x, s.y, s.w, s.h); }
  }
  // ships
  for (const [x0, x1, col] of [[8430, 8690, "#8a3a2a"], [8810, 9030, "#2a5a7a"]] as [number, number, string][]) {
    if (x1 < left || x0 > right) continue;
    const bob = Math.sin(t * 1.1 + x0) * 3;
    g.save(); g.translate(0, bob);
    g.fillStyle = col; g.beginPath(); g.moveTo(x0, GROUND - 52); g.lineTo(x1, GROUND - 52); g.lineTo(x1 - 24, GROUND + 6); g.lineTo(x0 + 24, GROUND + 6); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(x0 + 10, GROUND - 40, x1 - x0 - 20, 4);
    const mx = (x0 + x1) / 2; g.fillStyle = "#4a3a2a"; g.fillRect(mx - 5, GROUND - 330, 10, 280); g.fillRect(x0 + 40, GROUND - 250, 8, 200);
    g.fillStyle = "#f0e6d0"; g.beginPath(); g.moveTo(mx + 6, GROUND - 320); g.quadraticCurveTo(mx + 70, GROUND - 230, mx + 6, GROUND - 120); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x0 + 50, GROUND - 240); g.quadraticCurveTo(x0 + 100, GROUND - 170, x0 + 50, GROUND - 90); g.closePath(); g.fill();
    g.restore();
  }
  // crane
  { const cr = W.crane; if (cr.x > left - 200 && cr.x < right + 200) { g.fillStyle = "#c8902a"; g.fillRect(cr.x - 13, GROUND - 480, 26, 480); g.strokeStyle = "#8a5a1a"; g.lineWidth = 2; for (let y = GROUND - 470; y < GROUND; y += 28) { g.beginPath(); g.moveTo(cr.x - 13, y); g.lineTo(cr.x + 13, y + 28); g.stroke(); } g.fillStyle = "#c8902a"; g.fillRect(cr.x - 110, GROUND - 486, 130, 10); const hz = hazards(G); g.strokeStyle = "#3a3a3a"; g.lineWidth = 2; g.beginPath(); g.moveTo(hz.hook.ax, hz.hook.ay); g.lineTo(hz.hook.x, hz.hook.y - 10); g.stroke(); g.strokeStyle = "#5a5a6a"; g.lineWidth = 4; g.beginPath(); g.arc(hz.hook.x, hz.hook.y + 2, 10, 0.3, Math.PI * 1.7); g.stroke(); } }

  // landmarks: lanterns, names, mailboxes
  const q = G.quest;
  for (const lm of LANDMARKS) {
    const pad = W.pads[lm.id];
    if (pad.x < left - 200 || pad.x > right + 200) continue;
    const active = !!q && q.phase !== "result" && (q.phase === "pickup" ? q.offer.from : q.offer.to) === lm.id;
    // mailbox on the roof
    g.fillStyle = "#4a6a9a"; rr(g, pad.x - 9, pad.y + 26, 18, 14, 3); g.fill(); g.fillStyle = "#2a3a5a"; g.fillRect(pad.x - 2, pad.y + 40, 4, 8); g.fillStyle = active ? "#ffd47a" : "#e04a3a"; g.fillRect(pad.x + 9, pad.y + 26, 3, 9);
    // landing glow
    const pulse = o.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 3);
    g.save(); g.globalCompositeOperation = "lighter";
    const gl = g.createRadialGradient(pad.x, pad.y, 4, pad.x, pad.y, pad.r * (active ? 1.4 : 0.9));
    gl.addColorStop(0, `rgba(255,220,140,${active ? 0.35 + pulse * 0.2 : 0.1})`); gl.addColorStop(1, "rgba(255,220,140,0)");
    g.fillStyle = gl; g.fillRect(pad.x - pad.r * 1.6, pad.y - pad.r * 1.6, pad.r * 3.2, pad.r * 3.2); g.restore();
    g.strokeStyle = active ? `rgba(255,230,160,${0.6 + pulse * 0.3})` : "rgba(255,230,160,0.2)"; g.lineWidth = active ? 3 : 1.5; g.setLineDash([6, 6]); g.lineDashOffset = o.reduced ? 0 : -t * 14;
    g.beginPath(); g.arc(pad.x, pad.y, pad.r, 0, TAU); g.stroke(); g.setLineDash([]);
    g.font = "600 13px 'Space Grotesk', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(10,8,24,0.7)"; g.fillStyle = active ? "#ffe9b0" : "rgba(255,255,255,0.8)";
    g.strokeText(lm.name, pad.x, pad.y - pad.r - 10); g.fillText(lm.name, pad.x, pad.y - pad.r - 10);
    // the customer waiting at the target
    if (active && Math.abs(pad.x - G.p.x) < 700) {
      const c = CUSTOMER[lm.customer];
      const cust = q!.phase === "carry" ? CUSTOMER[q!.offer.customer] : c;
      const stand = pad.y + 26;
      drawPerson(g, pad.x + 24, stand, 0.9, cust.color, cust.hat, t, q!.phase === "carry" && Math.hypot(G.p.x - pad.x, G.p.y - pad.y) < pad.r * 3 ? 1 : 0);
    }
  }
  // secret decor
  if (G.save.secrets.garden || Math.abs(372 - G.p.x) < 500) {
    g.fillStyle = "#3d6a37"; for (let i = 0; i < 9; i++) { ell(g, 345 + i * 7, GROUND - 8 - (i % 3) * 4, 6, 5, mix("#3d6a37", "#7fb35c", hash(i))); }
    for (let i = 0; i < 4; i++) { ell(g, 350 + i * 17, GROUND - 24 - (i % 2) * 8, 4, 4, ["#e8708a", "#f0b840", "#c78af0", "#ff9ab8"][i]); }
  }
  if (G.weather.rain > 0.3 || G.save.secrets.cat) { // the rain cat
    const cx = 1915, cy = GROUND - 175;
    if (Math.abs(cx - G.p.x) < 800) { const a = G.weather.rain > 0.3 ? 1 : 0.0; if (a || G.save.secrets.cat) { g.globalAlpha = G.save.secrets.cat ? 1 : a; ell(g, cx, cy + 6, 9, 8, "#7a808c"); ell(g, cx + 6, cy - 4, 6, 5.5, "#7a808c"); g.fillStyle = "#7a808c"; g.beginPath(); g.moveTo(cx + 2, cy - 8); g.lineTo(cx + 3, cy - 14); g.lineTo(cx + 7, cy - 9); g.moveTo(cx + 8, cy - 9); g.lineTo(cx + 11, cy - 14); g.lineTo(cx + 12, cy - 6); g.fill(); g.fillStyle = "#ffe48a"; g.fillRect(cx + 5, cy - 5, 2, 2); g.fillRect(cx + 9, cy - 5, 2, 2); g.globalAlpha = 1; } }
  }
  if (night && Math.abs(4060 - G.p.x) < 900) { // witch meeting
    const cx = 4060, cy = GROUND - 8; const seen = G.save.secrets.meeting;
    g.save(); g.globalAlpha = seen ? 1 : 0.55;
    g.fillStyle = "#e0883a"; g.beginPath(); g.moveTo(cx - 10, cy); g.lineTo(cx, cy - 22 - Math.sin(t * 9) * 3); g.lineTo(cx + 10, cy); g.fill();
    g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(cx, cy - 10, 2, cx, cy - 10, 120); gl.addColorStop(0, "rgba(255,160,70,0.4)"); gl.addColorStop(1, "rgba(255,160,70,0)"); g.fillStyle = gl; g.fillRect(cx - 130, cy - 140, 260, 260); g.restore();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI + Math.PI * 1.0; const px = cx + Math.cos(i * 1.05) * 70, hh = ["pointed", "pointed", "hood", "pointed", "bun", "pointed"][i] as Hat; drawPerson(g, px, cy, 0.8, ["#7a6aaa", "#6a8a9a", "#9a6a7a", "#6a9a7a", "#aa7aaa", "#7a7aaa"][i], hh, t, 0); void a; }
    g.restore();
  }
  if (Math.abs(7330 - G.p.x) < 700 && G.save.secrets.nodoor) { g.fillStyle = "rgba(255,230,160,0.8)"; g.font = "11px sans-serif"; g.textAlign = "center"; g.fillText("(no door)", 7330, terrainY(7330) - 100); }
  if (night && Math.abs(8100 - G.p.x) < 600) { const lit = isMid(f); g.fillStyle = lit ? "#ffd47a" : "#2a2438"; g.fillRect(8090, GROUND - 190, 18, 24); if (lit) { g.save(); g.globalCompositeOperation = "lighter"; const gl = g.createRadialGradient(8099, GROUND - 178, 1, 8099, GROUND - 178, 70); gl.addColorStop(0, "rgba(255,210,120,0.5)"); gl.addColorStop(1, "rgba(255,210,120,0)"); g.fillStyle = gl; g.fillRect(8020, GROUND - 250, 160, 160); g.restore(); } }

  // rings
  const compass = upgradeLv(G, "compass");
  for (const r of W.rings) if (r.x > left - 80 && r.x < right + 80) drawRing(g, r, G.ringCool[r.id] ?? 0, t, compass >= 3 && r.lane);
  // compass glints on shortcuts
  if (compass >= 2 && !o.reduced) {
    const glints: [number, number][] = [[W.towerHole.x + W.towerHole.w / 2, W.towerHole.y + 30], ...W.portals.map((p) => [p.x, p.mouthY] as [number, number]), ...W.tunnels.map((tn) => [(tn.sh1[0] + tn.sh1[1]) / 2, GROUND - 20] as [number, number]), ...W.windTunnels.map((z) => [z.x + 40, z.y + z.h / 2] as [number, number])];
    for (const [gx, gy] of glints) if (Math.hypot(gx - G.p.x, gy - G.p.y) < 600) { const k = 0.5 + 0.5 * Math.sin(t * 4 + gx); g.fillStyle = `rgba(255,240,180,${0.35 + 0.5 * k})`; g.beginPath(); for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + t; g.moveTo(gx, gy); g.lineTo(gx + Math.cos(a) * (9 + 5 * k), gy + Math.sin(a) * (9 + 5 * k)); } g.lineWidth = 2; g.strokeStyle = g.fillStyle; g.stroke(); }
  }

  // hazards
  const hz = hazards(G);
  for (const b of hz.books) if (b.x > left && b.x < right) { g.save(); g.translate(b.x, b.y); g.rotate(Math.sin(b.ang) * 0.5); g.fillStyle = ["#7a4a3a", "#3a5a7a", "#6a3a6a"][Math.floor(b.x) % 3]; rr(g, -11, -8, 22, 16, 2); g.fill(); g.fillStyle = "#f0e6c8"; g.fillRect(-9, -6, 18, 3); g.beginPath(); g.moveTo(-11, 0); g.quadraticCurveTo(0, -12 + Math.sin(t * 6 + b.ang) * 4, 11, 0); g.strokeStyle = "#f0e6c8"; g.lineWidth = 1.6; g.stroke(); g.restore(); }
  for (const c of hz.cells) if (c.x > left - 100 && c.x < right + 100) { g.fillStyle = "rgba(70,80,120,0.85)"; for (const [x, y, r] of [[-30, 6, 28], [0, -8, 34], [30, 6, 26], [0, 14, 30]]) { g.beginPath(); g.arc(c.x + x, c.y + y, r, 0, TAU); g.fill(); } g.strokeStyle = "#ffe98a"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(c.x, c.y + 10); g.lineTo(c.x - 8, c.y + 34); g.lineTo(c.x + 4, c.y + 30); g.lineTo(c.x - 6, c.y + 54); g.stroke(); }
  // levity bubbles
  for (const l of G.levity) { g.strokeStyle = `rgba(200,160,255,${0.5 * clamp(l.life / 2)})`; g.fillStyle = "rgba(180,130,255,0.12)"; g.lineWidth = 2; g.beginPath(); g.arc(l.x, l.y, l.r, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.moveTo(l.x, l.y + 16); g.lineTo(l.x, l.y - 16); g.lineTo(l.x - 6, l.y - 8); g.moveTo(l.x, l.y - 16); g.lineTo(l.x + 6, l.y - 8); g.stroke(); }
  // frogs
  for (const fr of G.frogs) { ell(g, fr.x, fr.y, 7, 5, "#6ab04a"); ell(g, fr.x + 4, fr.y - 4, 2.5, 2.5, "#fff"); g.fillStyle = "#6ab04a"; g.fillRect(fr.x - 8, fr.y + 2, 4, 5); }
  // birds
  for (let i = 0; i < G.flocks.length; i++) { const f2 = G.flocks[i]; if (f2.x > left - 80 && f2.x < right + 80) drawBirdsFlock(g, G, i, t); }
  void flockPos;

  // package shadow on the ground
  const pk = G.pkg;
  if (pk && pk.def.id === "shadow") { const gy = terrainY(G.p.x); g.fillStyle = "rgba(10,6,20,0.7)"; g.beginPath(); g.ellipse(G.p.x, gy - 3, 40 + (GROUND - G.p.y) * 0.04, 8, 0, 0, TAU); g.fill(); g.strokeStyle = "rgba(10,6,20,0.5)"; g.lineWidth = 2; g.setLineDash([5, 6]); g.beginPath(); g.moveTo(G.p.x, G.p.y + 20); g.lineTo(G.p.x, gy - 3); g.stroke(); g.setLineDash([]); }
  // yesterday: afterimages
  if (pk && pk.def.id === "yesterday") for (let i = 0; i < G.ghost.length; i++) { const gh = G.ghost[i]; g.globalAlpha = (i / G.ghost.length) * 0.35; g.fillStyle = "#c8b48a"; g.beginPath(); g.arc(gh.x, gh.y, 10, 0, TAU); g.fill(); } g.globalAlpha = 1;
  // reflection
  if (pk && pk.def.id === "reflection" && G.quest?.phase === "carry") { g.save(); g.translate(G.p.x + (pk.s.rx ?? 0), G.p.y + (pk.s.ry ?? 0)); drawWitch(g, G, t, { alpha: 0.5, tint: "#7ac8d8", mirror: true }); g.restore(); g.strokeStyle = "rgba(160,220,235,0.35)"; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(G.p.x, G.p.y); g.lineTo(G.p.x + (pk.s.rx ?? 0), G.p.y + (pk.s.ry ?? 0)); g.stroke(); g.setLineDash([]); }

  // the witch & her package
  g.save(); g.translate(G.p.x, G.p.y);
  const bigR = G.p.rad / 15;
  if (G.p.invuln > 0 && !o.reduced && Math.floor(t * 20) % 2) g.globalAlpha = 0.6;
  drawWitch(g, G, t);
  g.globalAlpha = 1;
  if (pk && G.quest?.phase === "carry" && pk.stolen <= 0) {
    const sway = Math.sin(t * 3 + pk.def.mass) * 0.12 - G.p.vx / 1800;
    g.save(); g.translate(-8 * G.p.face, 6); g.rotate(sway);
    g.strokeStyle = "#8a6a3a"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16 * bigR); g.stroke();
    g.translate(0, 26 * bigR);
    const s = 10 * bigR;
    drawPackage(g, pk.def.id, s, t, pk.s, night ? 1 : 0);
    if (pk.def.id === "sleepcloud" && pk.s.awake) { g.strokeStyle = "rgba(255,255,255,0.0)"; }
    if (o.contrast) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.setLineDash([3, 3]); g.strokeRect(-s - 4, -s - 4, s * 2 + 8, s * 2 + 8); g.setLineDash([]); }
    g.restore();
  }
  g.restore();

  // lightning
  for (const b of G.bolts) {
    if (b.warn > 0) { const k = 1 - b.warn / 1.1; g.strokeStyle = `rgba(255,240,150,${0.5 + 0.4 * Math.sin(t * 20)})`; g.lineWidth = 2; g.beginPath(); g.arc(b.x, Math.min(b.y, GROUND), 18 + k * 10, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(b.x - 24, b.y - 8); g.lineTo(b.x + 24, b.y - 8); g.stroke(); continue; }
    g.strokeStyle = "#f4f8ff"; g.lineWidth = 4; g.lineJoin = "round"; g.beginPath(); let x = b.x + (hash(b.seed * 9) - 0.5) * 60; g.moveTo(x, top - 40);
    for (let y = top; y < b.y; y += 40) { x += (hash(y + b.seed * 100) - 0.5) * 50; g.lineTo(x, y); }
    g.lineTo(b.x, b.y); g.stroke(); g.strokeStyle = "rgba(160,190,255,0.5)"; g.lineWidth = 10; g.stroke();
  }

  // particles
  for (const q2 of G.parts) {
    if (q2.x < left || q2.x > right || q2.y < top - 40 || q2.y > bottom + 40) continue;
    const k = clamp(q2.life / q2.max);
    g.globalAlpha = q2.kind === "smoke" ? k * 0.5 : q2.kind === "trail" ? k * 0.7 : k;
    g.fillStyle = q2.color; g.strokeStyle = q2.color;
    switch (q2.kind) {
      case "rain": g.lineWidth = 1.3; g.beginPath(); g.moveTo(q2.x, q2.y); g.lineTo(q2.x - q2.vx * 0.02, q2.y - q2.vy * 0.03); g.stroke(); break;
      case "snow": g.beginPath(); g.arc(q2.x, q2.y, q2.size, 0, TAU); g.fill(); break;
      case "smoke": case "trail": g.beginPath(); g.arc(q2.x, q2.y, q2.size * (2 - k), 0, TAU); g.fill(); break;
      case "note": g.font = `${q2.size * 3}px serif`; g.textAlign = "center"; g.fillText("♪", q2.x, q2.y); break;
      case "star": { g.save(); g.translate(q2.x, q2.y); g.rotate(q2.rot); g.fillRect(-q2.size / 2, -q2.size / 2, q2.size, q2.size); g.restore(); break; }
      case "leaf": case "feather": case "paper": g.save(); g.translate(q2.x, q2.y); g.rotate(q2.rot); g.beginPath(); g.ellipse(0, 0, q2.size * 1.6, q2.size * 0.7, 0, 0, TAU); g.fill(); g.restore(); break;
      default: g.beginPath(); g.arc(q2.x, q2.y, q2.size, 0, TAU); g.fill();
    }
  }
  g.globalAlpha = 1;

  /* ---- screen-space overlays ---- */
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const px = wx2sx(G.p.x), py = wy2sy(G.p.y);
  if (grey > 0.05 && wthr.fog < 0.1) { g.fillStyle = `rgba(150,160,180,${wthr.rain * 0.12})`; g.fillRect(0, 0, cw, ch); }
  // night: dark everywhere except a soft lantern glow
  if (light < 0.6) {
    const a = clamp((0.6 - light) / 0.55) * 0.72;
    const glow = (pk?.def.id === "moonlight" && !pk.stolen ? 1.6 : 1) * 300 * sc;
    const dg = g.createRadialGradient(px, py, 30 * sc, px, py, glow);
    dg.addColorStop(0, "rgba(6,8,28,0.0)"); dg.addColorStop(0.5, `rgba(6,8,28,${a * 0.55})`); dg.addColorStop(1, `rgba(6,8,28,${a})`);
    g.fillStyle = dg; g.fillRect(0, 0, cw, ch);
  }
  if (wthr.fog > 0.05) {
    const lamp = pk?.def.id === "moonlight" && !pk.stolen ? 1 + 1.2 * clamp(1 - light) * (1 - (pk.s.fade ?? 0)) : 1;
    const r1 = (360 - wthr.fog * 140) * sc * lamp;
    const fg = g.createRadialGradient(px, py, 30 * sc, px, py, r1);
    const fc = night ? "34,40,64" : "206,212,224";
    fg.addColorStop(0, `rgba(${fc},0)`); fg.addColorStop(1, `rgba(${fc},${0.92 * wthr.fog})`);
    g.fillStyle = fg; g.fillRect(0, 0, cw, ch);
  }
  if (wthr.snow > 0.1) { g.fillStyle = `rgba(235,242,255,${0.1 * wthr.snow})`; g.fillRect(0, 0, cw, ch); }
  if (pk?.def.id === "dream" && !pk.stolen) { const dg2 = g.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.8); dg2.addColorStop(0, "rgba(200,160,255,0)"); dg2.addColorStop(1, "rgba(200,160,255,0.28)"); g.fillStyle = dg2; g.fillRect(0, 0, cw, ch); }
  if (G.invertWarn > 0 || G.invertT > 0) { const k = G.invertT > 0 ? 0.25 : 0.12 + 0.1 * Math.sin(t * 30); g.strokeStyle = `rgba(190,120,255,${k * 2})`; g.lineWidth = 10; g.strokeRect(5, 5, cw - 10, ch - 10); }
  if (G.bolts.some((b) => b.life > 0.15) && !o.reduced) { g.fillStyle = "rgba(230,240,255,0.28)"; g.fillRect(0, 0, cw, ch); }
  if (G.p.stun > 0) { g.fillStyle = "rgba(200,220,255,0.12)"; g.fillRect(0, 0, cw, ch); }

  // compass arrow
  const hudT = G.quest && G.quest.phase !== "result" ? W.pads[G.quest.phase === "pickup" ? G.quest.offer.from : G.quest.offer.to] : null;
  if (hudT && compass >= 1) {
    const dx = hudT.x - G.p.x, dy = hudT.y - G.p.y, d = Math.hypot(dx, dy);
    if (d > 260) {
      const a = Math.atan2(dy, dx), rad = 74 * Math.min(1.2, sc);
      g.save(); g.translate(px + Math.cos(a) * rad, py + Math.sin(a) * rad); g.rotate(a);
      g.fillStyle = "rgba(255,226,150,0.85)"; g.strokeStyle = "rgba(30,20,50,0.7)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-2, 0); g.lineTo(-6, 7); g.closePath(); g.stroke(); g.fill(); g.restore();
    }
  }
}

function isMid(f: number) { return f > 0.945 || f < 0.055; }
