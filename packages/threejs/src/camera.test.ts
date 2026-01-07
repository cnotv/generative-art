import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { cameraFollowPlayer } from './camera';
import type { CoordinateTuple } from '@webgamekit/animation';

describe('camera', () => {
  describe('cameraFollowPlayer', () => {
    let camera: THREE.PerspectiveCamera;
    let player: THREE.Group;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      player = new THREE.Group();
    });

    it('should update camera position with offset when player is at origin', () => {
      player.position.set(0, 0, 0);
      const offset: CoordinateTuple = [5, 10, 15];

      const result = cameraFollowPlayer(camera, player, offset, null);

      expect(camera.position.x).toBe(5);
      expect(camera.position.y).toBe(10);
      expect(camera.position.z).toBe(15);
      expect(result).toEqual([5, 10, 15]);
    });

    it('should update camera position relative to player position', () => {
      player.position.set(10, 5, 20);
      const offset: CoordinateTuple = [-5, 10, -15];

      const result = cameraFollowPlayer(camera, player, offset, null);

      expect(camera.position.x).toBe(5);  // 10 + (-5)
      expect(camera.position.y).toBe(15); // 5 + 10
      expect(camera.position.z).toBe(5);  // 20 + (-15)
      expect(result).toEqual([5, 15, 5]);
    });

    it('should handle negative player positions', () => {
      player.position.set(-10, -5, -20);
      const offset: CoordinateTuple = [5, 10, 15];

      const result = cameraFollowPlayer(camera, player, offset, null);

      expect(camera.position.x).toBe(-5);  // -10 + 5
      expect(camera.position.y).toBe(5);   // -5 + 10
      expect(camera.position.z).toBe(-5);  // -20 + 15
      expect(result).toEqual([-5, 5, -5]);
    });

    it('should handle zero offset', () => {
      player.position.set(100, 50, 200);
      const offset: CoordinateTuple = [0, 0, 0];

      const result = cameraFollowPlayer(camera, player, offset, null);

      expect(camera.position.x).toBe(100);
      expect(camera.position.y).toBe(50);
      expect(camera.position.z).toBe(200);
      expect(result).toEqual([100, 50, 200]);
    });

    it('should update camera position multiple times as player moves', () => {
      const offset: CoordinateTuple = [0, 10, 20];

      // First position
      player.position.set(0, 0, 0);
      let result = cameraFollowPlayer(camera, player, offset, null);
      expect(result).toEqual([0, 10, 20]);

      // Second position
      player.position.set(5, 2, 10);
      result = cameraFollowPlayer(camera, player, offset, null);
      expect(result).toEqual([5, 12, 30]);

      // Third position
      player.position.set(-5, -2, -10);
      result = cameraFollowPlayer(camera, player, offset, null);
      expect(result).toEqual([-5, 8, 10]);
    });
  });
});
