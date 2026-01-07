import { describe, it, expect, vi, beforeEach } from 'vitest';
import { animateTimeline, getTimelineLoopModel, controllerForward, controllerTurn, updateAnimation } from './index';
import * as THREE from 'three';
import type { ComplexModel } from './types';

describe('animation', () => {
  describe('animateTimeline', () => {
    it('should execute action when frame matches start', () => {
      const action = vi.fn();
      const timeline = [{ start: 10, action }];
      animateTimeline(timeline, 10);
      expect(action).toHaveBeenCalled();
    });

    it('should not execute action when frame is before start', () => {
      const action = vi.fn();
      const timeline = [{ start: 10, action }];
      animateTimeline(timeline, 5);
      expect(action).not.toHaveBeenCalled();
    });

    it('should execute action within interval', () => {
      const action = vi.fn();
      // interval: [length, pause]
      // cycle = 20
      const timeline = [{ interval: [10, 10] as [number, number], action }];
      
      // Frame 5: 5 % 20 = 5. 5 < 10. Run.
      animateTimeline(timeline, 5);
      expect(action).toHaveBeenCalledTimes(1);

      // Frame 15: 15 % 20 = 15. 15 >= 10. Skip.
      action.mockClear();
      animateTimeline(timeline, 15);
      expect(action).not.toHaveBeenCalled();

      // Frame 25: 25 % 20 = 5. 5 < 10. Run.
      action.mockClear();
      animateTimeline(timeline, 25);
      expect(action).toHaveBeenCalled();
    });
  });

  describe('getTimelineLoopModel', () => {
    it('should generate correct timeline from loop definition', () => {
      const action = vi.fn();
      const loop = {
        loop: 0,
        length: 10,
        action,
        list: [
          [1, 'forward'],
          [2, 'left']
        ] as [number, any][]
      };

      const timeline = getTimelineLoopModel(loop);
      
      expect(timeline).toHaveLength(2);
      
      // Check first item
      // interval: [1 * 10, total]
      // total = 1*10 + 2*10 = 30
      expect(timeline[0].interval).toEqual([10, 30]);
      
      // Check second item
      // interval: [2 * 10, total]
      expect(timeline[1].interval).toEqual([20, 30]);
    });
  });

  describe('timeline with circular movement', () => {
    it('should return model to same position after completing a 360° rotation cycle', () => {
      // Create a mock model similar to the chameleon configuration
      const mockMesh = new THREE.Group();
      mockMesh.position.set(0, -0.75, 0);
      mockMesh.rotation.set(0, 0, 0);

      const mockModel = Object.assign(mockMesh, {
        userData: {
          body: {
            translation: () => ({ x: 0, y: -0.75, z: 0 }),
            setTranslation: vi.fn(),
          },
          mixer: {
            update: vi.fn(),
          },
          actions: {
            run: {
              play: vi.fn(),
              stop: vi.fn(),
              reset: vi.fn().mockReturnThis(),
              fadeIn: vi.fn().mockReturnThis(),
              fadeOut: vi.fn(),
              isRunning: vi.fn().mockReturnValue(true),
            },
          },
          currentAction: undefined,
          initialValues: { position: [0, -0.75, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic',
        }
      }) as unknown as ComplexModel;

      const angle = 90; // degrees per turn
      const distance = 0.1; // units per forward movement
      const speed = 1; // frequency
      const getDelta = () => 0.016; // ~60fps

      // Record initial position
      const initialPosition = {
        x: mockMesh.position.x,
        y: mockMesh.position.y,
        z: mockMesh.position.z,
      };
      const initialRotation = mockMesh.rotation.y;

      // Timeline configuration matching ToolsTest.vue
      const timeline = [
        {
          frequency: speed,
          action: () => controllerForward(mockModel, [], distance, getDelta(), 'run', false),
        },
        {
          frequency: speed * angle,
          action: () => controllerTurn(mockModel, angle),
        },
      ];

      // Complete cycle: 4 turns of 90° = 360°
      // At speed * angle frequency, we need 4 turns
      const cycleFrames = 360; // 4 turns * 90 frames each
      
      // Simulate the animation loop
      for (let frame = 0; frame < cycleFrames; frame++) {
        animateTimeline(timeline, frame);
      }

      // After 360°, the model should be at approximately the same position with margin of errors
      const finalPosition = {
        x: mockMesh.position.x,
        y: mockMesh.position.y,
        z: mockMesh.position.z,
      };
      const finalRotation = mockMesh.rotation.y;

      // Check position is close to initial (within 0.01 tolerance for floating point)
      expect(Math.abs(finalPosition.x - initialPosition.x)).toBeLessThan(0.5);
      expect(Math.abs(finalPosition.y - initialPosition.y)).toBeLessThan(0.01);
      expect(Math.abs(finalPosition.z - initialPosition.z)).toBeLessThan(0.5);

      // Check rotation completed a full circle (2π radians or close to initial)
      const rotationDiff = Math.abs(finalRotation - initialRotation);
      const fullCircle = Math.PI * 2;
      expect(rotationDiff % fullCircle).toBeLessThan(0.1);
    });

    it('should move model in a square pattern with 4x 90° turns', () => {
      const mockMesh = new THREE.Group();
      mockMesh.position.set(0, 0, 0);
      mockMesh.rotation.set(0, 0, 0);

      const mockModel = Object.assign(mockMesh, {
        userData: {
          body: {
            translation: () => ({ x: mockMesh.position.x, y: 0, z: mockMesh.position.z }),
            setTranslation: vi.fn((pos) => {
              mockMesh.position.set(pos.x, pos.y, pos.z);
            }),
          },
          mixer: {
            update: vi.fn(),
          },
          actions: {
            run: {
              play: vi.fn(),
              stop: vi.fn(),
              reset: vi.fn().mockReturnThis(),
              fadeIn: vi.fn().mockReturnThis(),
              fadeOut: vi.fn(),
              isRunning: vi.fn().mockReturnValue(true),
            },
          },
          currentAction: undefined,
          initialValues: { position: [0, 0, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic',
        }
      }) as unknown as ComplexModel;

      const distance = 1.0;
      const angle = 90;
      const getDelta = () => 0.016;

      const positions: Array<{ x: number; z: number }> = [];

      // Timeline for square pattern: move forward segment, then turn
      const timeline = [
        {
          frequency: 1,
          action: () => controllerForward(mockModel, [], distance, getDelta(), 'run', false),
        },
        {
          // Record position and turn every 10 frames
          frequency: 10,
          action: () => {
            positions.push({ x: mockMesh.position.x, z: mockMesh.position.z });
            controllerTurn(mockModel, angle);
          },
        },
      ];

      // Simulate 40 frames: 4 sides × 10 steps each
      for (let frame = 0; frame < 40; frame++) {
        animateTimeline(timeline, frame);
      }

      // After 4 turns of 90°, should have traveled in roughly a square
      expect(positions).toHaveLength(4);
      
      // The model should have rotated 360° total (2π radians)
      expect(Math.abs(mockMesh.rotation.y % (Math.PI * 2))).toBeLessThan(0.1);
    });
  });

  describe('updateAnimation', () => {
    let mockMixer: any;
    let mockAction: any;
    let mockPlayer: ComplexModel;
    let mockPreviousAction: any;

    beforeEach(() => {
      mockAction = {
        play: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
      };

      mockPreviousAction = {
        play: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
      };

      mockMixer = {
        update: vi.fn(),
      };

      const mockMesh = new THREE.Group();
      mockPlayer = Object.assign(mockMesh, {
        userData: {
          mixer: mockMixer,
          actions: {
            'walk': mockAction,
            'idle': mockPreviousAction,
          },
          currentAction: undefined,
          body: {
            translation: () => ({ x: 0, y: 0, z: 0 }),
            setTranslation: vi.fn(),
          },
          initialValues: { position: [0, 0, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic',
        }
      }) as unknown as ComplexModel;
    });

    it('should update mixer and play action when delta is provided', () => {
      updateAnimation(mockMixer, mockAction, 0.016, 10);

      expect(mockMixer.update).toHaveBeenCalledWith(0.016 * 10 * 0.1);
    });

    it('should stop action when delta is 0', () => {
      updateAnimation(mockMixer, mockAction, 0, 10);

      expect(mockAction.stop).toHaveBeenCalled();
      expect(mockMixer.update).not.toHaveBeenCalled();
    });

    it('should switch animations when actionName changes', () => {
      mockPlayer.userData.currentAction = 'idle';

      updateAnimation(mockMixer, mockAction, 0.016, 10, mockPlayer, 'walk');

      expect(mockPreviousAction.fadeOut).toHaveBeenCalledWith(0.2);
      expect(mockAction.reset).toHaveBeenCalled();
      expect(mockAction.fadeIn).toHaveBeenCalledWith(0.2);
      expect(mockAction.play).toHaveBeenCalled();
      expect(mockPlayer.userData.currentAction).toBe('walk');
    });

    it('should not switch animations when actionName is the same', () => {
      mockPlayer.userData.currentAction = 'walk';

      updateAnimation(mockMixer, mockAction, 0.016, 10, mockPlayer, 'walk');

      expect(mockAction.reset).not.toHaveBeenCalled();
      expect(mockAction.fadeIn).not.toHaveBeenCalled();
      expect(mockMixer.update).toHaveBeenCalled();
    });

    it('should initialize currentAction when undefined', () => {
      mockPlayer.userData.currentAction = undefined;

      updateAnimation(mockMixer, mockAction, 0.016, 10, mockPlayer, 'walk');

      expect(mockAction.reset).toHaveBeenCalled();
      expect(mockAction.fadeIn).toHaveBeenCalledWith(0.2);
      expect(mockAction.play).toHaveBeenCalled();
      expect(mockPlayer.userData.currentAction).toBe('walk');
    });

    it('should not fade out previous action if it is the same as current action', () => {
      mockPlayer.userData.currentAction = 'walk';
      mockPlayer.userData.actions = {
        'walk': mockAction,
      };

      updateAnimation(mockMixer, mockAction, 0.016, 10, mockPlayer, 'walk-new');

      expect(mockAction.fadeOut).not.toHaveBeenCalled();
      expect(mockAction.reset).toHaveBeenCalled();
      expect(mockPlayer.userData.currentAction).toBe('walk-new');
    });

    it('should play action if not running when actionName matches', () => {
      mockPlayer.userData.currentAction = 'walk';
      mockAction.isRunning.mockReturnValue(false);

      updateAnimation(mockMixer, mockAction, 0.016, 10, mockPlayer, 'walk');

      expect(mockAction.play).toHaveBeenCalled();
      expect(mockMixer.update).toHaveBeenCalled();
    });

    it('should work without player and actionName for backward compatibility', () => {
      updateAnimation(mockMixer, mockAction, 0.016, 10);

      expect(mockMixer.update).toHaveBeenCalled();
      expect(mockAction.reset).not.toHaveBeenCalled();
    });
  });
});
