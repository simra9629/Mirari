export const TOWN_NAMES = [
  "Millbrook",
  "Harrow's End",
  "Coldwater",
  "Fenbridge",
  "Ashcombe",
  "Thistlewick",
  "Greymoor",
  "Larkspur",
  "Oakhollow",
  "Wrenfield",
  "Silverdale",
  "Foxbury",
];

export const RAIL_FACTS = [
  "The first public railway to carry passengers, the Stockton and Darlington, opened in 1825 — and for years, horses still pulled some of the carriages alongside the steam engines.",
  "Standard rail gauge — 4 feet 8½ inches — traces back to the wheel spacing of horse-drawn wagons, chosen so early trains could reuse existing wagonway tracks.",
  "Railway curves are banked (tilted) on purpose — the outer rail is built slightly higher so a train leans naturally into the turn instead of fighting it.",
  "Before radios, railway signals relied entirely on semaphore arms and colored lights — a language of angles and colors a driver had to read at speed, from a distance.",
  "Some of the steepest railways in the world use a center rack rail that a matching gear on the train grips — regular friction alone isn't enough to climb the grade.",
];

function hash2(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h % 2147483647) + 2147483647) % 2147483647;
}

/** Deterministic 0..1 pseudo-random value for a given world cell — used for scattering background terrain without storing an infinite array. */
export function cellRandom(x: number, y: number, seed = 11): number {
  return hash2(x, y, seed) / 2147483647;
}
