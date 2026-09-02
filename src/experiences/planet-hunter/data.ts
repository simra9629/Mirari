export interface LightCurve {
  samples: number[]; // brightness values, baseline ~1.0
  transitCenters: number[]; // sample indices of true, periodic transit midpoints
  decoyCenters: number[]; // one-off dips that look similar but don't repeat
  tolerance: number;
}

function makeRng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function smoothDip(v: number, center: number, i: number, width: number, depth: number): number {
  const d = Math.abs(i - center);
  if (d > width) return v;
  const t = 1 - d / width;
  return v - depth * (t * t * (3 - 2 * t));
}

export function generateLightCurve(level: number): LightCurve {
  const rand = makeRng(level * 7919 + 3);
  const length = 240;
  const period = 32 + Math.floor(rand() * 10);
  const width = 5 + Math.floor(rand() * 2);
  // Depth now sits close to the noise floor — no single dip should read as
  // obviously "the" transit on its own. Only the repeating period gives it away.
  const depth = 0.028 + rand() * 0.014;
  const firstCenter = 12 + Math.floor(rand() * 12);
  const noiseAmp = 0.02;

  const transitCenters: number[] = [];
  for (let c = firstCenter; c < length - width; c += period) {
    transitCenters.push(c);
  }

  // Decoy dips: similar depth, but placed off the true period so they never repeat.
  const decoyCount = Math.min(2 + Math.floor(level / 2), 5);
  const decoyCenters: number[] = [];
  let attempts = 0;
  while (decoyCenters.length < decoyCount && attempts < 200) {
    attempts++;
    const pos = width + 4 + Math.floor(rand() * (length - 2 * width - 8));
    const tooCloseToTransit = transitCenters.some((c) => Math.abs(c - pos) < width * 2.2);
    const tooCloseToDecoy = decoyCenters.some((c) => Math.abs(c - pos) < width * 2.2);
    if (!tooCloseToTransit && !tooCloseToDecoy) decoyCenters.push(pos);
  }

  const samples: number[] = [];
  for (let i = 0; i < length; i++) {
    let v = 1.0;
    v += (rand() - 0.5) * noiseAmp + (rand() - 0.5) * (noiseAmp * 0.6);
    for (const c of transitCenters) v = smoothDip(v, c, i, width, depth);
    for (const c of decoyCenters) {
      // Decoys vary a bit in depth so they're not a giveaway by uniformity either.
      const decoyDepth = depth * (0.75 + rand() * 0.6);
      v = smoothDip(v, c, i, width, decoyDepth);
    }
    samples.push(v);
  }

  return { samples, transitCenters, decoyCenters, tolerance: width + 2 };
}

export const planetHunterFacts = [
  "The transit method — watching a star's brightness dip as a planet passes in front of it — has found the majority of known exoplanets, most of them by NASA's Kepler space telescope.",
  "A transit dip from an Earth-sized planet crossing a Sun-like star dims the star's light by less than a hundredth of one percent — astronomers are measuring flickers smaller than a firefly next to a lighthouse.",
  "A single transit isn't enough to confirm a planet — astronomers wait for the dip to repeat at a precisely consistent period before they'll call it real, since starspots and instrument noise can fake a one-off dip just as deep.",
];
