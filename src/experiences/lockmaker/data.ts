export interface Pin {
  id: string;
  correctHeight: number;
  /** A decorative pin/lever/disc that doesn't need to align — appears at higher tiers. */
  decoy: boolean;
}

export interface Wafer {
  id: string;
  correct: boolean;
  decoy: boolean;
}

export interface Ward {
  id: string;
  correctDepth: number;
}

export interface PinMechanism {
  type: "pin";
  level: number;
  pins: Pin[];
  maxHeight: number;
}

export interface LeverMechanism {
  type: "lever";
  level: number;
  levers: Pin[];
  maxHeight: number;
}

export interface DialMechanism {
  type: "dial";
  level: number;
  targets: number[];
  maxValue: number;
}

export interface WaferMechanism {
  type: "wafer";
  level: number;
  wafers: Wafer[];
}

export interface DiscMechanism {
  type: "disc";
  level: number;
  discs: Pin[];
  maxRotation: number;
}

export interface WardedMechanism {
  type: "warded";
  level: number;
  wards: Ward[];
  maxDepth: number;
}

export interface TubularMechanism {
  type: "tubular";
  level: number;
  pins: Pin[];
  maxHeight: number;
}

export interface Wheel {
  id: string;
  correctDigit: number;
}

export interface WheelMechanism {
  type: "wheel";
  level: number;
  wheels: Wheel[];
}

export interface MagneticPin {
  id: string;
  target: number;
  tolerance: number;
}

export interface MagneticMechanism {
  type: "magnetic";
  level: number;
  pins: MagneticPin[];
}

export interface KeypadMechanism {
  type: "keypad";
  level: number;
  code: number[];
}

export type Mechanism =
  | PinMechanism
  | LeverMechanism
  | DialMechanism
  | WaferMechanism
  | DiscMechanism
  | WardedMechanism
  | TubularMechanism
  | WheelMechanism
  | MagneticMechanism
  | KeypadMechanism;

// Small seeded RNG so each level is procedurally generated but reproducible.
function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const MECHANISM_TYPES: Mechanism["type"][] = [
  "pin",
  "lever",
  "wafer",
  "disc",
  "dial",
  "warded",
  "tubular",
  "wheel",
  "magnetic",
  "keypad",
];

/**
 * The mechanism type rotates every level; how many times that type has
 * come around (its "tier") is what actually scales the difficulty, so
 * each type keeps getting harder every time you meet it again.
 */
function tierFor(level: number) {
  return Math.floor((level - 1) / MECHANISM_TYPES.length) + 1;
}

function generateStack(seedBase: number, level: number, tier: number, decoysFrom: number, maxCap: number): { stack: Pin[]; maxLevel: number } {
  const rand = makeRng(seedBase + level * 131);
  const maxLevel = tier < 3 ? 5 : tier < 6 ? 6 : 7;
  const count = Math.min(3 + tier, maxCap);
  const decoyCount = tier >= decoysFrom ? Math.min(Math.floor(tier / 2), 3) : 0;

  const decoyIndices = new Set<number>();
  while (decoyIndices.size < decoyCount) {
    decoyIndices.add(Math.floor(rand() * count));
  }

  const stack = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    correctHeight: 1 + Math.floor(rand() * maxLevel),
    decoy: decoyIndices.has(i),
  }));
  return { stack, maxLevel };
}

function generateWafers(level: number, tier: number): Wafer[] {
  const rand = makeRng(4000 + level * 149);
  const count = Math.min(4 + tier, 14);
  const decoyCount = tier >= 3 ? Math.min(Math.floor(tier / 3), 3) : 0;
  const decoyIndices = new Set<number>();
  while (decoyIndices.size < decoyCount) {
    decoyIndices.add(Math.floor(rand() * count));
  }
  return Array.from({ length: count }, (_, i) => ({
    id: `w${i + 1}`,
    correct: rand() > 0.5,
    decoy: decoyIndices.has(i),
  }));
}

function generateWards(level: number, tier: number): { wards: Ward[]; maxDepth: number } {
  const rand = makeRng(5000 + level * 163);
  const maxDepth = Math.min(3 + Math.floor(tier / 2), 6);
  const count = Math.min(3 + Math.floor(tier / 2), 6);
  const wards = Array.from({ length: count }, (_, i) => ({
    id: `w${i + 1}`,
    correctDepth: 1 + Math.floor(rand() * maxDepth),
  }));
  return { wards, maxDepth };
}

function generateDial(level: number, tier: number): { targets: number[]; maxValue: number } {
  const rand = makeRng(3000 + level * 197);
  const maxValue = Math.min(8 + tier, 16);
  const targetCount = Math.min(2 + tier, 6);
  const targets = Array.from({ length: targetCount }, () => Math.floor(rand() * maxValue));
  return { targets, maxValue };
}

function generateWheels(level: number, tier: number): Wheel[] {
  const rand = makeRng(7000 + level * 179);
  const count = Math.min(3 + Math.floor(tier / 2), 6);
  return Array.from({ length: count }, (_, i) => ({
    id: `w${i + 1}`,
    correctDigit: Math.floor(rand() * 10),
  }));
}

function generateMagnetic(level: number, tier: number): MagneticPin[] {
  const rand = makeRng(9000 + level * 211);
  const count = Math.min(3 + Math.floor(tier / 2), 8);
  const tolerance = Math.max(6 - tier, 2);
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    target: Math.round(rand() * 90) + 5,
    tolerance,
  }));
}

function generateKeypad(level: number, tier: number): number[] {
  const rand = makeRng(10000 + level * 223);
  const length = Math.min(3 + Math.floor(tier / 2), 6);
  return Array.from({ length }, () => Math.floor(rand() * 10));
}

export function generateMechanism(level: number): Mechanism {
  const type = MECHANISM_TYPES[(level - 1) % MECHANISM_TYPES.length];
  const tier = tierFor(level);

  if (type === "pin") {
    const { stack, maxLevel } = generateStack(2000, level, tier, 4, 12);
    return { type, level, pins: stack, maxHeight: maxLevel };
  }
  if (type === "lever") {
    const { stack, maxLevel } = generateStack(2500, level, tier, 3, 12);
    return { type, level, levers: stack, maxHeight: maxLevel };
  }
  if (type === "disc") {
    const { stack, maxLevel } = generateStack(6000, level, tier, 4, 10);
    return { type, level, discs: stack, maxRotation: maxLevel };
  }
  if (type === "wafer") {
    return { type, level, wafers: generateWafers(level, tier) };
  }
  if (type === "warded") {
    const { wards, maxDepth } = generateWards(level, tier);
    return { type, level, wards, maxDepth };
  }
  if (type === "tubular") {
    const { stack, maxLevel } = generateStack(8000, level, tier, 4, 10);
    return { type, level, pins: stack, maxHeight: maxLevel };
  }
  if (type === "wheel") {
    return { type, level, wheels: generateWheels(level, tier) };
  }
  if (type === "magnetic") {
    return { type, level, pins: generateMagnetic(level, tier) };
  }
  if (type === "keypad") {
    return { type, level, code: generateKeypad(level, tier) };
  }
  const { targets, maxValue } = generateDial(level, tier);
  return { type, level, targets, maxValue };
}

export const typeLabels: Record<Mechanism["type"], string> = {
  pin: "Pin Tumbler",
  lever: "Lever Lock",
  wafer: "Wafer Tumbler",
  disc: "Disc Detainer",
  dial: "Combination Dial",
  warded: "Warded Lock",
  tubular: "Tubular Lock",
  wheel: "Wheel Combination",
  magnetic: "Magnetic Lock",
  keypad: "Electronic Keypad",
};

export const typeIntros: Record<Mechanism["type"], string> = {
  pin: "A stack of pins. Raise each to the height that catches the light.",
  lever: "A lever mechanism. Raise each lever carefully — go too far and it jams, and you'll have to start that one over.",
  wafer: "Flat wafers, each either up or down. Click to flip one.",
  disc: "A row of rotating discs. Click one to turn it — find the rotation that lets it settle.",
  dial: "A rotary dial. Turn it to a hidden sequence of numbers, one at a time, in order.",
  warded: "A warded case — fixed obstructions block anything but the right shape. Set every notch, then turn the key and see how many cleared.",
  tubular: "Pins arranged in a ring instead of a row. Raise each to the height that catches the light.",
  wheel: "A row of digit wheels, 0 through 9. Set every wheel, then test them together.",
  magnetic: "Magnetic pins — no clicks, just a fine adjustment. Each has a narrow sweet spot somewhere along the dial.",
  keypad: "An electronic keypad. Enter a full code and press Enter — it'll tell you how many digits were exactly right, and how many were right but misplaced.",
};

export const mechanismFact =
  "Real pin-tumbler locks work on the same idea: every pin has to reach exactly one height — the shear line — before the cylinder can turn. This mechanism is invented, but the logic isn't.";

export const leverFact =
  "Real lever locks work by lift, not push — each lever has to be raised to exactly the right gate, no further, or a guard catches it and blocks the bolt entirely.";

export const waferFact =
  "Wafer locks use flat spring-loaded pieces instead of round pins — a simpler, cheaper mechanism you'll find in filing cabinets and car doors rather than front doors.";

export const discFact =
  "Disc detainer locks use slotted rotating discs that all have to line their slots up at once — because there's no gradual give like a pin lock, they're considerably harder to feel your way through.";

export const dialFact =
  "Combination dials work through friction, not electronics — each number is a physical notch that a set of wheels has to align with, one at a time, in sequence.";

export const wardedFact =
  "Warded locks are one of the oldest designs — fixed metal obstructions inside the case block any key whose shape doesn't already match, rather than moving parts sensing the key like a pin or lever lock does.";

export const tubularFact =
  "Tubular locks arrange their pins in a circle around a cylindrical key instead of a flat row — the shape you'll recognize from bike locks and vending machines, chosen partly because it's awkward to pick with flat tools.";

export const wheelFact =
  "Wheel-based combination locks — the kind on a bike or gym locker — check every wheel at once rather than one at a time, which is exactly why they give no feedback until you try turning the whole thing.";

export const magneticFact =
  "Magnetic keys don't touch the pins at all — magnets inside the key repel or attract magnetic pins to the right position from a distance, which makes the mechanism nearly silent and very hard to pick.";

export const keypadFact =
  "Electronic keypads replaced mechanical feel with a fixed code entirely — no amount of careful pressure tells you anything, which is exactly the security trade-off they're built for.";

export const decoyFact =
  "The dulled parts in this mechanism are decorative — a real lockmaker's trick to disguise which ones actually matter.";
