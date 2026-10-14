/**
 * Shared seeded random number utilities.
 *
 * A plain LCG's very first output is a smooth function of its seed, so
 * sequential seeds (level * k + c) would otherwise produce long runs of
 * near-identical early results. Every seed is scrambled with an integer hash
 * (MurmurHash3 finalizer) before it enters the generator.
 */
export function hashSeed(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  x ^= x >>> 16;
  return x >>> 0;
}

export function makeRng(seed: number): () => number {
  let s = hashSeed(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
