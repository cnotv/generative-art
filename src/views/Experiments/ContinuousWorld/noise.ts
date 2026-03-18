import type { NoiseConfig } from './types';

/**
 * Permutation table seeded deterministically.
 * Returns a 512-element array for wrapping gradient lookups.
 */
const createPermutationTable = (seed: number): number[] => {
  const base = Array.from({ length: 256 }, (_, index) => index);
  const seededShuffle = (array: number[], shuffleSeed: number): number[] => {
    const result = [...array];
    let currentSeed = shuffleSeed;
    result.reduceRight((_, __, index) => {
      currentSeed = (currentSeed * 16807 + 0) % 2147483647;
      const swapIndex = currentSeed % (index + 1);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      return null;
    }, null);
    return result;
  };
  const shuffled = seededShuffle(base, seed);
  return [...shuffled, ...shuffled];
};

/** 2D gradient vectors for simplex noise */
const GRADIENTS_2D = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

const dot2 = (gradient: number[], x: number, y: number): number =>
  gradient[0] * x + gradient[1] * y;

const SKEW_FACTOR = 0.5 * (Math.sqrt(3) - 1);
const UNSKEW_FACTOR = (3 - Math.sqrt(3)) / 6;

/**
 * 2D simplex noise, seeded and pure.
 * @returns Value in [-1, 1]
 */
export const simplexNoise2D = (x: number, z: number, seed: number): number => {
  const permutation = createPermutationTable(seed);

  const skew = (x + z) * SKEW_FACTOR;
  const skewedI = Math.floor(x + skew);
  const skewedJ = Math.floor(z + skew);

  const unskew = (skewedI + skewedJ) * UNSKEW_FACTOR;
  const originX = skewedI - unskew;
  const originZ = skewedJ - unskew;

  const distanceX0 = x - originX;
  const distanceZ0 = z - originZ;

  const [offsetI1, offsetJ1] = distanceX0 > distanceZ0 ? [1, 0] : [0, 1];

  const distanceX1 = distanceX0 - offsetI1 + UNSKEW_FACTOR;
  const distanceZ1 = distanceZ0 - offsetJ1 + UNSKEW_FACTOR;
  const distanceX2 = distanceX0 - 1.0 + 2.0 * UNSKEW_FACTOR;
  const distanceZ2 = distanceZ0 - 1.0 + 2.0 * UNSKEW_FACTOR;

  const wrappedI = skewedI & 255;
  const wrappedJ = skewedJ & 255;

  const computeContribution = (dx: number, dz: number, gradientIndex: number): number => {
    const attenuation = 0.5 - dx * dx - dz * dz;
    if (attenuation < 0) return 0;
    const gradient = GRADIENTS_2D[gradientIndex % 8];
    return attenuation * attenuation * attenuation * attenuation * dot2(gradient, dx, dz);
  };

  const gradientIndex0 = permutation[wrappedI + permutation[wrappedJ]];
  const gradientIndex1 = permutation[wrappedI + offsetI1 + permutation[wrappedJ + offsetJ1]];
  const gradientIndex2 = permutation[wrappedI + 1 + permutation[wrappedJ + 1]];

  const contribution0 = computeContribution(distanceX0, distanceZ0, gradientIndex0);
  const contribution1 = computeContribution(distanceX1, distanceZ1, gradientIndex1);
  const contribution2 = computeContribution(distanceX2, distanceZ2, gradientIndex2);

  return 70.0 * (contribution0 + contribution1 + contribution2);
};

/**
 * Fractal (multi-octave) noise for natural terrain variation.
 * @returns Value scaled by amplitude
 */
export const fractalNoise = (
  x: number,
  z: number,
  config: NoiseConfig
): number => {
  const { seed, octaves, frequency, amplitude, lacunarity, persistence } = config;

  const totalNoise = Array.from({ length: octaves }).reduce<{ value: number; currentFrequency: number; currentAmplitude: number }>(
    (accumulator, _, octaveIndex) => {
      const noiseValue = simplexNoise2D(
        x * accumulator.currentFrequency,
        z * accumulator.currentFrequency,
        seed + octaveIndex * 1000
      );
      return {
        value: accumulator.value + noiseValue * accumulator.currentAmplitude,
        currentFrequency: accumulator.currentFrequency * lacunarity,
        currentAmplitude: accumulator.currentAmplitude * persistence,
      };
    },
    { value: 0, currentFrequency: frequency, currentAmplitude: amplitude }
  );

  return totalNoise.value;
};
