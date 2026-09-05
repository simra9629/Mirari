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
  | "flammable"
  | "temporal";

export type ConditionType = "none" | "heat" | "cool" | "grind" | "wait";

export const CONDITIONS: { id: ConditionType; label: string; hint: string }[] = [
  { id: "none", label: "None", hint: "Combine as-is." },
  { id: "heat", label: "Heat", hint: "Applies warmth before combining." },
  { id: "cool", label: "Cool", hint: "Applies cold before combining." },
  { id: "grind", label: "Grind", hint: "Breaks things down before combining." },
  { id: "wait", label: "Wait", hint: "Lets time pass before combining." },
];

const CONDITION_PROPERTIES: Record<ConditionType, Property[]> = {
  none: [],
  heat: ["hot"],
  cool: ["cold"],
  grind: ["dry"],
  wait: ["temporal"],
};

export interface Material {
  id: string; // slugified name — the canonical key, so different paths to the same concept converge
  name: string;
  description: string;
  state: MaterialState;
  properties: Property[];
  color: string;
  depth: number;
  base: boolean;
  firstParents?: [string, string]; // names of the pair that first produced this, for the journal
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hasAny(props: Set<Property>, prop: Property): boolean {
  return props.has(prop);
}

function hasBoth(props: Set<Property>, propA: Property, propB: Property): boolean {
  return props.has(propA) && props.has(propB);
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
  match: (props: Set<Property>) => boolean;
  state: MaterialState;
  properties: Property[];
  name: string;
  description: string;
  color: string;
}

// General, property-level rules — each one covers every pair of materials
// (and, now, every environmental condition) that happens to carry the right
// properties, not just one specific pair.
const RULES: ReactionRule[] = [
  {
    id: "temporal",
    match: (p) => hasAny(p, "temporal") && (hasAny(p, "celestial") || hasAny(p, "luminous")),
    state: "energy",
    properties: ["temporal", "celestial"],
    name: "Yesterday",
    description: "A moment that should already be over, kept a little too long.",
    color: "#7a6b9a",
  },
  {
    id: "combustion",
    match: (p) => hasAny(p, "hot") && hasAny(p, "flammable"),
    state: "powder",
    properties: ["dry", "earthy"],
    name: "Ash",
    description: "What's left when something that could burn, finally did.",
    color: "#8a8580",
  },
  {
    id: "glass",
    match: (p) => hasBoth(p, "hot", "cold"),
    state: "crystalline",
    properties: ["crystalline"],
    name: "Glass",
    description: "Fire and cold, shocked into something clear.",
    color: "#a9d4e0",
  },
  {
    id: "vaporize",
    match: (p) => hasAny(p, "hot") && hasAny(p, "wet"),
    state: "gas",
    properties: ["wet", "hot", "airy"],
    name: "Steam",
    description: "Water, given enough heat to stop sitting still.",
    color: "#d8dee2",
  },
  {
    id: "freeze",
    match: (p) => hasAny(p, "cold") && hasAny(p, "wet"),
    state: "solid",
    properties: ["cold", "crystalline"],
    name: "Ice",
    description: "Water, convinced to hold still.",
    color: "#bfe6f5",
  },
  {
    id: "melt",
    match: (p) => hasAny(p, "hot") && hasAny(p, "dense"),
    state: "liquid",
    properties: ["hot", "earthy"],
    name: "Magma",
    description: "Stone that hasn't decided what shape to keep.",
    color: "#c1441f",
  },
  {
    id: "rime",
    match: (p) => hasAny(p, "cold") && hasAny(p, "dry"),
    state: "crystalline",
    properties: ["cold", "crystalline"],
    name: "Rime",
    description: "Frost, settling into every last crack.",
    color: "#dbe9ec",
  },
  {
    id: "erode",
    match: (p) => hasAny(p, "airy") && hasAny(p, "dense"),
    state: "powder",
    properties: ["earthy", "dry", "airy"],
    name: "Sandstorm",
    description: "Stone, worn small enough to fly.",
    color: "#d8c48a",
  },
  {
    id: "growth",
    match: (p) => hasAny(p, "organic") && hasAny(p, "wet"),
    state: "organic",
    properties: ["organic", "living", "wet"],
    name: "Moss",
    description: "Something patient, finally given water.",
    color: "#5c7a4a",
  },
  {
    id: "clay",
    match: (p) => hasAny(p, "wet") && hasAny(p, "dense"),
    state: "solid",
    properties: ["earthy", "wet"],
    name: "Clay",
    description: "Stone, still deciding what to become.",
    color: "#b3765a",
  },
  {
    id: "wisp",
    match: (p) => hasAny(p, "airy") && hasAny(p, "luminous"),
    state: "gas",
    properties: ["airy", "luminous"],
    name: "Wisp",
    description: "Wind, given just enough light to be seen.",
    color: "#dce4ff",
  },
  {
    id: "sand",
    match: (p) => hasAny(p, "dense") && hasAny(p, "dry"),
    state: "powder",
    properties: ["earthy", "dry"],
    name: "Sand",
    description: "Stone and dust, agreeing on a smaller size.",
    color: "#d9c9a3",
  },
  {
    id: "storm",
    match: (p) => hasAny(p, "airy") && hasAny(p, "wet"),
    state: "gas",
    properties: ["airy", "wet", "volatile"],
    name: "Storm",
    description: "Wind and water, arguing at once.",
    color: "#4a5a75",
  },
  {
    id: "compost",
    match: (p) => hasAny(p, "organic") && hasAny(p, "dry"),
    state: "organic",
    properties: ["organic", "earthy"],
    name: "Compost",
    description: "Something green, taking its time to become soil.",
    color: "#6b5d45",
  },
  {
    id: "frostbloom",
    match: (p) => hasAny(p, "cold") && hasAny(p, "organic"),
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
  temporal: { adj: "Fading", noun: "Echo" },
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

export const conditionFact =
  "Same two materials, different result — the condition adds its own property to the mix before the rules ever run, the way real heat or cold changes what a reaction actually produces.";

export interface ReactionResult {
  material: Material;
  isNew: boolean;
  isCatchAll: boolean;
  isCelestial: boolean;
  isConditional: boolean;
}

/**
 * The reaction engine. A condition (heat/cool/grind/wait) injects its own
 * property into the mix before any rule is evaluated, so the same pair of
 * materials can produce different results depending on what's applied.
 * Curated property rules run first, then a celestial-variant rule, then a
 * general catch-all that always succeeds — so nearly every pair produces
 * *something*, the way the underlying system is meant to.
 */
export function react(
  a: Material,
  b: Material,
  known: Map<string, Material>,
  condition: ConditionType = "none",
): ReactionResult | null {
  if (a.id === b.id) return null; // self-combination — handled as a fizzle by the caller

  const activeProps = new Set<Property>([...a.properties, ...b.properties, ...CONDITION_PROPERTIES[condition]]);
  const isConditional = condition !== "none";

  function finalize(id: string, build: () => Material, isCatchAll: boolean, isCelestial: boolean): ReactionResult {
    const existing = known.get(id);
    if (existing) return { material: existing, isNew: false, isCatchAll, isCelestial, isConditional };
    return { material: build(), isNew: true, isCatchAll, isCelestial, isConditional };
  }

  for (const rule of RULES) {
    if (rule.match(activeProps)) {
      const id = slug(rule.name);
      return finalize(
        id,
        () => ({
          id,
          name: rule.name,
          description: rule.description,
          state: rule.state,
          properties: rule.properties,
          color: rule.color,
          depth: Math.max(a.depth, b.depth) + 1,
          base: false,
          firstParents: [a.name, b.name],
        }),
        false,
        false,
      );
    }
  }

  // Celestial rule: anything celestial + anything else becomes a lunar variant of the other.
  if (activeProps.has("celestial")) {
    const other = a.properties.includes("celestial") ? b : a;
    const name = `Lunar ${other.name}`;
    const id = slug(name);
    return finalize(
      id,
      () => ({
        id,
        name,
        description: `${other.name}, touched by something celestial.`,
        state: other.state,
        properties: Array.from(new Set([...other.properties, "luminous", "celestial"])),
        color: blendColor(other.color, "#b6b9ff"),
        depth: Math.max(a.depth, b.depth) + 1,
        base: false,
        firstParents: [a.name, b.name],
      }),
      false,
      true,
    );
  }

  // Catch-all: every remaining pair still produces something, generated from
  // whichever property most distinguishes each side.
  const aProp = a.properties.find((p) => !b.properties.includes(p)) ?? a.properties[0];
  const bProp = b.properties.find((p) => !a.properties.includes(p)) ?? b.properties[0];
  const adj = (aProp && PROPERTY_WORDS[aProp]?.adj) ?? capitalize(a.name);
  const noun = (bProp && PROPERTY_WORDS[bProp]?.noun) ?? capitalize(b.name);
  const name = `${adj} ${noun}`;
  const id = slug(name);

  return finalize(
    id,
    () => ({
      id,
      name,
      description: `${a.name} and ${b.name}, combined into something new.`,
      state: a.state === "energy" ? b.state : a.state,
      properties: Array.from(activeProps).slice(0, 4),
      color: blendColor(a.color, b.color),
      depth: Math.max(a.depth, b.depth) + 1,
      base: false,
      firstParents: [a.name, b.name],
    }),
    true,
    false,
  );
}

export interface Stage {
  threshold: number;
  name: string;
  flavor: string;
  unlocks: ConditionType[];
}

export const STAGES: Stage[] = [
  { threshold: 0, name: "Workbench", flavor: "A small, cluttered workspace. Everything you need is within reach.", unlocks: ["none"] },
  { threshold: 8, name: "Furnace", flavor: "A furnace arrives, unasked for, already lit.", unlocks: ["heat", "cool"] },
  { threshold: 20, name: "Grinding Table", flavor: "A heavy stone table, worn smooth in the middle.", unlocks: ["grind"] },
  { threshold: 35, name: "Greenhouse", flavor: "A glass room grows off the back wall. It wasn't there before.", unlocks: [] },
  { threshold: 50, name: "Advanced Apparatus", flavor: "Instruments you don't remember acquiring, doing things you don't fully understand.", unlocks: ["wait"] },
  { threshold: 70, name: "Astronomical Wing", flavor: "A window opens onto a sky that doesn't quite match the one outside.", unlocks: [] },
  { threshold: 90, name: "The Impossible Wing", flavor: "A drawer, here, that is unmistakably larger inside than out.", unlocks: [] },
];

export function getStage(discoveredCount: number): Stage {
  let current = STAGES[0];
  for (const s of STAGES) {
    if (discoveredCount >= s.threshold) current = s;
  }
  return current;
}

export function getUnlockedConditions(discoveredCount: number): Set<ConditionType> {
  const unlocked = new Set<ConditionType>();
  for (const s of STAGES) {
    if (discoveredCount >= s.threshold) {
      for (const c of s.unlocks) unlocked.add(c);
    }
  }
  return unlocked;
}

export function nextStage(discoveredCount: number): Stage | null {
  return STAGES.find((s) => s.threshold > discoveredCount) ?? null;
}

export const selfFizzleLines = [
  "Nothing happens — it's already exactly itself.",
  "You get more of the same.",
  "It regards itself, entirely unimpressed.",
  "Same and same rarely make a third thing.",
];
