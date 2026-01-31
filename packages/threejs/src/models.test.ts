import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getCube, getBall } from './models';
import type { CoordinateTuple } from './types';

describe('getCube', () => {
  let scene: THREE.Scene;
  let world: RAPIER.World;

  beforeEach(async () => {
    await RAPIER.init();
    scene = new THREE.Scene();
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    world = new RAPIER.World(gravity);
  });

  describe('origin parameter', () => {
    it('should position cube bottom at y=0 by default', () => {
      const size: CoordinateTuple = [10, 10, 10];
      const position: CoordinateTuple = [0, 0, 0];
      
      const cube = getCube(scene, world, {
        size,
        position,
        type: 'fixed',
      });

      // Get the bounding box to check actual geometry position
      const box = new THREE.Box3().setFromObject(cube);
      
      // Bottom of cube should be at y=0 (default origin: { y: 0 })
      expect(box.min.y).toBeCloseTo(0, 5);
      // Top should be at y=10 (size[1])
      expect(box.max.y).toBeCloseTo(10, 5);
    });

    it('should position cube bottom at specified y origin', () => {
      const size: CoordinateTuple = [10, 20, 10];
      const position: CoordinateTuple = [0, 5, 0];
      
      const cube = getCube(scene, world, {
        size,
        position,
        origin: { y: 5 },
        type: 'fixed',
      });

      const box = new THREE.Box3().setFromObject(cube);
      
      // Bottom should be at y=5 (position)
      expect(box.min.y).toBeCloseTo(5, 5);
      // Top should be at y=25 (position + size[1])
      expect(box.max.y).toBeCloseTo(25, 5);
    });

    it('should position cube left edge at x=0 when origin x is specified', () => {
      const size: CoordinateTuple = [10, 10, 10];
      const position: CoordinateTuple = [0, 0, 0];
      
      const cube = getCube(scene, world, {
        size,
        position,
        origin: { x: 0 },
        type: 'fixed',
      });

      const box = new THREE.Box3().setFromObject(cube);
      
      // Left edge should be at x=0
      expect(box.min.x).toBeCloseTo(0, 5);
      // Right edge should be at x=10
      expect(box.max.x).toBeCloseTo(10, 5);
    });

    it('should position cube back edge at z=0 when origin z is specified', () => {
      const size: CoordinateTuple = [10, 10, 10];
      const position: CoordinateTuple = [0, 0, 0];
      
      const cube = getCube(scene, world, {
        size,
        position,
        origin: { z: 0 },
        type: 'fixed',
      });

      const box = new THREE.Box3().setFromObject(cube);
      
      // Back edge should be at z=0
      expect(box.min.z).toBeCloseTo(0, 5);
      // Front edge should be at z=10
      expect(box.max.z).toBeCloseTo(10, 5);
    });

    it('should handle multiple origin axes simultaneously', () => {
      const size: CoordinateTuple = [10, 20, 30];
      const position: CoordinateTuple = [5, 10, 15];
      
      const cube = getCube(scene, world, {
        size,
        position,
        origin: { x: 5, y: 10, z: 15 },
        type: 'fixed',
      });

      const box = new THREE.Box3().setFromObject(cube);
      
      // All minimum edges should be at the position values
      expect(box.min.x).toBeCloseTo(5, 5);
      expect(box.min.y).toBeCloseTo(10, 5);
      expect(box.min.z).toBeCloseTo(15, 5);
      
      // All maximum edges should be at position + size
      expect(box.max.x).toBeCloseTo(15, 5);
      expect(box.max.y).toBeCloseTo(30, 5);
      expect(box.max.z).toBeCloseTo(45, 5);
    });

    it('should center cube when origin is not specified for an axis', () => {
      const size: CoordinateTuple = [10, 10, 10];
      const position: CoordinateTuple = [0, 0, 0];
      
      // Only specify y origin, x and z should remain centered
      const cube = getCube(scene, world, {
        size,
        position,
        origin: { y: 0 },
        type: 'fixed',
      });

      const box = new THREE.Box3().setFromObject(cube);
      
      // Y should be at bottom (0 to 10)
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(box.max.y).toBeCloseTo(10, 5);
      
      // X should be centered (-5 to 5)
      expect(box.min.x).toBeCloseTo(-5, 5);
      expect(box.max.x).toBeCloseTo(5, 5);
      
      // Z should be centered (-5 to 5)
      expect(box.min.z).toBeCloseTo(-5, 5);
      expect(box.max.z).toBeCloseTo(5, 5);
    });

    it('should work with different cube sizes', () => {
      const testCases: Array<{ size: CoordinateTuple; position: CoordinateTuple }> = [
        { size: [2, 4, 6], position: [0, 0, 0] },
        { size: [100, 50, 25], position: [10, 20, 30] },
        { size: [1, 1, 1], position: [-5, -10, 5] },
      ];

      testCases.forEach(({ size, position }) => {
        const cube = getCube(scene, world, {
          size,
          position,
          origin: { y: position[1] },
          type: 'fixed',
        });

        const box = new THREE.Box3().setFromObject(cube);
        
        // Bottom should be at position[1]
        expect(box.min.y).toBeCloseTo(position[1], 5);
        // Top should be at position[1] + size[1]
        expect(box.max.y).toBeCloseTo(position[1] + size[1], 5);
      });
    });

    it('should allow disabling origin behavior by passing empty object', () => {
      const size: CoordinateTuple = [10, 10, 10];
      const position: CoordinateTuple = [0, 0, 0];
      
      const cube = getCube(scene, world, {
        size,
        position,
        origin: {},
        type: 'fixed',
      });

      const box = new THREE.Box3().setFromObject(cube);
      
      // Cube should be centered (no origin adjustment)
      expect(box.min.y).toBeCloseTo(-5, 5);
      expect(box.max.y).toBeCloseTo(5, 5);
    });
  });

  describe('onSpawn callback', () => {
    it('should invoke onSpawn callback when cube is created', () => {
      const onSpawn = vi.fn();

      getCube(scene, world, {
        size: [10, 10, 10],
        position: [0, 0, 0],
        type: 'fixed',
        onSpawn
      });

      expect(onSpawn).toHaveBeenCalledOnce();
    });

    it('should attach onSpawn callback to userData', () => {
      const onSpawn = vi.fn();

      const cube = getCube(scene, world, {
        size: [10, 10, 10],
        position: [0, 0, 0],
        type: 'fixed',
        onSpawn
      });

      expect(cube.userData.onSpawn).toBe(onSpawn);
    });

    it('should not invoke onSpawn if not provided', () => {
      const cube = getCube(scene, world, {
        size: [10, 10, 10],
        position: [0, 0, 0],
        type: 'fixed'
      });

      expect(cube.userData.onSpawn).toBeUndefined();
    });
  });
});

describe('getBall', () => {
  let scene: THREE.Scene;
  let world: RAPIER.World;

  beforeEach(async () => {
    await RAPIER.init();
    scene = new THREE.Scene();
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    world = new RAPIER.World(gravity);
  });

  describe('onSpawn callback', () => {
    it('should invoke onSpawn callback when ball is created', () => {
      const onSpawn = vi.fn();

      getBall(scene, world, {
        size: 5,
        position: [0, 0, 0],
        type: 'fixed',
        onSpawn
      });

      expect(onSpawn).toHaveBeenCalledOnce();
    });

    it('should attach onSpawn callback to userData', () => {
      const onSpawn = vi.fn();

      const ball = getBall(scene, world, {
        size: 5,
        position: [0, 0, 0],
        type: 'fixed',
        onSpawn
      });

      expect(ball.userData.onSpawn).toBe(onSpawn);
    });
  });
});
