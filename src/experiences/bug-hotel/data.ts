/**
 * Bug Hotel — authored data.
 *
 * Everything the simulation reasons about lives here as *properties*: what a
 * chamber is like, what an item contributes, what a creature needs. No creature
 * is individually scripted — behaviour is generated from these bundles by the
 * engine (see engine.ts), inside boundaries set by this file.
 */

export const WORLD_W = 960;
export const WORLD_H = 720;
/** Simulated seconds in one full day. */
export const DAY_LEN = 240;

export type Phase = "morning" | "day" | "evening" | "night";
export const PHASES: Phase[] = ["morning", "day", "evening", "night"];
export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
export type Weather = "clear" | "rain" | "heat" | "cold" | "wind" | "storm";

/* ------------------------------------------------------------------ */
/* Chambers                                                            */
/* ------------------------------------------------------------------ */

export type ChamberId =
  | "bark" | "leaf" | "balcony" | "canopy" | "moss"
  | "water" | "root" | "hollow" | "rotting" | "tunnel";

export interface ChamberDef {
  id: ChamberId;
  name: string;
  /** Hotel stage at which this chamber opens (1–6). */
  stage: number;
  x: number; y: number; w: number; h: number;
  /** Open to sky: feels weather fully. */
  open: boolean;
  /** Baseline climate before items, weather and time. 0..1 */
  temp: number; humid: number; light: number;
  blurb: string;
  adj: ChamberId[];
}

export const CHAMBERS: ChamberDef[] = [
  { id: "canopy", name: "Canopy Garden", stage: 4, x: 260, y: 80, w: 440, h: 110, open: true, temp: 0.55, humid: 0.4, light: 0.95, blurb: "Open to the sky. Wind finds it first.", adj: ["balcony", "leaf"] },
  { id: "balcony", name: "Flower Balcony", stage: 2, x: 260, y: 200, w: 210, h: 120, open: true, temp: 0.55, humid: 0.4, light: 0.85, blurb: "A sunny ledge, good for things that bloom.", adj: ["canopy", "leaf", "hollow", "bark"] },
  { id: "leaf", name: "Leaf Garden", stage: 2, x: 480, y: 200, w: 220, h: 120, open: true, temp: 0.5, humid: 0.5, light: 0.7, blurb: "Dappled light and a lot of green.", adj: ["canopy", "balcony", "bark", "rotting"] },
  { id: "hollow", name: "Hollow", stage: 5, x: 260, y: 330, w: 140, h: 120, open: false, temp: 0.45, humid: 0.5, light: 0.18, blurb: "Deep, dry-ish, and very quiet.", adj: ["balcony", "bark", "moss"] },
  { id: "bark", name: "Bark Room", stage: 1, x: 410, y: 330, w: 140, h: 120, open: false, temp: 0.5, humid: 0.5, light: 0.35, blurb: "The entrance. Sheltered, a little damp, always dim.", adj: ["balcony", "leaf", "hollow", "rotting", "water"] },
  { id: "rotting", name: "Rotting Wood Chamber", stage: 5, x: 560, y: 330, w: 140, h: 120, open: false, temp: 0.5, humid: 0.7, light: 0.12, blurb: "Soft, crumbling, quietly busy.", adj: ["leaf", "bark", "root"] },
  { id: "moss", name: "Moss Chamber", stage: 3, x: 260, y: 460, w: 140, h: 110, open: false, temp: 0.4, humid: 0.7, light: 0.2, blurb: "Cool, green, and slightly glowing in the corners.", adj: ["hollow", "water", "tunnel"] },
  { id: "water", name: "Water Pocket", stage: 3, x: 410, y: 460, w: 140, h: 110, open: false, temp: 0.4, humid: 0.8, light: 0.2, blurb: "Where the tree keeps its rain.", adj: ["bark", "moss", "root", "tunnel"] },
  { id: "root", name: "Root Cellar", stage: 3, x: 560, y: 460, w: 140, h: 110, open: false, temp: 0.35, humid: 0.65, light: 0.1, blurb: "Cold, dark, and held together by roots.", adj: ["rotting", "water", "tunnel"] },
  { id: "tunnel", name: "Underground Tunnel", stage: 6, x: 260, y: 580, w: 440, h: 70, open: false, temp: 0.4, humid: 0.6, light: 0.05, blurb: "A passage that was not there yesterday.", adj: ["moss", "water", "root"] },
];

export const CH = Object.fromEntries(CHAMBERS.map((c) => [c.id, c])) as Record<ChamberId, ChamberDef>;

export const STAGES: { n: number; name: string; at: number; blurb: string }[] = [
  { n: 1, name: "Entrance", at: 0, blurb: "A single small chamber." },
  { n: 2, name: "Garden", at: 2, blurb: "Plants and flowers become available." },
  { n: 3, name: "Root System", at: 4, blurb: "Moisture-loving creatures. Summer begins to exist." },
  { n: 4, name: "Canopy", at: 7, blurb: "Flying insects. Autumn begins to exist." },
  { n: 5, name: "Deep Hollow", at: 10, blurb: "Rare and nocturnal creatures. Winter begins to exist." },
  { n: 6, name: "Hidden Chamber", at: 14, blurb: "Strange species become possible." },
];

/** Where a point inside `from` sits, at the edge facing `to`. */
export function doorPoint(from: ChamberId, to: ChamberId): { x: number; y: number } {
  const a = CH[from], b = CH[to];
  const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a.w, b.x + b.w);
  const oy0 = Math.max(a.y, b.y), oy1 = Math.min(a.y + a.h, b.y + b.h);
  const stacked = a.y + a.h <= b.y || b.y + b.h <= a.y;
  if (stacked && ox1 > ox0) {
    return { x: (ox0 + ox1) / 2, y: a.y < b.y ? a.y + a.h - 8 : a.y + 8 };
  }
  return { x: a.x < b.x ? a.x + a.w - 8 : a.x + 8, y: (oy0 + oy1) / 2 };
}

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

export type ItemKind =
  | "bark" | "twigs" | "leaves" | "stones" | "soil" | "hollowwood" | "moss"
  | "seeds" | "flower" | "paleflower" | "fruit" | "nectar" | "deadwood" | "fungi"
  | "water" | "shade" | "light" | "moisture" | "warm" | "cool" | "livingmoss";

export type ItemGroup = "Structure" | "Food" | "Feature";

export interface ItemDef {
  id: ItemKind;
  label: string;
  group: ItemGroup;
  stage: number;
  /** Not offered in the build tray — it only ever appears on its own. */
  hidden?: boolean;
  desc: string;
  /** floor: sits on the ground band · wall: anywhere · air: upper half */
  anchor: "floor" | "wall" | "air";
  shelter: number;
  moist: number;
  shade: number;
  warm: number;
  light: number;
}

const I = (d: ItemDef) => d;
export const ITEMS: ItemDef[] = [
  I({ id: "bark", label: "Bark", group: "Structure", stage: 1, desc: "Curled plates to hide under.", anchor: "floor", shelter: 0.5, moist: 0.02, shade: 0.02, warm: 0, light: 0 }),
  I({ id: "twigs", label: "Twigs", group: "Structure", stage: 1, desc: "Something to climb, perch on, or hang a web from.", anchor: "wall", shelter: 0.3, moist: 0, shade: 0, warm: 0, light: 0 }),
  I({ id: "leaves", label: "Leaves", group: "Structure", stage: 1, desc: "A living sprig. Shade, shelter, and food for the small.", anchor: "floor", shelter: 0.25, moist: 0.01, shade: 0.05, warm: 0, light: 0 }),
  I({ id: "stones", label: "Stones", group: "Structure", stage: 1, desc: "They hold the day's warmth after dark.", anchor: "floor", shelter: 0.4, moist: 0, shade: 0.02, warm: 0.02, light: 0 }),
  I({ id: "soil", label: "Soil", group: "Structure", stage: 1, desc: "Dark, loose, and a little damp.", anchor: "floor", shelter: 0.3, moist: 0.04, shade: 0, warm: 0, light: 0 }),
  I({ id: "moss", label: "Moss", group: "Structure", stage: 3, desc: "Soft, wet, and slowly spreading.", anchor: "floor", shelter: 0.3, moist: 0.05, shade: 0.03, warm: 0, light: 0 }),
  I({ id: "hollowwood", label: "Hollow wood", group: "Structure", stage: 5, desc: "A log with a room inside it.", anchor: "floor", shelter: 0.7, moist: 0.02, shade: 0.04, warm: 0, light: 0 }),

  I({ id: "seeds", label: "Seeds", group: "Food", stage: 1, desc: "A small pile. Some will be eaten, some might sprout.", anchor: "floor", shelter: 0, moist: 0, shade: 0, warm: 0, light: 0 }),
  I({ id: "flower", label: "Flower", group: "Food", stage: 2, desc: "Blooms in good light. Full of nectar.", anchor: "floor", shelter: 0.05, moist: 0, shade: 0, warm: 0, light: 0 }),
  I({ id: "fruit", label: "Fruit", group: "Food", stage: 2, desc: "Sweet, and it won't stay fresh.", anchor: "floor", shelter: 0, moist: 0.01, shade: 0, warm: 0, light: 0 }),
  I({ id: "nectar", label: "Nectar", group: "Food", stage: 2, desc: "A drop in a curled leaf. Gone quickly.", anchor: "floor", shelter: 0, moist: 0, shade: 0, warm: 0, light: 0 }),
  I({ id: "paleflower", label: "Pale flower", group: "Food", stage: 4, desc: "Opens when the light goes silver.", anchor: "floor", shelter: 0.05, moist: 0, shade: 0, warm: 0, light: 0.03 }),
  I({ id: "deadwood", label: "Decaying wood", group: "Food", stage: 5, desc: "Soft and crumbling. Something will want it.", anchor: "floor", shelter: 0.5, moist: 0.03, shade: 0.03, warm: 0, light: 0 }),
  I({ id: "fungi", label: "Fungi", group: "Food", stage: 5, desc: "Pale caps that grow where wood gives way.", anchor: "floor", shelter: 0.1, moist: 0.02, shade: 0, warm: 0, light: 0 }),

  I({ id: "water", label: "Water", group: "Feature", stage: 3, desc: "A small pool. Rain will top it up.", anchor: "floor", shelter: 0, moist: 0.12, shade: 0, warm: 0, light: 0 }),
  I({ id: "shade", label: "Shade", group: "Feature", stage: 2, desc: "A hanging screen of leaves.", anchor: "air", shelter: 0.1, moist: 0.01, shade: 1, warm: 0, light: 0 }),
  I({ id: "moisture", label: "Mist", group: "Feature", stage: 3, desc: "Fine damp that drifts and settles.", anchor: "air", shelter: 0, moist: 0.14, shade: 0, warm: 0, light: 0 }),
  I({ id: "cool", label: "Cool slab", group: "Feature", stage: 3, desc: "A smooth stone that never warms up.", anchor: "floor", shelter: 0.2, moist: 0.01, shade: 0, warm: -1, light: 0 }),
  I({ id: "light", label: "Lantern", group: "Feature", stage: 4, desc: "A small steady glow, even after dark.", anchor: "air", shelter: 0, moist: 0, shade: 0, warm: 0.1, light: 1 }),
  I({ id: "warm", label: "Warm stone", group: "Feature", stage: 4, desc: "Holds heat like a hand.", anchor: "floor", shelter: 0.2, moist: 0, shade: 0, warm: 1, light: 0 }),

  I({ id: "livingmoss", label: "Living moss", group: "Structure", stage: 99, hidden: true, desc: "It was not planted. It is spreading anyway.", anchor: "floor", shelter: 0.4, moist: 0.06, shade: 0.03, warm: 0, light: 0.35 }),
];

export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<ItemKind, ItemDef>;
/** How many things a chamber can hold. */
export const CHAMBER_ITEM_CAP = 16;

/* ------------------------------------------------------------------ */
/* Species                                                             */
/* ------------------------------------------------------------------ */

export type Rarity = "common" | "uncommon" | "rare" | "strange";
export type Move = "crawl" | "scuttle" | "flutter" | "fly" | "hover" | "hop" | "snail" | "tick" | "drift" | "stalk";
export type ResKind = "midges" | "aphids" | "detritus" | "carrion";
export type Special =
  | "web" | "hive" | "colony" | "metamorph" | "glow" | "light" | "ambush"
  | "hoverpatrol" | "sun" | "visitor";

export type SpeciesId =
  | "ladybird" | "ant" | "beetle" | "woodlouse" | "caterpillar" | "snail"
  | "butterfly" | "moth" | "grasshopper" | "bee" | "dragonfly" | "earwig" | "orbspider"
  | "mantis" | "stag" | "jewelspider" | "glowworm" | "veilmoth" | "goldbeetle"
  | "moonmoth" | "glassbeetle" | "clockwork" | "starbeetle" | "wisp" | "pocketwhale";

type Quad = [number, number, number, number];
type Range = [number, number];

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  latin: string;
  rarity: Rarity;
  /** Two letters, drawn beside creatures in high-contrast mode (colour-independent ID). */
  glyph: string;
  color: string;
  color2: string;
  size: number;
  move: Move;
  speed: number;
  /** Chance of being out and about: morning, day, evening, night. */
  active: Quad;
  temp: Range; humid: Range; light: Range;
  chambers: ChamberId[];
  food: { items?: ItemKind[]; prey?: SpeciesId[]; res?: ResKind[] };
  shelter: ItemKind[];
  shelterNeed: number;
  group: Range;
  cap: number;
  /** Seconds between breeding attempts at full comfort, or null. */
  repro: { every: number; needs?: ItemKind[]; minPop?: number; solo?: boolean } | null;
  life: Range;
  /** Per slow-tick arrival chance at full suitability. */
  rate: number;
  req?: string;
  special?: Special;
  arrive?: Phase[];
  noFood?: boolean;
  /** Shown in the journal until the creature is properly identified. */
  unknown?: { name: string; hint: string };
  text: { behavior: string; fact: string; cond: string };
}

const S = (d: SpeciesDef) => d;

export const SPECIES: SpeciesDef[] = [
  /* ---- common ---- */
  S({ id: "ant", name: "Ant", latin: "Lasius niger", rarity: "common", glyph: "An", color: "#2b2118", color2: "#4a382a", size: 4, move: "crawl", speed: 24, active: [0.8, 1, 0.8, 0.3], temp: [0.3, 0.85], humid: [0.2, 0.8], light: [0, 1],
    chambers: ["bark", "leaf", "balcony", "root", "rotting", "hollow", "tunnel"], food: { items: ["seeds", "fruit", "nectar"], res: ["carrion", "detritus"] }, shelter: ["soil", "bark", "stones"], shelterNeed: 0.3, group: [3, 5], cap: 26,
    repro: { every: 70, minPop: 3, solo: true }, life: [10, 18], rate: 0.35, special: "colony",
    text: { behavior: "Finds food, picks up a crumb, and carries it straight home to a nest of soil or stone.", fact: "A single ant can carry something fifty times its own weight, and still takes the straightest path home.", cond: "Arrives where soil, bark or stone offers a nest and there is something to carry." } }),
  S({ id: "beetle", name: "Beetle", latin: "Pterostichus madidus", rarity: "common", glyph: "Be", color: "#1c1f2e", color2: "#3b4466", size: 7, move: "crawl", speed: 12, active: [0.4, 0.5, 0.7, 1], temp: [0.3, 0.8], humid: [0.3, 0.85], light: [0, 0.7],
    chambers: ["bark", "leaf", "hollow", "rotting", "root", "moss", "tunnel"], food: { items: ["fruit", "fungi"], res: ["detritus", "carrion"] }, shelter: ["bark", "stones", "twigs", "leaves", "soil"], shelterNeed: 0.5, group: [1, 2], cap: 8,
    repro: { every: 140, minPop: 2, needs: ["soil", "leaves", "deadwood", "bark"] }, life: [12, 20], rate: 0.22,
    text: { behavior: "Heavy and unhurried. Spends the day tucked out of sight and patrols once it's dim.", fact: "Its wing cases are fused shut. It has wings under there and, mostly, doesn't use them.", cond: "Arrives where there is leaf litter to forage in and a dark corner to retreat to." } }),
  S({ id: "woodlouse", name: "Woodlouse", latin: "Oniscus asellus", rarity: "common", glyph: "Wo", color: "#6d7078", color2: "#9a9ea8", size: 5, move: "crawl", speed: 8, active: [0.6, 0.3, 0.8, 1], temp: [0.25, 0.65], humid: [0.55, 1], light: [0, 0.5],
    chambers: ["bark", "root", "moss", "rotting", "hollow", "tunnel", "water"], food: { items: ["leaves", "deadwood", "fungi"], res: ["detritus"] }, shelter: ["bark", "stones", "leaves", "moss", "deadwood"], shelterNeed: 0.6, group: [2, 3], cap: 14,
    repro: { every: 80, minPop: 2, needs: ["bark", "leaves", "deadwood", "stones", "moss"] }, life: [8, 14], rate: 0.3,
    text: { behavior: "Clusters in the dampest, darkest corner it can find, and breaks up the dead leaves.", fact: "It is not an insect. It breathes through gill-like plates and will dry out if the air is too dry.", cond: "Arrives where it is damp and dim, with something rotting to eat." } }),
  S({ id: "snail", name: "Snail", latin: "Cornu aspersum", rarity: "common", glyph: "Sn", color: "#8a6a48", color2: "#c9a77a", size: 8, move: "snail", speed: 3, active: [1, 0.3, 0.9, 0.9], temp: [0.25, 0.65], humid: [0.6, 1], light: [0, 0.6],
    chambers: ["bark", "leaf", "balcony", "moss", "water", "root", "hollow", "rotting", "tunnel"], food: { items: ["leaves", "moss", "fungi", "fruit"] }, shelter: ["bark", "stones", "moss", "leaves", "hollowwood"], shelterNeed: 0.5, group: [1, 1], cap: 6,
    repro: { every: 200, minPop: 2, needs: ["soil", "moss", "leaves"] }, life: [14, 22], rate: 0.15,
    text: { behavior: "Moves only when it is damp enough, and leaves a faint shine where it has been.", fact: "A snail's shell is part of its body. It grows a little at the rim, all its life.", cond: "Arrives where the air is wet and there are leaves or moss to graze." } }),
  S({ id: "ladybird", name: "Ladybird", latin: "Coccinella septempunctata", rarity: "common", glyph: "La", color: "#c8331f", color2: "#1b1b1b", size: 5, move: "crawl", speed: 14, active: [0.7, 1, 0.5, 0.05], temp: [0.4, 0.8], humid: [0.25, 0.7], light: [0.3, 1],
    chambers: ["bark", "leaf", "balcony", "canopy"], food: { items: ["nectar"], res: ["aphids"] }, shelter: ["leaves", "bark", "twigs"], shelterNeed: 0.5, group: [1, 2], cap: 10,
    repro: { every: 90, minPop: 2, needs: ["leaves", "flower"] }, life: [8, 14], rate: 0.2,
    text: { behavior: "Walks plant to plant, working through the aphids one by one, then tucks away to rest.", fact: "Its bright shell is a warning: it tastes terrible, and birds learn that fast.", cond: "Arrives where leaves and flowers are quietly growing aphids." } }),
  S({ id: "caterpillar", name: "Caterpillar", latin: "Pieris rapae (larva)", rarity: "common", glyph: "Ca", color: "#9bc25a", color2: "#d6e8a4", size: 6, move: "crawl", speed: 6, active: [0.9, 1, 0.6, 0.1], temp: [0.35, 0.85], humid: [0.3, 0.8], light: [0.3, 1],
    chambers: ["bark", "leaf", "balcony", "canopy"], food: { items: ["leaves"] }, shelter: ["leaves", "twigs", "bark"], shelterNeed: 0.4, group: [1, 2], cap: 8,
    repro: null, life: [6, 10], rate: 0.3, special: "metamorph",
    text: { behavior: "Eats, grows, eats some more — then hangs itself up and goes still.", fact: "Inside the chrysalis it dissolves almost entirely, then rebuilds itself as something else.", cond: "Arrives where there are fresh leaves to chew." } }),

  /* ---- uncommon ---- */
  S({ id: "butterfly", name: "Butterfly", latin: "Aglais io", rarity: "uncommon", glyph: "Bu", color: "#b8452c", color2: "#f0c15a", size: 10, move: "flutter", speed: 34, active: [0.5, 1, 0.4, 0], temp: [0.5, 0.9], humid: [0.25, 0.75], light: [0.55, 1],
    chambers: ["balcony", "leaf", "canopy"], food: { items: ["flower", "paleflower", "nectar", "fruit"] }, shelter: ["leaves", "twigs"], shelterNeed: 0.25, group: [1, 1], cap: 8,
    repro: { every: 130, minPop: 2, needs: ["leaves"] }, life: [5, 9], rate: 0.12, special: "sun",
    text: { behavior: "Flowers, then sunlight, then rest — and it will not be hurried through any of them.", fact: "It tastes with its feet. It lands on a leaf to find out whether it's good for laying eggs.", cond: "Arrives in bright chambers where there are flowers." } }),
  S({ id: "moth", name: "Moth", latin: "Noctua pronuba", rarity: "uncommon", glyph: "Mo", color: "#8d7a62", color2: "#cbb99a", size: 9, move: "flutter", speed: 30, active: [0.1, 0.05, 0.5, 1], temp: [0.3, 0.8], humid: [0.3, 0.9], light: [0, 0.9],
    chambers: ["leaf", "balcony", "canopy", "bark", "hollow"], food: { items: ["nectar", "flower", "paleflower", "fruit"] }, shelter: ["bark", "leaves", "twigs", "hollowwood"], shelterNeed: 0.4, group: [1, 2], cap: 8,
    repro: { every: 120, minPop: 2, needs: ["flower", "paleflower", "nectar"] }, life: [5, 9], rate: 0.1, special: "light", arrive: ["evening", "night"],
    text: { behavior: "Out after dusk, drawn to anything that glows, circling it for no reason it could explain.", fact: "Moths steer by keeping a light source at a fixed angle. A nearby lantern ruins the trick.", cond: "Arrives after dusk where there is nectar, and lights to circle." } }),
  S({ id: "grasshopper", name: "Grasshopper", latin: "Chorthippus brunneus", rarity: "uncommon", glyph: "Gr", color: "#7fa13b", color2: "#c9d36b", size: 11, move: "hop", speed: 42, active: [0.5, 1, 0.5, 0], temp: [0.55, 0.95], humid: [0.15, 0.6], light: [0.5, 1],
    chambers: ["leaf", "balcony", "canopy"], food: { items: ["leaves", "seeds", "flower"] }, shelter: ["leaves", "twigs", "stones"], shelterNeed: 0.3, group: [1, 2], cap: 8,
    repro: { every: 120, minPop: 2, needs: ["leaves", "seeds", "soil"] }, life: [8, 14], rate: 0.12,
    text: { behavior: "Sits still until it doesn't, and then covers a great deal of ground in one go.", fact: "Its ears are on its abdomen.", cond: "Arrives where it is warm, bright and dry-ish, with leaves and seeds around." } }),
  S({ id: "bee", name: "Bee", latin: "Bombus terrestris", rarity: "uncommon", glyph: "Be", color: "#e0a720", color2: "#2a2218", size: 8, move: "fly", speed: 40, active: [0.4, 1, 0.3, 0], temp: [0.5, 0.95], humid: [0.2, 0.75], light: [0.5, 1],
    chambers: ["balcony", "leaf", "canopy", "bark"], food: { items: ["flower", "paleflower", "nectar"] }, shelter: ["hollowwood", "bark", "twigs"], shelterNeed: 0.3, group: [1, 2], cap: 10,
    repro: { every: 100, minPop: 2, needs: ["bark", "hollowwood"] }, life: [6, 10], rate: 0.1, special: "hive",
    text: { behavior: "Flower, nectar, hive, rest. It carries what it finds home, and trades pollen between flowers on the way.", fact: "A bumblebee shivers its flight muscles to warm up before it can take off on a cold morning.", cond: "Arrives where flowers bloom, if there's bark or wood to build a hive in." } }),
  S({ id: "dragonfly", name: "Dragonfly", latin: "Aeshna cyanea", rarity: "uncommon", glyph: "Dr", color: "#2f7fb8", color2: "#9ee0f0", size: 13, move: "hover", speed: 56, active: [0.3, 1, 0.5, 0], temp: [0.55, 0.95], humid: [0.4, 0.9], light: [0.6, 1],
    chambers: ["canopy", "balcony", "leaf"], food: { res: ["midges"] }, shelter: ["twigs", "leaves"], shelterNeed: 0.2, group: [1, 1], cap: 4,
    repro: { every: 200, minPop: 2, needs: ["water"] }, life: [8, 14], rate: 0.08, special: "hoverpatrol", req: "dragonfly",
    text: { behavior: "Hangs motionless over open water, then is somewhere else entirely, having caught something.", fact: "Dragonflies have been hunting on the wing for hundreds of millions of years.", cond: "Arrives where there is open water in bright air, and midges to hunt." } }),
  S({ id: "earwig", name: "Earwig", latin: "Forficula auricularia", rarity: "uncommon", glyph: "Ea", color: "#6a3a22", color2: "#a9643c", size: 7, move: "crawl", speed: 14, active: [0.2, 0.2, 0.7, 1], temp: [0.3, 0.8], humid: [0.4, 0.9], light: [0, 0.5],
    chambers: ["bark", "hollow", "rotting", "leaf", "root", "moss", "tunnel"], food: { items: ["fungi", "fruit", "leaves"], res: ["aphids", "detritus"] }, shelter: ["bark", "hollowwood", "twigs", "stones", "leaves"], shelterNeed: 0.6, group: [1, 2], cap: 8,
    repro: { every: 130, minPop: 2, needs: ["bark", "deadwood", "soil"] }, life: [10, 16], rate: 0.15,
    text: { behavior: "Hides in tight crevices all day, and comes out at dusk to eat just about anything.", fact: "Mother earwigs guard their eggs, and then their young.", cond: "Arrives where there are tight, dark places and something small to eat." } }),
  S({ id: "orbspider", name: "Orb spider", latin: "Araneus diadematus", rarity: "uncommon", glyph: "Sp", color: "#7a5a32", color2: "#c8a56a", size: 8, move: "scuttle", speed: 30, active: [0.6, 0.8, 1, 1], temp: [0.3, 0.85], humid: [0.3, 0.85], light: [0.2, 1],
    chambers: ["bark", "leaf", "balcony", "canopy", "hollow", "moss", "rotting", "root", "tunnel"], food: { res: ["midges"], prey: ["moth", "butterfly", "bee", "ladybird"] }, shelter: ["twigs", "leaves", "bark"], shelterNeed: 0.4, group: [1, 1], cap: 5,
    repro: { every: 220, minPop: 2 }, life: [10, 16], rate: 0.12, special: "web", req: "spider",
    text: { behavior: "Picks a place that makes sense, spins a web, then waits at the middle of it, completely still.", fact: "Most orb weavers eat their web every evening, and spin a new one by morning.", cond: "Arrives where twigs make good anchor points and there's something flying nearby." } }),

  /* ---- rare ---- */
  S({ id: "mantis", name: "Praying mantis", latin: "Mantis religiosa", rarity: "rare", glyph: "Ma", color: "#6fa04a", color2: "#c6dd8a", size: 15, move: "stalk", speed: 9, active: [0.4, 1, 0.6, 0.2], temp: [0.6, 0.95], humid: [0.25, 0.7], light: [0.5, 1],
    chambers: ["leaf", "balcony", "canopy"], food: { prey: ["butterfly", "moth", "bee", "grasshopper", "ladybird", "dragonfly", "earwig"] }, shelter: ["twigs", "leaves"], shelterNeed: 0.5, group: [1, 1], cap: 2,
    repro: { every: 420, minPop: 2 }, life: [14, 22], rate: 0.045, special: "ambush", req: "mantis",
    unknown: { name: "Unknown stick", hint: "Something on the twig that isn't a twig." },
    text: { behavior: "Takes up a perch and becomes part of the plant. Strikes only when something wanders in range.", fact: "It is the only insect that can turn its head to look over its shoulder.", cond: "Appears in warm, bright chambers rich in flying prey and perches." } }),
  S({ id: "stag", name: "Large beetle", latin: "Lucanus cervus", rarity: "rare", glyph: "Lb", color: "#3a1f14", color2: "#7a3e22", size: 15, move: "crawl", speed: 7, active: [0.2, 0.3, 0.8, 1], temp: [0.3, 0.75], humid: [0.5, 0.95], light: [0, 0.5],
    chambers: ["rotting", "hollow", "root", "tunnel", "bark", "moss"], food: { items: ["deadwood", "fungi", "fruit"], res: ["detritus"] }, shelter: ["deadwood", "hollowwood", "bark"], shelterNeed: 0.8, group: [1, 1], cap: 3,
    repro: { every: 300, minPop: 2 }, life: [20, 30], rate: 0.045, req: "stag",
    unknown: { name: "Unknown giant", hint: "Heavy footsteps in the rotting wood." },
    text: { behavior: "Slow, enormous, and deeply uninterested in being noticed.", fact: "It spends years as a grub inside rotting wood and only a few weeks as an adult.", cond: "Appears in chambers where wood is soft, fungal, and already home to other beetles." } }),
  S({ id: "jewelspider", name: "Jewel spider", latin: "Gasteracantha cancriformis", rarity: "rare", glyph: "Js", color: "#c93a74", color2: "#f4d03f", size: 9, move: "scuttle", speed: 24, active: [0.5, 1, 0.8, 0.5], temp: [0.55, 0.95], humid: [0.3, 0.8], light: [0.4, 1],
    chambers: ["canopy", "balcony", "leaf"], food: { res: ["midges"], prey: ["bee", "butterfly", "moth", "dragonfly"] }, shelter: ["twigs", "leaves"], shelterNeed: 0.5, group: [1, 1], cap: 2,
    repro: null, life: [14, 20], rate: 0.035, special: "web", req: "jewel",
    unknown: { name: "Unknown spider", hint: "A spider with something shining on its back." },
    text: { behavior: "Builds a wide web out in the open and sits in it like an ornament.", fact: "The spines on its back are for show: they make it very hard to swallow.", cond: "Appears where other spiders have already proven the place and the garden is rich and varied." } }),
  S({ id: "glowworm", name: "Glowworm", latin: "Lampyris noctiluca", rarity: "rare", glyph: "Gw", color: "#4a5530", color2: "#b8ff7a", size: 6, move: "crawl", speed: 4, active: [0.1, 0.1, 0.5, 1], temp: [0.3, 0.75], humid: [0.65, 1], light: [0, 0.3],
    chambers: ["moss", "root", "hollow", "tunnel", "water", "rotting"], food: { res: ["midges"], prey: ["snail"] }, shelter: ["moss", "stones", "deadwood", "bark"], shelterNeed: 0.6, group: [1, 2], cap: 6,
    repro: { every: 200, minPop: 2, needs: ["moss"] }, life: [12, 20], rate: 0.05, special: "glow", req: "glowworm",
    unknown: { name: "Unknown light", hint: "A small green light, low on the wall, only after dark." },
    text: { behavior: "Climbs a stem, lights its tail, and waits for the dark to bring dinner.", fact: "The light is nearly all heat-free: almost no energy is wasted as warmth.", cond: "Appears at night in dark, wet chambers with moss, where midges gather." } }),
  S({ id: "veilmoth", name: "Veil moth", latin: "Hepialus humuli", rarity: "rare", glyph: "Vm", color: "#cfc8b8", color2: "#8d8470", size: 12, move: "flutter", speed: 26, active: [0, 0, 0.4, 1], temp: [0.25, 0.65], humid: [0.5, 1], light: [0, 0.6],
    chambers: ["canopy", "leaf", "balcony", "hollow"], food: { items: ["flower", "paleflower", "nectar"] }, shelter: ["bark", "leaves"], shelterNeed: 0.4, group: [1, 1], cap: 3,
    repro: null, life: [6, 10], rate: 0.03, req: "veil", arrive: ["evening", "night"],
    unknown: { name: "Unknown dusty moth", hint: "Only comes when the leaves are wet and the night is loud." },
    text: { behavior: "Hangs in the air like a pale scrap of cloth, rarely moving far.", fact: "It doesn't feed at all as an adult. It lives on what it ate as a caterpillar.", cond: "Appears on rainy nights among thick, wet leaves." } }),
  S({ id: "goldbeetle", name: "Golden beetle", latin: "Plusiotis resplendens", rarity: "rare", glyph: "Gb", color: "#e6b422", color2: "#fff0a0", size: 9, move: "crawl", speed: 10, active: [0.5, 1, 0.5, 0.3], temp: [0.75, 1], humid: [0, 0.55], light: [0.6, 1],
    chambers: ["balcony", "leaf", "canopy", "bark"], food: {}, noFood: true, shelter: ["stones", "bark"], shelterNeed: 0.4, group: [1, 1], cap: 1,
    repro: null, life: [14, 20], rate: 0.02, req: "golden",
    unknown: { name: "Unknown glint", hint: "Something small and bright, and only in the hottest light." },
    text: { behavior: "Basks on hot stone as if it were gold leaf, and polishes itself against the rock.", fact: "Its shell reflects light that curls in one direction only — most things don't do that.", cond: "Appears in scorching, sunlit chambers with plenty of stone, where an ordinary beetle already lives." } }),

  /* ---- strange ---- */
  S({ id: "moonmoth", name: "Moon moth", latin: "Selene mirabilis", rarity: "strange", glyph: "Mm", color: "#dfe8ff", color2: "#9fb8ff", size: 15, move: "flutter", speed: 22, active: [0, 0, 0.4, 1], temp: [0.3, 0.7], humid: [0.3, 0.8], light: [0, 1],
    chambers: ["canopy", "balcony", "leaf"], food: { items: ["paleflower", "nectar"] }, shelter: ["leaves", "twigs"], shelterNeed: 0.3, group: [1, 1], cap: 2,
    repro: null, life: [6, 10], rate: 0.035, req: "moonmoth", arrive: ["evening", "night"],
    unknown: { name: "Unknown moth", hint: "Appears after sunset. Seems attracted to something in the upper chamber." },
    text: { behavior: "Drifts between flowers with its wings barely moving, leaving a very faint silver behind it.", fact: "Its wings carry a pale light that seems to come from somewhere other than the sky.", cond: "Appears during clear nights near pale flowers." } }),
  S({ id: "glassbeetle", name: "Glass beetle", latin: "Vitreus scarabaeus", rarity: "strange", glyph: "Gl", color: "#a8e0e8", color2: "#ffffff", size: 10, move: "crawl", speed: 9, active: [0.4, 0.9, 0.5, 0.3], temp: [0.3, 0.85], humid: [0.4, 0.95], light: [0.4, 1],
    chambers: ["water", "root", "moss", "hollow", "bark", "rotting", "tunnel", "balcony", "leaf"], food: { items: ["water"] }, shelter: ["stones"], shelterNeed: 0.4, group: [1, 1], cap: 2,
    repro: null, life: [14, 22], rate: 0.02, req: "glass",
    unknown: { name: "Unknown glint", hint: "You can only see it by what it bends." },
    text: { behavior: "Clear all the way through. You can see the stone beneath it, slightly bent.", fact: "Nobody has ever seen one dry. They seem to arrive just after rain.", cond: "Appears just after rain, where wet stones catch the light beside still water." } }),
  S({ id: "clockwork", name: "Clockwork insect", latin: "Horologia exigua", rarity: "strange", glyph: "Cw", color: "#b08d57", color2: "#e8d3a2", size: 8, move: "tick", speed: 16, active: [0.5, 0.5, 1, 0.5], temp: [0.1, 1], humid: [0, 1], light: [0, 1],
    chambers: ["hollow", "tunnel", "bark", "rotting", "root", "moss"], food: {}, noFood: true, shelter: ["twigs", "stones", "hollowwood"], shelterNeed: 0.5, group: [1, 1], cap: 1,
    repro: null, life: [30, 40], rate: 0.015, req: "clockwork",
    unknown: { name: "Unknown ticking", hint: "A sound like a very small watch." },
    text: { behavior: "Moves in single, exact steps, winds down, rests, and winds itself up again.", fact: "It doesn't eat. Something inside it simply keeps going.", cond: "Appears at dusk where twigs, stones and hollow wood are piled together like parts." } }),
  S({ id: "starbeetle", name: "Star beetle", latin: "Stellifer nocturnus", rarity: "strange", glyph: "Sb", color: "#1a2250", color2: "#fff4b8", size: 11, move: "crawl", speed: 8, active: [0.2, 0.2, 0.6, 1], temp: [0, 0.34], humid: [0.2, 0.8], light: [0, 1],
    chambers: ["canopy", "balcony", "leaf"], food: {}, noFood: true, shelter: ["leaves", "bark"], shelterNeed: 0.3, group: [1, 1], cap: 1,
    repro: null, life: [30, 40], rate: 0.02, req: "starbeetle", arrive: ["evening", "night"],
    unknown: { name: "Unknown sparkle", hint: "Seen only on the coldest clear nights, and only under open sky." },
    text: { behavior: "Walks slowly over bare wood, its shell scattered with points of cold light.", fact: "Its pattern of spots isn't random — it matches no constellation, but it comes close.", cond: "Appears on cold, clear nights in open, sky-facing chambers." } }),
  S({ id: "wisp", name: "Tiny luminous creature", latin: "Lucerna minima", rarity: "strange", glyph: "Wi", color: "#9ffff0", color2: "#ffffff", size: 5, move: "drift", speed: 12, active: [0.3, 0.5, 0.8, 1], temp: [0.1, 0.9], humid: [0.5, 1], light: [0, 0.4],
    chambers: ["moss", "root", "tunnel", "hollow", "water"], food: { items: ["livingmoss", "moss"] }, shelter: ["moss", "livingmoss"], shelterNeed: 0.3, group: [1, 2], cap: 4,
    repro: null, life: [20, 30], rate: 0.03, req: "wisp",
    unknown: { name: "Unknown glow", hint: "Drifts where there is nothing to light it." },
    text: { behavior: "Drifts, brightens, dims. Stays close to the living moss.", fact: "It gives off more light than it takes in. Nobody has worked out where the rest comes from.", cond: "Appears in damp, dark chambers once living moss has taken hold." } }),
  S({ id: "pocketwhale", name: "Pocket whale", latin: "Balaena parvula", rarity: "strange", glyph: "Pw", color: "#4d6fa0", color2: "#bcd4f2", size: 24, move: "drift", speed: 8, active: [1, 1, 1, 1], temp: [0, 1], humid: [0, 1], light: [0, 1],
    chambers: ["water"], food: {}, noFood: true, shelter: [], shelterNeed: 0, group: [1, 1], cap: 1,
    repro: null, life: [1, 1], rate: 0.006, req: "whale", special: "visitor", arrive: ["night"],
    unknown: { name: "Impossible visitor", hint: "It should not fit in here. It doesn't seem to notice." },
    text: { behavior: "Swims, slowly, through air and wood alike, and is gone by morning.", fact: "Not one of the field guides mentions it. Its song is felt more than heard.", cond: "Appears on a still night, over deep water, when the hotel is full of many kinds of life." } }),
];

export const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s])) as Record<SpeciesId, SpeciesDef>;

/** Species that eat a given species. */
export const PREDATORS: Record<string, SpeciesId[]> = (() => {
  const out: Record<string, SpeciesId[]> = {};
  for (const s of SPECIES) for (const p of s.food.prey ?? []) (out[p] ??= []).push(s.id);
  return out;
})();

export const RARITY_LABEL: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", strange: "Strange" };
export const PHASE_LABEL: Record<Phase, string> = { morning: "Morning", day: "Day", evening: "Evening", night: "Night" };
export const WEATHER_LABEL: Record<Weather, string> = { clear: "Clear", rain: "Rain", heat: "Heat", cold: "Cold", wind: "Wind", storm: "Storm" };
