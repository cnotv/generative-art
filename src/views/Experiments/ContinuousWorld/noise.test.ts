import { describe, it, expect } from 'vitest';
import { simplexNoise2D, fractalNoise } from './noise';
import type { NoiseConfig } from './types';

describe('simplexNoise2D', () => {
  it('returns deterministic values for the same inputs', () => {
    const value1 = simplexNoise2D(1.5, 2.5, 42);
    const value2 = simplexNoise2D(1.5, 2.5, 42);
    expect(value1).toBe(value2);
  });

  it('returns different values for different seeds', () => {
    const value1 = simplexNoise2D(1.5, 2.5, 42);
    const value2 = simplexNoise2D(1.5, 2.5, 99);
    expect(value1).not.toBe(value2);
  });

  it('returns different values for different coordinates', () => {
    const value1 = simplexNoise2D(0, 0, 42);
    const value2 = simplexNoise2D(10, 10, 42);
    expect(value1).not.toBe(value2);
  });

  it.each([
    [0, 0, 42],
    [100, 200, 1],
    [-50, 75, 999],
    [0.5, 0.5, 42],
  ])('returns values in [-1, 1] for (%f, %f, seed=%i)', (x, z, seed) => {
    const value = simplexNoise2D(x, z, seed);
    expect(value).toBeGreaterThanOrEqual(-1);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe('fractalNoise', () => {
  const defaultConfig: NoiseConfig = {
    seed: 42,
    octaves: 4,
    frequency: 0.02,
    amplitude: 8,
    lacunarity: 2,
    persistence: 0.5,
  };

  it('returns deterministic values for the same inputs', () => {
    const value1 = fractalNoise(10, 20, defaultConfig);
    const value2 = fractalNoise(10, 20, defaultConfig);
    expect(value1).toBe(value2);
  });

  it('returns different values for different seeds', () => {
    const value1 = fractalNoise(10, 20, defaultConfig);
    const value2 = fractalNoise(10, 20, { ...defaultConfig, seed: 99 });
    expect(value1).not.toBe(value2);
  });

  it('produces smooth variation across coordinates', () => {
    const values = Array.from({ length: 10 }, (_, index) =>
      fractalNoise(index * 5, 0, defaultConfig)
    );
    const hasVariation = new Set(values).size > 1;
    expect(hasVariation).toBe(true);
  });

  it('produces seamless values at chunk boundaries', () => {
    const chunkSize = 32;
    const valueAtEdge = fractalNoise(chunkSize - 0.001, 0, defaultConfig);
    const valueJustPast = fractalNoise(chunkSize + 0.001, 0, defaultConfig);
    const difference = Math.abs(valueAtEdge - valueJustPast);
    expect(difference).toBeLessThan(0.1);
  });
});
