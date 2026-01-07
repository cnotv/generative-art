import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getOffset, getInstanceConfig } from './index';
import type { InstanceConfig, CoordinateTuple } from './types';

describe('threejs', () => {
  describe('getOffset', () => {
    it('should calculate offset based on model position and rotation', () => {
      const model = new THREE.Object3D();
      model.position.set(10, 0, 0);
      // No rotation
      
      const config = { offset: { x: 5, y: 0, z: 0 } };
      const offset = getOffset(model as any, config);
      
      // Should be position (10,0,0) + offset (5,0,0) = (15,0,0)
      expect(offset.x).toBe(15);
      expect(offset.y).toBe(0);
      expect(offset.z).toBe(0);
    });

    it('should respect model rotation', () => {
      const model = new THREE.Object3D();
      model.position.set(0, 0, 0);
      // Rotate 90 degrees around Y
      model.rotateY(Math.PI / 2);
      
      // Offset x=5 (local right) should become z=-5 (world forward/back depending on coord system)
      // Three.js: x is right, y is up, z is out of screen.
      // Rotate 90 deg Y: x axis points to -z.
      const config = { offset: { x: 5, y: 0, z: 0 } };
      const offset = getOffset(model as any, config);
      
      expect(offset.x).toBeCloseTo(0);
      expect(offset.z).toBeCloseTo(-5);
    });
  });

  describe('getInstanceConfig', () => {
    it('should generate correct number of instances with amount', () => {
      const config: InstanceConfig = {
        amount: 5,
        size: [1, 1, 1],
      };
      const groundSize: CoordinateTuple = [100, 100, 100];
      
      const instances = getInstanceConfig(config, groundSize);
      expect(instances).toHaveLength(5);
      expect(instances[0]).toHaveProperty('position');
      expect(instances[0]).toHaveProperty('rotation');
      expect(instances[0]).toHaveProperty('scale');
    });

    it('should apply size with sizeVariation', () => {
      const config: InstanceConfig = {
        amount: 20,
        size: [100, 100, 100],
        sizeVariation: [20, 20, 20],
      };
      const groundSize: CoordinateTuple = [1000, 100, 1000];
      
      const instances = getInstanceConfig(config, groundSize);
      
      instances.forEach(instance => {
        const [scaleX, scaleY, scaleZ] = instance.scale;
        // Size should be in range [base - variation/2, base + variation/2]
        expect(scaleX).toBeGreaterThanOrEqual(100 - 10);
        expect(scaleX).toBeLessThanOrEqual(100 + 10);
        expect(scaleY).toBeGreaterThanOrEqual(100 - 10);
        expect(scaleY).toBeLessThanOrEqual(100 + 10);
        expect(scaleZ).toBeGreaterThanOrEqual(100 - 10);
        expect(scaleZ).toBeLessThanOrEqual(100 + 10);
      });
    });

    it('should apply position with positionVariation', () => {
      const config: InstanceConfig = {
        amount: 10,
        size: [50, 50, 50],
        position: [0, 100, -200],
        positionVariation: [50, 20, 30],
      };
      const groundSize: CoordinateTuple = [1000, 100, 1000];
      
      const instances = getInstanceConfig(config, groundSize);
      
      instances.forEach(instance => {
        const [x, y, z] = instance.position;
        // Position should be within base +/- variation/2
        expect(x).toBeGreaterThanOrEqual(0 - 25);
        expect(x).toBeLessThanOrEqual(0 + 25);
        expect(y).toBeGreaterThanOrEqual(100 - 10);
        expect(y).toBeLessThanOrEqual(100 + 10);
        expect(z).toBeGreaterThanOrEqual(-200 - 15);
        expect(z).toBeLessThanOrEqual(-200 + 15);
      });
    });

    it('should apply rotation with rotationVariation', () => {
      const config: InstanceConfig = {
        amount: 10,
        size: [50, 50, 50],
        rotation: [0, 90, 0],
        rotationVariation: [0, 180, 0],
      };
      const groundSize: CoordinateTuple = [1000, 100, 1000];
      
      const instances = getInstanceConfig(config, groundSize);
      
      instances.forEach(instance => {
        const [rx, ry, rz] = instance.rotation;
        expect(rx).toBe(0);
        // Y rotation should vary around 90
        expect(ry).toBeGreaterThanOrEqual(90 - 90);
        expect(ry).toBeLessThanOrEqual(90 + 90);
        expect(rz).toBe(0);
      });
    });

    it('should support legacy area-based positioning', () => {
      const config: InstanceConfig = {
        amount: 5,
        size: [1, 1, 1],
        area: 10,
      };
      const groundSize: CoordinateTuple = [100, 100, 100];
      
      const instances = getInstanceConfig(config, groundSize);
      expect(instances).toHaveLength(5);
      
      // Check positions are within expected range for area-based calculation
      instances.forEach(instance => {
        const [x] = instance.position;
        const maxPos = groundSize[0] / (config.area!) / 2;
        expect(x).toBeGreaterThanOrEqual(-maxPos);
        expect(x).toBeLessThanOrEqual(maxPos);
      });
    });

    it('should support legacy spacing-based positioning', () => {
      const config: InstanceConfig = {
        amount: 4,
        size: [200, 200, 200],
        spacing: 600,
        position: [0, 130, -300],
        positionVariation: [100, 20, 0],
      };
      const groundSize: CoordinateTuple = [1000, 100, 1000];
      
      const instances = getInstanceConfig(config, groundSize);
      expect(instances).toHaveLength(4);
      
      instances.forEach(instance => {
        const [, y, z] = instance.position;
        // Y and Z should be applied from position
        expect(y).toBeGreaterThanOrEqual(130 - 10);
        expect(y).toBeLessThanOrEqual(130 + 10);
        expect(z).toBeGreaterThanOrEqual(-300 - 0);
        expect(z).toBeLessThanOrEqual(-300 + 0);
      });
      
      // Check spacing is roughly applied
      const x0 = instances[0].position[0];
      const x1 = instances[1].position[0];
      const spacing = Math.abs(x1 - x0);
      expect(spacing).toBeGreaterThan(500); // 600 - 100 variation
      expect(spacing).toBeLessThan(700); // 600 + 100 variation
    });

    it('should support legacy ratio for scale', () => {
      const config: InstanceConfig = {
        amount: 3,
        size: [100, 100, 100],
        ratio: 2.5,
      };
      const groundSize: CoordinateTuple = [1000, 100, 1000];
      
      const instances = getInstanceConfig(config, groundSize);
      
      instances.forEach(instance => {
        const [scaleX, scaleY, scaleZ] = instance.scale;
        // X scale should be multiplied by ratio
        expect(scaleX).toBeCloseTo(100 * 2.5, 1);
        // Y and Z should remain at base size
        expect(scaleY).toBeCloseTo(100, 1);
        expect(scaleZ).toBeCloseTo(100, 1);
      });
    });

    it('should handle default values when no config provided', () => {
      const config: InstanceConfig = {
        size: [1, 1, 1],
      };
      const groundSize: CoordinateTuple = [100, 100, 100];
      
      const instances = getInstanceConfig(config, groundSize);
      expect(instances).toHaveLength(1); // Default amount
      
      const instance = instances[0];
      expect(instance.position).toEqual([0, 0, 0]);
      expect(instance.rotation).toEqual([0, 0, 0]);
      expect(instance.scale).toEqual([1, 1, 1]);
    });
  });
});
