export interface ElementDef {
  id: string;
  name: string;
  description: string;
  color: string;
  base: boolean;
}

export const elements: Record<string, ElementDef> = {
  ember: { id: "ember", name: "Ember", description: "A coal that never fully cools.", color: "#e6754d", base: true },
  frost: { id: "frost", name: "Frost", description: "Cold enough to slow a held breath.", color: "#7ec8e3", base: true },
  root: { id: "root", name: "Root", description: "Grows toward whatever it's given.", color: "#7a9e5f", base: true },
  tide: { id: "tide", name: "Tide", description: "Water that remembers the moon.", color: "#3f7ea6", base: true },
  gale: { id: "gale", name: "Gale", description: "Wind that carries more than air.", color: "#c7d1d8", base: true },
  glimmer: { id: "glimmer", name: "Glimmer", description: "A light with no visible source.", color: "#b6b9ff", base: true },

  glass: { id: "glass", name: "Glass", description: "Fire and cold, shocked into something clear.", color: "#a9d4e0", base: false },
  ash: { id: "ash", name: "Ash", description: "What's left when Root forgets to grow.", color: "#8a8580", base: false },
  steam: { id: "steam", name: "Steam", description: "Tide, unable to sit still near Ember.", color: "#d8dee2", base: false },
  wildfire: { id: "wildfire", name: "Wildfire", description: "Ember that learned to travel.", color: "#e8562f", base: false },
  spark: { id: "spark", name: "Spark", description: "A small, deliberate kind of Ember.", color: "#ffcf6b", base: false },
  frostbloom: { id: "frostbloom", name: "Frostbloom", description: "A flower that only opens in the cold.", color: "#cfe8f0", base: false },
  ice: { id: "ice", name: "Ice", description: "Tide, held perfectly still.", color: "#bfe6f5", base: false },
  blizzard: { id: "blizzard", name: "Blizzard", description: "Frost given somewhere to go.", color: "#e4f1f7", base: false },
  prism: { id: "prism", name: "Prism", description: "Frost that learned to bend Glimmer.", color: "#d6c9f5", base: false },
  moss: { id: "moss", name: "Moss", description: "Root, patient enough to wait for Tide.", color: "#5c7a4a", base: false },
  spore: { id: "spore", name: "Spore", description: "Root, sent traveling on Gale.", color: "#9fae7a", base: false },
  glowvine: { id: "glowvine", name: "Glowvine", description: "A vine that keeps its own small light.", color: "#9fd18a", base: false },
  storm: { id: "storm", name: "Storm", description: "Tide and Gale, arguing at once.", color: "#4a5a75", base: false },
  pearl: { id: "pearl", name: "Pearl", description: "A single held moment of Tide and Glimmer.", color: "#f0e6d2", base: false },
  wisp: { id: "wisp", name: "Wisp", description: "Gale, given just enough light to be seen.", color: "#dce4ff", base: false },
  mirage: { id: "mirage", name: "Mirage", description: "Steam, catching Glimmer at the wrong angle.", color: "#f5d9c8", base: false },
  lightning: { id: "lightning", name: "Lightning", description: "Storm, for one instant, fully lit.", color: "#f5f0a0", base: false },
  crystal: { id: "crystal", name: "Crystal", description: "Ice, grown around a single Spark.", color: "#c9e8ff", base: false },
};

// Key: sorted "a|b" of base element ids -> resulting element id.
export const recipes: Record<string, string> = {
  "ember|frost": "glass",
  "ember|root": "ash",
  "ember|tide": "steam",
  "ember|gale": "wildfire",
  "ember|glimmer": "spark",
  "frost|root": "frostbloom",
  "frost|tide": "ice",
  "frost|gale": "blizzard",
  "frost|glimmer": "prism",
  "root|tide": "moss",
  "root|gale": "spore",
  "root|glimmer": "glowvine",
  "tide|gale": "storm",
  "tide|glimmer": "pearl",
  "gale|glimmer": "wisp",
  "steam|glimmer": "mirage",
  "storm|glimmer": "lightning",
  "ice|spark": "crystal",
};

export function combine(aId: string, bId: string): string | null {
  const key = [aId, bId].sort().join("|");
  return recipes[key] ?? null;
}

export const baseElementIds = Object.values(elements)
  .filter((e) => e.base)
  .map((e) => e.id);
