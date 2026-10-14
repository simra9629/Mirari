import { createWorld, advance, placeItem, census, arrivalReport } from "../src/experiences/bug-hotel/engine";
import { CH, CHAMBERS, SPECIES, DAY_LEN, type ChamberId, type ItemKind } from "../src/experiences/bug-hotel/data";

const mode = process.argv[2] ?? "bot";

function bot(w: any, rich = true) {
  // a plausible player: keep adding things from what's unlocked
  for (const ch of CHAMBERS) {
    if (ch.stage > w.stage) continue;
    const have = (k: ItemKind) => w.cs[ch.id].n[k];
    const want: [ItemKind, number][] = [["bark", 1], ["leaves", 2], ["soil", 1], ["seeds", 1], ["twigs", 3], ["stones", 3]];
    if (w.stage >= 2) want.push(["flower", 2], ["fruit", 1], ["nectar", 1], ["shade", 1]);
    if (w.stage >= 3) want.push(["water", ch.id === "water" ? 3 : 1], ["moss", 3], ["moisture", 1]);
    if (w.stage >= 4) want.push(["paleflower", 1], ["light", 1]);
    if (w.stage >= 5) want.push(["deadwood", 2], ["fungi", 1], ["hollowwood", 1]);
    for (const [k, n] of want) {
      if (!rich && n > 1) continue;
      if (have(k) < n) placeItem(w, k, ch.id, ch.x + 20 + Math.random() * (ch.w - 40), ch.y + ch.h - 20);
    }
  }
}

if (mode === "bot") {
  const w = createWorld(7);
  w.view = { x0: 0, y0: 0, x1: 960, y1: 720, zoom: 2 };
  let maxC = 0, t0 = Date.now();
  const days = Number(process.argv[3] ?? 40);
  for (let d = 0; d < days; d++) {
    for (let k = 0; k < 8; k++) { bot(w); advance(w, DAY_LEN / 8); }
    const c = census(w);
    const n = Object.values(c).reduce((a, b) => a + b, 0);
    maxC = Math.max(maxC, n);
    for (const cr of w.creatures) if (!isFinite(cr.x) || !isFinite(cr.y)) throw new Error("NaN pos " + cr.sp);
    if (d % 4 === 3) console.log(`day ${d + 1} stage ${w.stage} ${w.season} ${w.weather} total ${n} disc ${Object.keys(w.journal).length}`, JSON.stringify(c));
  }
  console.log("ms", Date.now() - t0, "max pop", maxC);
  console.log("discovered:", Object.keys(w.journal).join(","));
  console.log("missing:", SPECIES.filter((s) => !w.journal[s.id]).map((s) => s.id).join(","));
  console.log(w.log.slice(0, 25).reverse().map((l: any) => `${(l.t / DAY_LEN).toFixed(1)} ${l.text}`).join("\n"));
}

if (mode === "empty") {
  const w = createWorld(3);
  advance(w, DAY_LEN * 3);
  console.log("empty hotel after 3 days: creatures", w.creatures.length, "disc", Object.keys(w.journal).length);
  placeItem(w, "bark", "bark", 470, 420); placeItem(w, "soil", "bark", 440, 420); placeItem(w, "seeds", "bark", 500, 420); placeItem(w, "leaves", "bark", 460, 400);
  for (let i = 0; i < 20; i++) { advance(w, 30); }
  console.log("after placing 4 items + 10 min:", JSON.stringify(census(w)), "stage", w.stage);
}

if (mode === "rare") {
  // force the right conditions for each rare/strange species and see if it can arrive
  const trials: Record<string, (w: any) => void> = {};
  const put = (w: any, ch: ChamberId, kinds: [ItemKind, number][]) => { const c = CH[ch]; for (const [k, n] of kinds) for (let i = 0; i < n; i++) placeItem(w, k, ch, c.x + 20 + Math.random() * (c.w - 40), c.y + c.h - 20); };
  const results: string[] = [];
  const runTrial = (name: string, id: string, build: (w: any) => void, force: (w: any) => void, days = 12) => {
    const w = createWorld(11);
    w.stage = 6; w.view = { x0: 0, y0: 0, x1: 960, y1: 720, zoom: 2 };
    for (const k of ["ladybird", "ant", "beetle", "woodlouse", "caterpillar", "snail", "moth", "butterfly", "bee", "orbspider", "grasshopper", "earwig", "dragonfly", "glowworm"] as const) w.journal[k as any] = { sp: k, firstT: 0, firstCh: "bark", snapshot: "", obs: 9, named: true, ate: true, behavior: true, relation: true, bred: true, phases: 15, chambers: 1023, peak: 1, boomed: false } as any;
    build(w);
    let hit = -1;
    for (let s = 0; s < days * 24; s++) {
      force(w);
      advance(w, 10);
      if (w.creatures.some((c: any) => c.sp === id)) { hit = s * 10 / DAY_LEN; break; }
    }
    results.push(`${name.padEnd(14)} ${hit >= 0 ? "arrived after " + hit.toFixed(1) + " days" : "NEVER (" + days + " days)"}`);
    if (hit < 0) for (let k = 0; k < 3; k++) { force(w); advance(w, 7); } if (hit < 0) results.push("   " + arrivalReport(w, id as any).join("\n   "));
  };
  const nightClear = (w: any) => { const t = w.t % DAY_LEN; if (t < DAY_LEN * 0.74 || t > DAY_LEN * 0.95) w.t += DAY_LEN * 0.76 - t + (t > DAY_LEN * 0.95 ? DAY_LEN : 0); w.weatherLeft = 100; };
  const setWx = (w: any, wx: string) => { w.weather = wx; w.weatherLeft = 50; };
  const base = (w: any) => { put(w, "bark", [["bark", 2], ["soil", 3], ["stones", 3], ["twigs", 3], ["leaves", 3], ["seeds", 2], ["fruit", 1]]); };
  runTrial("mantis", "mantis", (w) => { base(w); put(w, "leaf", [["twigs", 3], ["leaves", 3], ["flower", 3], ["warm", 2], ["nectar", 2], ["seeds", 2]]); put(w, "balcony", [["twigs", 3], ["flower", 3], ["leaves", 2]]); }, (w) => setWx(w, "heat"), 20);
  runTrial("stag", "stag", (w) => { put(w, "rotting", [["deadwood", 3], ["fungi", 2], ["bark", 2], ["hollowwood", 1]]); put(w, "bark", [["bark", 2], ["soil", 3], ["leaves", 3], ["fruit", 2]]); }, () => {}, 20);
  runTrial("jewelspider", "jewelspider", (w) => { put(w, "balcony", [["twigs", 4], ["flower", 3], ["leaves", 2], ["warm", 1]]); put(w, "leaf", [["twigs", 4], ["flower", 3], ["leaves", 3], ["warm", 1], ["nectar", 1]]); base(w); }, (w) => setWx(w, "heat"), 25);
  runTrial("glowworm", "glowworm", (w) => { put(w, "moss", [["moss", 4], ["water", 2], ["stones", 2], ["moisture", 1]]); }, nightClear, 14);
  runTrial("veilmoth", "veilmoth", (w) => { put(w, "leaf", [["leaves", 5], ["flower", 3], ["shade", 1], ["nectar", 1]]); put(w, "canopy", [["leaves", 5], ["flower", 3], ["nectar", 1]]); }, (w) => { nightClear(w); setWx(w, "rain"); }, 20);
  runTrial("goldbeetle", "goldbeetle", (w) => { put(w, "balcony", [["stones", 4], ["warm", 3], ["bark", 1], ["seeds", 1]]); put(w, "bark", [["bark", 2], ["soil", 3], ["stones", 3], ["leaves", 3], ["fruit", 3]]); w.journal.beetle = { sp: "beetle", firstT: 0, firstCh: "bark", snapshot: "", obs: 9, named: true } as any; }, (w) => { setWx(w, "heat"); const t = w.t % DAY_LEN; if (t < DAY_LEN * 0.2 || t > DAY_LEN * 0.5) w.t += DAY_LEN * 0.25 - t + (t > DAY_LEN * 0.5 ? DAY_LEN : 0); }, 25);
  runTrial("moonmoth", "moonmoth", (w) => { put(w, "canopy", [["paleflower", 3], ["leaves", 3], ["nectar", 2], ["twigs", 1]]); }, (w) => { nightClear(w); setWx(w, "clear"); }, 25);
  runTrial("glassbeetle", "glassbeetle", (w) => { put(w, "balcony", [["water", 2], ["stones", 4], ["bark", 1], ["flower", 1]]); }, (w) => { const t = w.t % DAY_LEN; if (w.weather !== "rain" && w.rain < 0.2 && t > DAY_LEN * 0.2 && t < DAY_LEN * 0.5 && w.lastRainEnd < w.t - 5) { /* ok */ } if (Math.floor(w.t / 60) % 3 === 0) setWx(w, "rain"); else if (w.weather === "rain") setWx(w, "clear"); }, 25);
  runTrial("clockwork", "clockwork", (w) => { put(w, "hollow", [["twigs", 4], ["stones", 3], ["hollowwood", 2], ["moisture", 0], ["bark", 1]]); }, (w) => { const t = w.t % DAY_LEN; if (t < DAY_LEN * 0.56 || t > DAY_LEN * 0.7) w.t += DAY_LEN * 0.58 - t + (t > DAY_LEN * 0.7 ? DAY_LEN : 0); }, 40);
  runTrial("starbeetle", "starbeetle", (w) => { put(w, "canopy", [["leaves", 3], ["bark", 1], ["cool", 2]]); }, (w) => { nightClear(w); setWx(w, "cold"); }, 25);
  runTrial("wisp", "wisp", (w) => { put(w, "moss", [["moss", 4], ["water", 1], ["moisture", 2]]); const m = w.items.find((i: any) => i.kind === "moss"); if (m) m.kind = "livingmoss"; }, () => {}, 20);
  runTrial("pocketwhale", "pocketwhale", (w) => { put(w, "water", [["water", 3]]); for (const k of ["ant", "beetle", "woodlouse", "snail", "ladybird", "caterpillar", "butterfly", "moth", "bee", "orbspider", "grasshopper", "earwig"] as const) { w.creatures.push({ ...({} as any), id: w.nextId++, sp: k, ch: "bark", x: 480, y: 400, stage: "adult", leaving: false, dead: false, hunger: 0, comfort: 1, stress: 0, age: 0, life: 99, scale: 1, mode: "wait", dormant: true, hidden: true, fade: 1, timer: 99, pause: 99, tx: 480, ty: 400, carrying: "", webId: 0, heading: 0, wob: 0, cycle: 0, chk: 9, mtimer: 0, orbitA: 0, visitorUntil: 0, variant: 0.5, tItem: 0, tCre: 0, res: "", homeX: 0, homeY: 0, homeItem: 0, hasHome: false, growth: 0, transitTo: "", hopT: 0, lift: 0, speedMul: 1, caughtBy: 0, seenChambers: 1, born: 0, pollen: false }); } }, (w) => { nightClear(w); for (const c of w.creatures) if (c.dormant && c.mode === "wait") { c.comfort = 1; c.stress = 0; c.hunger = 0; c.age = 0; } }, 150);
  console.log(results.join("\n"));
}
