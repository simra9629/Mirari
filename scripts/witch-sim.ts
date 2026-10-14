import { buildWorld } from "../src/experiences/witch-delivery/world";
import { createGame, advance, acceptOffer, defaultSave, setWeather, snapshot, drainEvents, type Game, type Offer } from "../src/experiences/witch-delivery/engine";
import { PACKAGES, LOC, CUSTOMER, DAY_LEN, type Weather, type LocId, type PkgId } from "../src/experiences/witch-delivery/data";

const world = buildWorld(11);
function offer(g: Game, pkg: PkgId, from: LocId, to: LocId): Offer {
  const a = world.pads[from], b = world.pads[to];
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  return { id: 99, pkg, from, to, customer: LOC[to].customer, constraint: { kind: "time", text: "t", limit: 60 }, objective: null, par: Math.round(dist * 1.25 / 264 + 9), dist, reward: 50, tier: 0 };
}
function pilot(g: Game, tx: number, ty: number) {
  const p = g.p, cruise = 230;
  const dx = tx - p.x, dy = ty - p.y;
  let ix = 0, iy = 0, boost = false;
  if (Math.abs(dx) > 160) {
    if (p.y > cruise + 60) { iy = -1; ix = p.y < 440 ? Math.sign(dx) * 0.8 : 0; }
    else { ix = Math.sign(dx); iy = Math.max(-1, Math.min(1, (cruise - p.y) * 0.03)); boost = Math.abs(dx) > 1800; }
  } else {
    const slow = Math.min(1, Math.hypot(dx, dy) / 130);
    ix = Math.max(-1, Math.min(1, dx / 90)) * Math.max(0.35, slow);
    iy = Math.max(-1, Math.min(1, dy / 90)) * Math.max(0.35, slow);
    if (Math.abs(dx) > 20) ix = Math.sign(ix) * Math.max(Math.abs(ix), 0.8);
  }
  g.input.x = ix; g.input.y = iy; g.input.boost = boost;
  g.input.flourish = false;
}
function run(pkg: PkgId, wx: Weather, from: LocId, to: LocId, clock = 0.3) {
  const save = defaultSave(); save.delivered = 30;
  const g = createGame(world, save, 5);
  g.clock = DAY_LEN * clock;
  setWeather(g, wx, true);
  g.offers = [offer(g, pkg, from, to)];
  acceptOffer(g, 99);
  const target = () => { const q = g.quest!; return world.pads[q.phase === "pickup" ? q.offer.from : q.offer.to]; };
  let t = 0;
  while (t < 420 && !g.result) {
    const pad = target(); pilot(g, pad.x, pad.y);
    advance(g, 1 / 30); t += 1 / 30;
    if (!isFinite(g.p.x + g.p.y + g.p.vx + g.p.vy)) throw new Error("NaN " + pkg);
    drainEvents(g);
    if (process.env.DBG && Math.round(t * 30) % 30 === 0 && t > 14) console.log(t.toFixed(0), Math.round(g.p.x), Math.round(g.p.y), Math.round(g.p.vx), Math.round(g.p.vy), g.quest?.phase, g.hint, g.p.stun.toFixed(1), g.input.x.toFixed(2), g.input.y.toFixed(2), g.input.boost);
    if (g.pkg?.def.id === "bigbox" && g.pkg.s.size > 1.6 && false) break;
  }
  const r = g.result;
  return { ok: !!r, t, stars: r?.stars, q: r ? +r.quality.toFixed(2) : 0, title: r?.title, route: r?.route, thefts: g.quest?.thefts, bumps: g.quest?.bumps, x: Math.round(g.p.x), y: Math.round(g.p.y) };
}
const mode = process.argv[2] ?? "all";
if (mode === "one") { console.log(run(process.argv[3] as PkgId, process.argv[4] as Weather, process.argv[5] as LocId, process.argv[6] as LocId, 0.6)); }
if (mode === "all") {
  for (const p of PACKAGES) {
    const res = run(p.id, "clear", "post", "library");
    console.log(p.id.padEnd(11), res.ok ? `ok ${res.t.toFixed(0)}s ★${res.stars} q${res.q} "${res.title}" ${res.route}` : `FAILED at t=${res.t.toFixed(0)} pos ${res.x},${res.y} thefts ${res.thefts} bumps ${res.bumps}`);
  }
}
if (mode === "weather") {
  for (const wx of ["rain", "wind", "fog", "snow", "thunder", "magic"] as Weather[]) {
    const out: string[] = [];
    for (const [pk, a, b] of [["letter", "post", "manor"], ["cake", "bakery", "lighthouse"], ["frogs", "cottage", "oak"], ["ocean", "fishdock", "academy"]] as [PkgId, LocId, LocId][]) {
      const r = run(pk, wx, a, b, 0.6);
      out.push(`${pk}:${r.ok ? r.t.toFixed(0) + "s★" + r.stars : "FAIL@" + r.x + "," + r.y}`);
    }
    console.log(wx.padEnd(8), out.join("  "));
  }
}
if (mode === "legs") {
  // every landmark reachable both as pickup and dropoff, in all directions
  const ids = Object.keys(world.pads) as LocId[];
  let bad = 0, n = 0;
  for (const a of ids) for (const b of ids) { if (a === b) continue; const r = run("letter", "clear", a, b); n++; if (!r.ok) { bad++; console.log("FAIL", a, "->", b, r.x, r.y, r.t.toFixed(0)); } }
  console.log(`legs: ${n - bad}/${n} ok`);
}
if (mode === "night") {
  const save = defaultSave(); save.delivered = 30; save.secrets.midnight = true;
  const g = createGame(world, save, 5);
  g.clock = DAY_LEN * 0.4; setWeather(g, "clear", true);
  const o = offer(g, "moonlight", "moonwell", "warehouse"); o.customer = "hollow"; o.constraint = { kind: "night", text: "Midnight only", limit: 60 };
  g.offers = [o]; acceptOffer(g, 99);
  let t = 0, hint = "";
  while (t < 200 && !g.result) {
    const q = g.quest!; const pad = world.pads[q.phase === "pickup" ? q.offer.from : q.offer.to];
    pilot(g, pad.x, pad.y); advance(g, 1 / 30); t += 1 / 30; if (g.hint) hint = g.hint;
    if (q.phase === "carry" && Math.hypot(g.p.x - pad.x, g.p.y - pad.y) < 40 && t > 20 && !g.result && g.clock % DAY_LEN < DAY_LEN * 0.9) g.clock = DAY_LEN * 0.99;
  }
  console.log("night delivery:", !!g.result, "hint seen:", hint, "stars", g.result?.stars);
}
