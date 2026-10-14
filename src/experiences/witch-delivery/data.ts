/**
 * The Witch's Delivery Service — authored data.
 *
 * The town, its people, its packages and its weather are all described here as
 * data. The engine turns those descriptions into behaviour.
 */

export const WORLD_W = 9400;
export const WORLD_H = 1340;
export const GROUND = 1100;
/** Seconds in one full day/night cycle. */
export const DAY_LEN = 300;

export type DistrictId = "old" | "river" | "wood" | "uni" | "hill" | "harbor";
export type LocId =
  | "post" | "bakery" | "clock" | "market" | "cottage" | "fishdock" | "mill" | "oak"
  | "moonwell" | "academy" | "library" | "observatory" | "manor" | "lighthouse" | "warehouse";
export type CustomerId =
  | "tilly" | "bernadette" | "pim" | "odo" | "marrow" | "silas" | "hobb" | "bramble"
  | "lune" | "fennimore" | "vael" | "orla" | "vane" | "wren" | "rudd" | "hollow";
export type Weather = "clear" | "rain" | "wind" | "fog" | "snow" | "thunder" | "magic";
export type PkgId =
  | "letter" | "book" | "flowers" | "cake" | "clothes" | "gift" | "potion"
  | "teapot" | "sleepcloud" | "umbrella" | "frogs" | "storm" | "egg" | "moonlight" | "homesick"
  | "dream" | "shadow" | "yesterday" | "ocean" | "reflection" | "refuse" | "bigbox";
export type ConstraintKind = "time" | "melt" | "dry" | "calm" | "night";
export type ObjectiveKind = "rings" | "noground" | "shortcut" | "low" | "nobirds";

export interface District {
  id: DistrictId; name: string; x0: number; x1: number; unlock: number;
  /** Wind multiplier. */
  wind: number; blurb: string;
  palette: { wall: string[]; roof: string[]; far: string };
}

export const DISTRICTS: District[] = [
  { id: "old", name: "Old Town", x0: 0, x1: 1700, unlock: 0, wind: 0.7, blurb: "Narrow streets, tall roofs, one very large clock.", palette: { wall: ["#c9a37a", "#b98b6a", "#d2b08a", "#a97d63"], roof: ["#7a3b34", "#5d4a6b", "#8a5a3a"], far: "#3a3358" } },
  { id: "river", name: "Riverside", x0: 1700, x1: 3300, unlock: 1, wind: 0.8, blurb: "Bridges, mills, and a river that wants to be followed.", palette: { wall: ["#bfae8d", "#a7b3a0", "#c7a98a", "#94a3a8"], roof: ["#4f6f7a", "#7a5a46", "#58706a"], far: "#2f4a5e" } },
  { id: "wood", name: "Witchwood", x0: 3300, x1: 4800, unlock: 4, wind: 0.5, blurb: "Old trees, hidden clearings, and the odd shortcut.", palette: { wall: ["#8a7a5c", "#6f7c58", "#9a8460"], roof: ["#3d5a3f", "#4f4a34", "#2f4a45"], far: "#1d3a35" } },
  { id: "uni", name: "University District", x0: 4800, x1: 6300, unlock: 6, wind: 0.9, blurb: "Towers, libraries, and weather that someone is experimenting with.", palette: { wall: ["#b9b2c9", "#a6a1c2", "#c8bfd6", "#9a98b8"], roof: ["#4a3f7a", "#5d3f6b", "#3d4f8a"], far: "#3a3470" } },
  { id: "hill", name: "Hill District", x0: 6300, x1: 7800, unlock: 8, wind: 1.3, blurb: "Windy slopes, big houses, and an observatory.", palette: { wall: ["#d0b898", "#c4a98a", "#b8a58f"], roof: ["#6a4a3f", "#7a5a4a", "#4f5a6a"], far: "#4a4262" } },
  { id: "harbor", name: "Harbor", x0: 7800, x1: 9400, unlock: 11, wind: 1.5, blurb: "Cranes, ships, and a lighthouse that sees everything.", palette: { wall: ["#a8a49a", "#b4967a", "#8f9aa0"], roof: ["#5a4a4a", "#4a5a6a", "#6a5a46"], far: "#25364f" } },
];
export const DISTRICT = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<DistrictId, District>;
export function districtAt(x: number): District {
  return DISTRICTS.find((d) => x >= d.x0 && x < d.x1) ?? DISTRICTS[DISTRICTS.length - 1];
}

export interface Landmark {
  id: LocId; name: string; district: DistrictId; x: number; w: number; h: number;
  style: "house" | "tower" | "shop" | "cottage" | "tree" | "dome" | "lighthouse" | "warehouse" | "dock" | "mill" | "well" | "stall";
  color: string; customer: CustomerId;
}

export const LANDMARKS: Landmark[] = [
  { id: "post", name: "Post Office", district: "old", x: 150, w: 160, h: 230, style: "house", color: "#d9a05b", customer: "tilly" },
  { id: "bakery", name: "Bun & Bell Bakery", district: "old", x: 590, w: 140, h: 200, style: "shop", color: "#e0a8a0", customer: "bernadette" },
  { id: "clock", name: "Clocktower Workshop", district: "old", x: 840, w: 120, h: 520, style: "tower", color: "#b9a37a", customer: "pim" },
  { id: "market", name: "Cobbled Market", district: "old", x: 1130, w: 210, h: 90, style: "stall", color: "#d9b36a", customer: "odo" },
  { id: "cottage", name: "Reed Cottage", district: "river", x: 1900, w: 130, h: 130, style: "cottage", color: "#a9b88a", customer: "marrow" },
  { id: "fishdock", name: "Fish Dock", district: "river", x: 2960, w: 190, h: 70, style: "dock", color: "#8a7a62", customer: "silas" },
  { id: "mill", name: "Willow Mill", district: "river", x: 3160, w: 160, h: 250, style: "mill", color: "#b4a48a", customer: "hobb" },
  { id: "oak", name: "Hollow Oak", district: "wood", x: 3560, w: 170, h: 260, style: "tree", color: "#6a5a3a", customer: "bramble" },
  { id: "moonwell", name: "Moonwell", district: "wood", x: 4600, w: 110, h: 90, style: "well", color: "#9aa8c8", customer: "lune" },
  { id: "academy", name: "Wizard Academy", district: "uni", x: 5120, w: 220, h: 430, style: "tower", color: "#a99ac8", customer: "fennimore" },
  { id: "library", name: "Library of Echoes", district: "uni", x: 5640, w: 240, h: 310, style: "dome", color: "#b8aa9a", customer: "vael" },
  { id: "manor", name: "Windy Manor", district: "hill", x: 6460, w: 240, h: 250, style: "house", color: "#d6bf9a", customer: "vane" },
  { id: "observatory", name: "Observatory", district: "hill", x: 7060, w: 150, h: 120, style: "dome", color: "#c4c8d8", customer: "orla" },
  { id: "warehouse", name: "Warehouse 9", district: "harbor", x: 7990, w: 220, h: 200, style: "warehouse", color: "#9a8a7a", customer: "rudd" },
  { id: "lighthouse", name: "Lighthouse", district: "harbor", x: 9290, w: 100, h: 540, style: "lighthouse", color: "#e8e0d0", customer: "wren" },
];
export const LOC = Object.fromEntries(LANDMARKS.map((l) => [l.id, l])) as Record<LocId, Landmark>;

export type Hat = "none" | "wizard" | "chef" | "glasses" | "goggles" | "pointed" | "bun" | "scarf" | "fisher" | "small" | "cap" | "fancy" | "hood";
export interface Customer {
  id: CustomerId; name: string; role: string; color: string; hat: Hat; home: LocId;
  lines: { great: string; ok: string; bad: string };
}
export const CUSTOMERS: Customer[] = [
  { id: "tilly", name: "Postmaster Tilly", role: "Runs the Post Office", color: "#d9a05b", hat: "cap", home: "post", lines: { great: "Spotless. Put it on the wall.", ok: "Delivered! That's all I ask.", bad: "I'll file that under 'adventures'." } },
  { id: "bernadette", name: "Bernadette", role: "The Impatient Baker", color: "#e0a8a0", hat: "chef", home: "bakery", lines: { great: "Finally, someone who understands time!", ok: "You're late. But thank you.", bad: "That is NOT how it left the oven." } },
  { id: "pim", name: "Pim", role: "The Forgetful Inventor", color: "#c9a06a", hat: "goggles", home: "clock", lines: { great: "Marvellous! What did I order again?", ok: "Ah. This. Yes. I think.", bad: "Is it supposed to do that? Hm. Write that down." } },
  { id: "odo", name: "Little Odo", role: "Orders increasingly strange things", color: "#7aa8d0", hat: "small", home: "market", lines: { great: "Even better than I asked for!!", ok: "Cool. Can I keep it?", bad: "That was the BEST part. Do it again." } },
  { id: "marrow", name: "Granny Marrow", role: "The Retired Witch", color: "#a98ac0", hat: "bun", home: "cottage", lines: { great: "Reminds me of my flying days, dear.", ok: "Sit down, have some tea. You look windswept.", bad: "I did worse at your age. Slightly." } },
  { id: "silas", name: "Old Silas", role: "The Suspicious Fisherman", color: "#6a8aa0", hat: "fisher", home: "fishdock", lines: { great: "Hm. Didn't see you coming. Good.", ok: "How do I know it's the right one?", bad: "I knew it. Somebody's after my fish." } },
  { id: "hobb", name: "Miller Hobb", role: "Keeps the mill turning", color: "#b4a48a", hat: "cap", home: "mill", lines: { great: "Grand job, lass!", ok: "Right where I wanted it. Near enough.", bad: "Well, the wheel's turning. That's something." } },
  { id: "bramble", name: "Bramble", role: "The Potion Maker", color: "#7a9a5a", hat: "pointed", home: "oak", lines: { great: "Unspoiled! Rare. I'm impressed.", ok: "It'll do. I can fix the rest.", bad: "Ha! Now it's a different potion. Fine." } },
  { id: "lune", name: "Sister Lune", role: "Keeper of the Moonwell", color: "#9aa8c8", hat: "hood", home: "moonwell", lines: { great: "The well is pleased.", ok: "Thank you, little courier.", bad: "The well is... amused." } },
  { id: "fennimore", name: "Archmage Fennimore", role: "The Eccentric Wizard", color: "#8a7ac8", hat: "wizard", home: "academy", lines: { great: "EXACTLY as I predicted! Mostly.", ok: "Splendid! Now, where did I leave the sky?", bad: "A beautiful disaster. Remarkable." } },
  { id: "vael", name: "Ms. Vael", role: "The Mysterious Librarian", color: "#b8aa9a", hat: "glasses", home: "library", lines: { great: "Quiet. Perfect. Thank you.", ok: "...Noted.", bad: "Shh. We will never speak of this." } },
  { id: "orla", name: "Dr. Orla", role: "The Astronomer", color: "#c4c8d8", hat: "scarf", home: "observatory", lines: { great: "A clear delivery on a clear night.", ok: "The stars forgive you. Just.", bad: "I'll be seeing stars. Thanks to you." } },
  { id: "vane", name: "Lady Vane", role: "Lives in a very big house", color: "#d6bf9a", hat: "fancy", home: "manor", lines: { great: "Charming. You may use the front hedge.", ok: "Leave it by the third potted fern.", bad: "I shall pretend it arrived. Politely." } },
  { id: "wren", name: "Keeper Wren", role: "The Lighthouse Keeper", color: "#e8e0d0", hat: "cap", home: "lighthouse", lines: { great: "Saw you coming for miles. Lovely flying.", ok: "Right on time for the tide.", bad: "I saw THAT from up here." } },
  { id: "rudd", name: "Dockmaster Rudd", role: "Warehouse 9, by day", color: "#9a8a7a", hat: "cap", home: "warehouse", lines: { great: "Crisp. Stamp it, boys.", ok: "Sign here. And here.", bad: "Again? We have a form for this." } },
  { id: "hollow", name: "Mr. Hollow", role: "Accepts deliveries at midnight only", color: "#4a4a6a", hat: "hood", home: "warehouse", lines: { great: "Prompt. I do appreciate the dark.", ok: "...Thank you. Quietly.", bad: "You woke the gulls. I will remember." } },
];
export const CUSTOMER = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c])) as Record<CustomerId, Customer>;
export const GENERIC_LINES = {
  great: ["That was beautiful flying.", "Not a scratch. Remarkable.", "Five stars. Maybe six."],
  ok: ["Well, it arrived.", "Close enough to count.", "Thank you!"],
  bad: ["Is it... supposed to look like that?", "I have questions.", "Well. That's a story."],
};

/* ------------------------------------------------------------------ */
/* Packages                                                            */
/* ------------------------------------------------------------------ */

export interface PackageDef {
  id: PkgId; name: string; tier: 0 | 1 | 2; color: string;
  note: string; tip: string;
  mass: number;
  constraints: ConstraintKind[];
  /** Preferred senders (falls back to any unlocked place). */
  from?: LocId[];
}

export const PACKAGES: PackageDef[] = [
  { id: "letter", name: "Sealed Letter", tier: 0, color: "#f1e7cf", note: "A letter with very important news. Allegedly.", tip: "Keep it dry. Rain smudges the ink.", mass: 0, constraints: ["dry", "time"] },
  { id: "book", name: "Heavy Book", tier: 0, color: "#7a4a3a", note: "A very heavy book on very light topics.", tip: "Heavy: slower to speed up. Bumps dog-ear the pages.", mass: 5, constraints: ["time"], from: ["library"] },
  { id: "flowers", name: "Bouquet", tier: 0, color: "#e8708a", note: "Flowers that are already thinking about wilting.", tip: "They wilt with time. A little rain perks them up.", mass: 0, constraints: ["time"], from: ["cottage", "market"] },
  { id: "cake", name: "Tiered Cake", tier: 0, color: "#f4d4d8", note: "Deliver a cake before it melts.", tip: "Heat melts it. Don't spin it — it lands where it lands.", mass: 3, constraints: ["melt"], from: ["bakery"] },
  { id: "clothes", name: "Folded Cloak", tier: 0, color: "#6a5aa8", note: "A cloak, freshly mended. It does catch the wind.", tip: "It catches wind: headwinds hurt. Keep it dry.", mass: 1, constraints: ["dry", "time"] },
  { id: "gift", name: "Wrapped Gift", tier: 0, color: "#d9584a", note: "Something rattly in a great deal of ribbon.", tip: "Bumps loosen the ribbon.", mass: 1, constraints: ["time"] },
  { id: "potion", name: "Fizzing Potion", tier: 0, color: "#7ad88a", note: "Do not shake. (Someone will.)", tip: "Sudden moves make it fizz. Chime (Space) settles it.", mass: 1, constraints: ["calm"], from: ["oak"] },

  { id: "teapot", name: "Singing Teapot", tier: 1, color: "#c8a05a", note: "It insists on providing the soundtrack.", tip: "It sings all the way. Birds love it. Rain makes it sulk.", mass: 2, constraints: ["time", "dry"], from: ["market", "clock"] },
  { id: "sleepcloud", name: "Sleeping Cloud", tier: 1, color: "#dfe6f2", note: "Deliver a sleeping cloud without waking it.", tip: "Smooth flying keeps it asleep. Chime to hush it.", mass: 0, constraints: ["calm"], from: ["academy"] },
  { id: "umbrella", name: "Invisible Umbrella", tier: 1, color: "#8aa0c8", note: "You can't see it. It can see the weather.", tip: "Invisible — until it rains. Then it opens, and drags.", mass: 0, constraints: ["time"], from: ["clock"] },
  { id: "frogs", name: "Box of Frogs", tier: 1, color: "#6ab04a", note: "Six frogs. Probably. They're hard to count.", tip: "Frogs escape. Fly into them, or chime to call them back.", mass: 2, constraints: ["time"], from: ["moonwell", "cottage"] },
  { id: "storm", name: "Pocket Thunderstorm", tier: 1, color: "#6a7aa0", note: "A tiny storm, tidily boxed. Mostly.", tip: "It makes its own weather. Its lightning scares birds off.", mass: 1, constraints: ["time"], from: ["academy"] },
  { id: "egg", name: "Tiny Dragon Egg", tier: 1, color: "#d0603a", note: "Warm, wiggly, and very much not yours.", tip: "Speed warms it, rain cools it. Don't let it hatch.", mass: 2, constraints: ["time"], from: ["oak", "cottage"] },
  { id: "moonlight", name: "Moonlight in a Bottle", tier: 1, color: "#cfe0ff", note: "Brightest after dark. Fades in sunlight.", tip: "Glows at night and lights up fog. Midday sun fades it.", mass: 0, constraints: ["night", "time"], from: ["moonwell"] },
  { id: "homesick", name: "Homesick Parcel", tier: 1, color: "#b88a5a", note: "A parcel actively trying to return to the sender.", tip: "It tugs back toward where it came from. Hold on.", mass: 1, constraints: ["time"] },

  { id: "dream", name: "Bottled Dream", tier: 2, color: "#b08ae0", note: "Nobody is entirely certain what it is.", tip: "Everything gets floaty and strange around it.", mass: 0, constraints: ["time"], from: ["library", "academy"] },
  { id: "shadow", name: "A Shadow", tier: 2, color: "#2a2438", note: "Someone misplaced it. It misses the ground.", tip: "It tugs you down toward the ground.", mass: 0, constraints: ["time"], from: ["clock"] },
  { id: "yesterday", name: "Yesterday", tier: 2, color: "#c8b48a", note: "One (1) yesterday. Handle with hindsight.", tip: "Your controls arrive a moment late.", mass: 0, constraints: ["time"], from: ["library"] },
  { id: "ocean", name: "Miniature Ocean", tier: 2, color: "#3a7ac8", note: "Everything in it is fine. Everything in it sloshes.", tip: "It sloshes. Big wobbles spill it. Fly gently.", mass: 4, constraints: ["calm"], from: ["lighthouse", "fishdock"] },
  { id: "reflection", name: "Lost Reflection", tier: 2, color: "#a8d8e0", note: "Missing since Tuesday. Looking a bit mirrored.", tip: "It moves the opposite way and tugs you along.", mass: 0, constraints: ["time"], from: ["academy", "library"] },
  { id: "refuse", name: "A Cloud That Refuses", tier: 2, color: "#cfd4de", note: "It has declined to be delivered.", tip: "It drifts away from its destination. Be persistent.", mass: 0, constraints: ["time"], from: ["academy"] },
  { id: "bigbox", name: "Box Larger Than Box", tier: 2, color: "#8a6a4a", note: "Contains something larger than the box.", tip: "It keeps getting bigger. Avoid tight gaps.", mass: 3, constraints: ["time"] },
];
export const PKG = Object.fromEntries(PACKAGES.map((p) => [p.id, p])) as Record<PkgId, PackageDef>;
export const TIER_LABEL = ["Ordinary", "Unusual", "Impossible"];

export const CONSTRAINT_TEXT: Record<ConstraintKind, string> = {
  time: "Be quick — it's expected soon",
  melt: "Before it melts",
  dry: "Keep it dry",
  calm: "Keep it calm",
  night: "After dark only",
};
export const OBJECTIVE_TEXT: Record<ObjectiveKind, string> = {
  rings: "Fly through 2 rings",
  noground: "Never touch the ground or water",
  shortcut: "Use a shortcut",
  low: "Keep low — stay under the rooftops",
  nobirds: "Don't lose it to the birds",
};

/* ------------------------------------------------------------------ */
/* Weather, upgrades, secrets                                          */
/* ------------------------------------------------------------------ */

export interface WeatherDef {
  id: Weather; name: string; unlock: number; blurb: string;
  wind: number; vis: number; rain: number; snow: number; fog: number; storm: number; magic: number; weight: number;
}
export const WEATHERS: WeatherDef[] = [
  { id: "clear", name: "Clear", unlock: 0, blurb: "Easy flying. A jet stream hums high up.", wind: 20, vis: 1, rain: 0, snow: 0, fog: 0, storm: 0, magic: 0, weight: 40 },
  { id: "rain", name: "Rain", unlock: 0, blurb: "Reduced visibility. Packages get wet.", wind: 40, vis: 0.78, rain: 0.7, snow: 0, fog: 0, storm: 0, magic: 0, weight: 26 },
  { id: "wind", name: "Wind", unlock: 3, blurb: "It pushes. The higher you fly, the harder.", wind: 130, vis: 1, rain: 0, snow: 0, fog: 0, storm: 0, magic: 0, weight: 16 },
  { id: "fog", name: "Fog", unlock: 5, blurb: "You can see about as far as the end of your broom.", wind: 12, vis: 0.4, rain: 0, snow: 0, fog: 1, storm: 0, magic: 0, weight: 14 },
  { id: "snow", name: "Snow", unlock: 7, blurb: "Slower air, softer sounds, colder eggs.", wind: 60, vis: 0.65, rain: 0, snow: 1, fog: 0.2, storm: 0, magic: 0, weight: 12 },
  { id: "thunder", name: "Thunderstorm", unlock: 9, blurb: "Gusts, rain, and lightning with excellent aim.", wind: 140, vis: 0.62, rain: 1, snow: 0, fog: 0, storm: 1, magic: 0, weight: 12 },
  { id: "magic", name: "Magical storm", unlock: 12, blurb: "Gravity has opinions. Controls hiccup.", wind: 60, vis: 0.8, rain: 0, snow: 0, fog: 0.3, storm: 0, magic: 1, weight: 10 },
];
export const WEATHER = Object.fromEntries(WEATHERS.map((w) => [w.id, w])) as Record<Weather, WeatherDef>;

export type UpgradeId = "speed" | "accel" | "stability" | "glide" | "boost" | "compass";
export interface UpgradeDef { id: UpgradeId; name: string; blurb: string; costs: number[]; levels: string[] }
export const UPGRADES: UpgradeDef[] = [
  { id: "speed", name: "Swift Bristles", blurb: "A higher top speed.", costs: [60, 120, 200], levels: ["A little quicker.", "Noticeably brisk.", "The air starts to hum."] },
  { id: "accel", name: "Eager Handle", blurb: "Reach top speed sooner.", costs: [50, 110, 180], levels: ["Snappier starts.", "Turns on a coin.", "Barely a delay at all."] },
  { id: "stability", name: "Steady Ribbon", blurb: "Wind and knocks push you less, and packages stay calmer.", costs: [60, 120, 190], levels: ["Wind pushes 20% less.", "Packages stay calmer.", "Gusts become a suggestion."] },
  { id: "glide", name: "Wing Cloth", blurb: "Glide further and sink slower.", costs: [50, 100, 170], levels: ["Longer glides.", "Hold altitude at lower speeds.", "Almost sails on its own."] },
  { id: "boost", name: "Spark Plug", blurb: "A larger, hotter boost.", costs: [70, 130, 210], levels: ["More boost in the tank.", "Hotter burst, faster refill.", "Rings refill it completely."] },
  { id: "compass", name: "Magical Compass", blurb: "Subtle help finding your way.", costs: [40, 90, 160], levels: ["An arrow toward your target.", "Shortcuts glint nearby.", "Hidden routes shimmer."] },
];

export interface SecretDef {
  id: string; name: string; x: number; y: number; r: number;
  cond: "any" | "night" | "rain" | "midnight";
  hint: string; found: string; district: DistrictId;
}
export const SECRETS: SecretDef[] = [
  { id: "garden", name: "The Hidden Rooftop Garden", x: 372, y: GROUND - 70, r: 55, cond: "any", district: "old", hint: "Something green is tucked between two tall Old Town houses.", found: "A whole garden, folded into a gap nobody ever looks down." },
  { id: "cat", name: "The Cat Who Only Comes in Rain", x: 1915, y: GROUND - 175, r: 70, cond: "rain", district: "river", hint: "A roof in Riverside that's empty — until it rains.", found: "A grey cat on Reed Cottage's chimney. It stares. It does not move. It is very pleased with the rain." },
  { id: "meeting", name: "The Secret Witch Meeting", x: 4060, y: GROUND - 60, r: 120, cond: "night", district: "wood", hint: "The Witchwood clearing, after dark.", found: "A circle of witches with a campfire. They pretend not to see you. You pretend not to see them." },
  { id: "village", name: "The Tiny Village in the Tree", x: 4300, y: GROUND - 600, r: 80, cond: "any", district: "wood", hint: "The tallest tree in Witchwood is hiding something near the top.", found: "A village, rope bridges and all, about the size of your hat." },
  { id: "nodoor", name: "The House With No Door", x: 7330, y: GROUND - 205, r: 90, cond: "any", district: "hill", hint: "On the Hill District slope, one house is… missing something.", found: "No door. No gate. A very happy chimney. Someone is definitely home." },
  { id: "midnight", name: "The Midnight Window", x: 8100, y: GROUND - 170, r: 80, cond: "midnight", district: "harbor", hint: "A Harbor warehouse window that's only lit at the very dead of night.", found: "A lamp turns on as you pass. Mr. Hollow, who accepts deliveries at midnight only, is open for business." },
  { id: "cloudlane", name: "Cloud Lane", x: 2300, y: 170, r: 90, cond: "any", district: "river", hint: "High above the river, the clouds seem to line up.", found: "A hidden route through the clouds, strung with rings and a fast, friendly jet stream." },
];

/** Deliveries needed to unlock each tier of weirdness. */
export const TIER_UNLOCK = [0, 3, 12];
export const HOME_X = 150;
