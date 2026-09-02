export type MaterialState = "solid" | "liquid" | "gas" | "powder" | "organic" | "crystalline" | "energy";

export type Property =
  | "hot"
  | "cold"
  | "wet"
  | "dry"
  | "airy"
  | "earthy"
  | "dense"
  | "organic"
  | "living"
  | "luminous"
  | "celestial"
  | "crystalline"
  | "volatile"
  | "flammable";

export interface Material {
  id: string; // slugified name — the canonical key, so different paths to the same concept converge
  name: string;
  description: string;
  state: MaterialState;
  properties: Property[];
  color: string;
  depth: number;
  base: boolean;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hasAny(materials: [Material, Material], prop: Property): boolean {
  return materials[0].properties.includes(prop) || materials[1].properties.includes(prop);
}

function hasBoth(a: Material, b: Material, propA: Property, propB: Property): boolean {
  return (a.properties.includes(propA) && b.properties.includes(propB)) || (a.properties.includes(propB) && b.properties.includes(propA));
}

export const baseMaterials: Material[] = [
  { id: "ember", name: "Ember", description: "A coal that never fully cools.", state: "energy", properties: ["hot", "luminous", "volatile"], color: "#e6754d", depth: 0, base: true },
  { id: "frost", name: "Frost", description: "Cold enough to slow a held breath.", state: "solid", properties: ["cold", "crystalline"], color: "#7ec8e3", depth: 0, base: true },
  { id: "root", name: "Root", description: "Grows toward whatever it's given.", state: "organic", properties: ["organic", "living", "earthy", "flammable"], color: "#7a9e5f", depth: 0, base: true },
  { id: "tide", name: "Tide", description: "Water that remembers the moon.", state: "liquid", properties: ["wet"], color: "#3f7ea6", depth: 0, base: true },
  { id: "gale", name: "Gale", description: "Wind that carries more than air.", state: "gas", properties: ["airy", "volatile"], color: "#c7d1d8", depth: 0, base: true },
  { id: "glimmer", name: "Glimmer", description: "A light with no visible source.", state: "energy", properties: ["luminous", "celestial"], color: "#b6b9ff", depth: 0, base: true },
  { id: "stone", name: "Stone", description: "Patient. Has nowhere else to be.", state: "solid", properties: ["earthy", "dense"], color: "#9a938a", depth: 0, base: true },
  { id: "dust", name: "Dust", description: "Everything, eventually, in small enough pieces.", state: "powder", properties: ["earthy", "dry"], color: "#c2b8a3", depth: 0, base: true },
];

interface ReactionRule {
  id: string;
  match: (a: Material, b: Material) => boolean;
  state: MaterialState;
  properties: Property[];
  name: string;
  description: string;
  color: string;
}

// General, property-level rules — each one covers every pair of materials
// that happens to carry the right properties, not just one specific pair.
const RULES: ReactionRule[] = [
  {
    id: "combustion",
    match: (a, b) => hasAny([a, b], "hot") && hasAny([a, b], "flammable"),
    state: "powder",
    properties: ["dry", "earthy"],
    name: "Ash",
    description: "What's left when something that could burn, finally did.",
    color: "#8a8580",
  },
  {
    id: "glass",
    match: (a, b) => hasBoth(a, b, "hot", "cold"),
    state: "crystalline",
    properties: ["crystalline"],
    name: "Glass",
    description: "Fire and cold, shocked into something clear.",
    color: "#a9d4e0",
  },
  {
    id: "vaporize",
    match: (a, b) => hasAny([a, b], "hot") && hasAny([a, b], "wet"),
    state: "gas",
    properties: ["wet", "hot", "airy"],
    name: "Steam",
    description: "Water, given enough heat to stop sitting still.",
    color: "#d8dee2",
  },
  {
    id: "freeze",
    match: (a, b) => hasAny([a, b], "cold") && hasAny([a, b], "wet"),
    state: "solid",
    properties: ["cold", "crystalline"],
    name: "Ice",
    description: "Water, convinced to hold still.",
    color: "#bfe6f5",
  },
  {
    id: "melt",
    match: (a, b) => hasAny([a, b], "hot") && hasAny([a, b], "dense"),
    state: "liquid",
    properties: ["hot", "earthy"],
    name: "Magma",
    description: "Stone that hasn't decided what shape to keep.",
    color: "#c1441f",
  },
  {
    id: "rime",
    match: (a, b) => hasAny([a, b], "cold") && hasAny([a, b], "dry"),
    state: "crystalline",
    properties: ["cold", "crystalline"],
    name: "Rime",
    description: "Frost, settling into every last crack.",
    color: "#dbe9ec",
  },
  {
    id: "erode",
    match: (a, b) => hasAny([a, b], "airy") && hasAny([a, b], "dense"),
    state: "powder",
    properties: ["earthy", "dry", "airy"],
    name: "Sandstorm",
    description: "Stone, worn small enough to fly.",
    color: "#d8c48a",
  },
  {
    id: "growth",
    match: (a, b) => hasAny([a, b], "organic") && hasAny([a, b], "wet"),
    state: "organic",
    properties: ["organic", "living", "wet"],
    name: "Moss",
    description: "Something patient, finally given water.",
    color: "#5c7a4a",
  },
  {
    id: "clay",
    match: (a, b) => hasAny([a, b], "wet") && hasAny([a, b], "dense"),
    state: "solid",
    properties: ["earthy", "wet"],
    name: "Clay",
    description: "Stone, still deciding what to become.",
    color: "#b3765a",
  },
  {
    id: "wisp",
    match: (a, b) => hasAny([a, b], "airy") && hasAny([a, b], "luminous"),
    state: "gas",
    properties: ["airy", "luminous"],
    name: "Wisp",
    description: "Wind, given just enough light to be seen.",
    color: "#dce4ff",
  },
  {
    id: "sand",
    match: (a, b) => hasAny([a, b], "dense") && hasAny([a, b], "dry"),
    state: "powder",
    properties: ["earthy", "dry"],
    name: "Sand",
    description: "Stone and dust, agreeing on a smaller size.",
    color: "#d9c9a3",
  },
  {
    id: "storm",
    match: (a, b) => hasAny([a, b], "airy") && hasAny([a, b], "wet"),
    state: "gas",
    properties: ["airy", "wet", "volatile"],
    name: "Storm",
    description: "Wind and water, arguing at once.",
    color: "#4a5a75",
  },
  {
    id: "compost",
    match: (a, b) => hasAny([a, b], "organic") && hasAny([a, b], "dry"),
    state: "organic",
    properties: ["organic", "earthy"],
    name: "Compost",
    description: "Something green, taking its time to become soil.",
    color: "#6b5d45",
  },
  {
    id: "frostbloom",
    match: (a, b) => hasAny([a, b], "cold") && hasAny([a, b], "organic"),
    state: "organic",
    properties: ["cold", "organic"],
    name: "Frostbloom",
    description: "A flower that only opens in the cold.",
    color: "#cfe8f0",
  },
];

const PROPERTY_WORDS: Partial<Record<Property, { adj: string; noun: string }>> = {
  hot: { adj: "Ember", noun: "Flare" },
  cold: { adj: "Frost", noun: "Chill" },
  wet: { adj: "Tide", noun: "Damp" },
  dry: { adj: "Dust", noun: "Husk" },
  airy: { adj: "Gale", noun: "Breath" },
  earthy: { adj: "Stone", noun: "Grain" },
  dense: { adj: "Iron", noun: "Core" },
  organic: { adj: "Green", noun: "Sprout" },
  living: { adj: "Living", noun: "Bloom" },
  luminous: { adj: "Glimmer", noun: "Glow" },
  celestial: { adj: "Lunar", noun: "Star" },
  crystalline: { adj: "Crystal", noun: "Shard" },
  volatile: { adj: "Wild", noun: "Spark" },
  flammable: { adj: "Kindling", noun: "Husk" },
};

function blendColor(c1: string, c2: string): string {
  const p1 = parseInt(c1.slice(1), 16);
  const p2 = parseInt(c2.slice(1), 16);
  const r = Math.round(((p1 >> 16) + (p2 >> 16)) / 2);
  const g = Math.round((((p1 >> 8) & 0xff) + ((p2 >> 8) & 0xff)) / 2);
  const b = Math.round(((p1 & 0xff) + (p2 & 0xff)) / 2);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const celestialFact =
  "A single rule — anything celestial paired with anything else — is why Moon touching Water, Ink, or Moss each produce their own kind of moonlit variant instead of needing three separate recipes.";

export const catchAllFact =
  "This one didn't come from a written recipe — it's a general rule reading both materials' properties and building something new from them, the same way every other discovery here works underneath.";

export interface ReactionResult {
  material: Material;
  isNew: boolean;
  isFizzle: boolean;
  isCatchAll: boolean;
  isCelestial: boolean;
}

/**
 * The reaction engine. Tries curated property rules first (in order), then
 * a celestial-variant rule, then a general catch-all that always succeeds —
 * so nearly every pair produces *something*, the way the underlying system
 * is meant to.
 */
export function react(a: Material, b: Material, known: Map<string, Material>): ReactionResult | null {
  if (a.id === b.id) return null; // self-combination — handled as a fizzle by the caller

  for (const rule of RULES) {
    if (rule.match(a, b)) {
      const id = slug(rule.name);
      const existing = known.get(id);
      if (existing) return { material: existing, isNew: false, isFizzle: false, isCatchAll: false, isCelestial: false };
      const material: Material = {
        id,
        name: rule.name,
        description: rule.description,
        state: rule.state,
        properties: rule.properties,
        color: rule.color,
        depth: Math.max(a.depth, b.depth) + 1,
        base: false,
      };
      return { material, isNew: true, isFizzle: false, isCatchAll: false, isCelestial: false };
    }
  }

  // Celestial rule: anything celestial + anything else becomes a lunar variant of the other.
  if (hasAny([a, b], "celestial")) {
    const other = a.properties.includes("celestial") ? b : a;
    const name = `Lunar ${other.name}`;
    const id = slug(name);
    const existing = known.get(id);
    if (existing) return { material: existing, isNew: false, isFizzle: false, isCatchAll: false, isCelestial: true };
    const material: Material = {
      id,
      name,
      description: `${other.name}, touched by something celestial.`,
      state: other.state,
      properties: Array.from(new Set([...other.properties, "luminous", "celestial"])),
      color: blendColor(other.color, "#b6b9ff"),
      depth: Math.max(a.depth, b.depth) + 1,
      base: false,
    };
    return { material, isNew: true, isFizzle: false, isCatchAll: false, isCelestial: true };
  }

  // Catch-all: every remaining pair still produces something, generated from
  // whichever property most distinguishes each side.
  const aProp = a.properties.find((p) => !b.properties.includes(p)) ?? a.properties[0];
  const bProp = b.properties.find((p) => !a.properties.includes(p)) ?? b.properties[0];
  const adj = (aProp && PROPERTY_WORDS[aProp]?.adj) ?? capitalize(a.name);
  const noun = (bProp && PROPERTY_WORDS[bProp]?.noun) ?? capitalize(b.name);
  const name = `${adj} ${noun}`;
  const id = slug(name);
  const existing = known.get(id);
  if (existing) return { material: existing, isNew: false, isFizzle: false, isCatchAll: true, isCelestial: false };

  const properties = Array.from(new Set([...a.properties, ...b.properties])).slice(0, 4);
  const material: Material = {
    id,
    name,
    description: `${a.name} and ${b.name}, combined into something new.`,
    state: a.state === "energy" ? b.state : a.state,
    properties,
    color: blendColor(a.color, b.color),
    depth: Math.max(a.depth, b.depth) + 1,
    base: false,
  };
  return { material, isNew: true, isFizzle: false, isCatchAll: true, isCelestial: false };
}

export const selfFizzleLines = [
  "Nothing happens — it's already exactly itself.",
  "You get more of the same.",
  "It regards itself, entirely unimpressed.",
  "Same and same rarely make a third thing.",
];
