export interface CityNode {
  id: string;
  name: string;
  x: number; // percentage across the map
  y: number; // percentage down the map
}

export const NODES: CityNode[] = [
  { id: "venice", name: "Venice", x: 8, y: 30 },
  { id: "constantinople", name: "Constantinople", x: 21, y: 33 },
  { id: "damascus", name: "Damascus", x: 31, y: 47 },
  { id: "baghdad", name: "Baghdad", x: 39, y: 43 },
  { id: "delhi", name: "Delhi", x: 49, y: 63 },
  { id: "samarkand", name: "Samarkand", x: 53, y: 30 },
  { id: "kashgar", name: "Kashgar", x: 69, y: 27 },
  { id: "changan", name: "Chang'an", x: 87, y: 36 },
];

export const EDGES: [string, string][] = [
  ["venice", "constantinople"],
  ["constantinople", "damascus"],
  ["damascus", "baghdad"],
  ["baghdad", "samarkand"],
  ["baghdad", "delhi"],
  ["samarkand", "delhi"],
  ["samarkand", "kashgar"],
  ["kashgar", "changan"],
];

export interface Good {
  name: string;
  color: string;
}

export const GOODS: Good[] = [
  { name: "Silk", color: "#d5ad52" },
  { name: "Spice", color: "#b85b52" },
  { name: "Paper", color: "#e8e3d4" },
  { name: "Glass", color: "#5e9078" },
  { name: "Tea", color: "#8fae7a" },
  { name: "An idea", color: "#9a7fc9" },
];
