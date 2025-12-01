import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getOffset, getInstanceConfig } from './index';

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
    it('should generate correct number of instances', () => {
      const config = {
        amount: 5,
        size: 1,
        sizeDelta: 0,
        area: 10
      };
      const groundSize = [100, 100];
      
      const instances = getInstanceConfig(config as any, groundSize as any);
      expect(instances).toHaveLength(5);
      expect(instances[0]).toHaveProperty('position');
      expect(instances[0]).toHaveProperty('rotation');
      expect(instances[0]).toHaveProperty('scale');
    });
  });
});
