export function easeInQuad(t: number) {
  return t * t;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

export type ScenarioId = "cup" | "rain" | "footprints";

export interface ScenarioMeta {
  id: ScenarioId;
  label: string;
  totalFrames: number;
  forwardCaption: string;
  reverseCaption: string;
  idleCaption: string;
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    id: "cup",
    label: "A falling cup",
    totalFrames: 240,
    forwardCaption: "Right way around: it breaks, like it's supposed to.",
    reverseCaption: "Rewind, and it puts itself back together — like it never happened.",
    idleCaption: "Scrub the timeline, or press play.",
  },
  {
    id: "rain",
    label: "Rain on a puddle",
    totalFrames: 260,
    forwardCaption: "Right way around: drops fall, ripples spread outward.",
    reverseCaption: "Rewind, and the ripples gather themselves back into a single drop, which lifts away.",
    idleCaption: "Scrub the timeline, or press play.",
  },
  {
    id: "footprints",
    label: "Footprints in sand",
    totalFrames: 220,
    forwardCaption: "Right way around: each step leaves something behind.",
    reverseCaption: "Rewind, and the sand forgets, one footprint at a time.",
    idleCaption: "Scrub the timeline, or press play.",
  },
];
