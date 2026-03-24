import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateWallPositions, ISLAND_SIZE, WALL_CELL_SIZE } from './config';
import { checkCoinCollection, updateCoinSpin } from './helpers/coins';
import { computeChaseDirection, checkWaspCatch } from './helpers/enemies';
import type { ComplexModel } from '@webgamekit/threejs';

describe('generateWallPositions', () => {
  it('returns positions along all 4 edges', () => {
    const positions = generateWallPositions(ISLAND_SIZE, WALL_CELL_SIZE);
    const expectedPerEdge = Math.floor(ISLAND_SIZE / WALL_CELL_SIZE);
    expect(positions.length).toBe(expectedPerEdge * 4);
  });

  it('all positions are within island bounds', () => {
    const positions = generateWallPositions(20, 4);
    const half = 10;
    positions.forEach(([x, , z]) => {
      expect(Math.abs(x)).toBeLessThanOrEqual(half + 2);
      expect(Math.abs(z)).toBeLessThanOrEqual(half + 2);
    });
  });

  it('returns empty array for zero island size', () => {
    expect(generateWallPositions(0, 4)).toEqual([]);
  });
});

describe('checkCoinCollection', () => {
  const createCoin = (x: number, z: number): ComplexModel => ({
    position: new THREE.Vector3(x, 1, z),
    userData: {},
  } as unknown as ComplexModel);

  it.each([
    {
      playerPos: new THREE.Vector3(0, 0, 0),
      coins: [createCoin(1, 0), createCoin(10, 10)],
      radius: 2,
      expected: [0],
      description: 'returns index of coin within radius',
    },
    {
      playerPos: new THREE.Vector3(0, 0, 0),
      coins: [createCoin(10, 10), createCoin(20, 20)],
      radius: 2,
      expected: [],
      description: 'returns empty when no coins within radius',
    },
    {
      playerPos: new THREE.Vector3(5, 0, 5),
      coins: [createCoin(5, 5), createCoin(6, 5), createCoin(50, 50)],
      radius: 3,
      expected: [0, 1],
      description: 'returns multiple indices when multiple coins within radius',
    },
  ])('$description', ({ playerPos, coins, radius, expected }) => {
    expect(checkCoinCollection(playerPos, coins, radius)).toEqual(expected);
  });
});

describe('updateCoinSpin', () => {
  it('rotates coin meshes around Y axis', () => {
    const coin = { rotation: { y: 0 } } as unknown as ComplexModel;
    updateCoinSpin([coin], 0.5, 2);
    expect(coin.rotation.y).toBeCloseTo(1);
  });
});

describe('computeChaseDirection', () => {
  it.each([
    {
      waspPos: new THREE.Vector3(0, 0, 0),
      playerPos: new THREE.Vector3(10, 0, 0),
      expectedX: 1,
      expectedZ: 0,
      description: 'returns normalized direction toward player along X',
    },
    {
      waspPos: new THREE.Vector3(5, 0, 5),
      playerPos: new THREE.Vector3(5, 0, 5),
      expectedX: 0,
      expectedZ: 0,
      description: 'returns zero when wasp is at player position',
    },
  ])('$description', ({ waspPos, playerPos, expectedX, expectedZ }) => {
    const dir = computeChaseDirection(waspPos, playerPos);
    expect(dir.x).toBeCloseTo(expectedX);
    expect(dir.z).toBeCloseTo(expectedZ);
    expect(dir.y).toBe(0);
  });
});

describe('checkWaspCatch', () => {
  it('returns true when wasp is within catch radius', () => {
    const wasp = { position: new THREE.Vector3(1, 0, 0) } as unknown as ComplexModel;
    expect(checkWaspCatch(new THREE.Vector3(0, 0, 0), [wasp], 2)).toBe(true);
  });

  it('returns false when all wasps are far away', () => {
    const wasp = { position: new THREE.Vector3(50, 0, 0) } as unknown as ComplexModel;
    expect(checkWaspCatch(new THREE.Vector3(0, 0, 0), [wasp], 2)).toBe(false);
  });
});
