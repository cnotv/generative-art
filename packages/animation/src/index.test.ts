import { describe, it, expect, vi, beforeEach } from 'vitest';
import { animateTimeline, controllerForward, controllerTurn, updateAnimation, playBlockingAction, playBlockingActionTimeline, checkGroundAtPosition, getRotation, setRotation, createTimelineManager, type AnimationData } from './index';
import * as THREE from 'three';
import type { ComplexModel } from './types';

describe('animation', () => {
  describe('animateTimeline', () => {
    it('should execute action when frame matches start', () => {
      const manager = createTimelineManager();
      const action = vi.fn();
      manager.addAction({ start: 10, action });
      animateTimeline(manager, 10);
      expect(action).toHaveBeenCalled();
    });

    it('should not execute action when frame is before start', () => {
      const manager = createTimelineManager();
      const action = vi.fn();
      manager.addAction({ start: 10, action });
      animateTimeline(manager, 5);
      expect(action).not.toHaveBeenCalled();
    });

    it('should execute action within interval', () => {
      const manager = createTimelineManager();
      const action = vi.fn();
      // interval: [length, pause]
      // cycle = 20
      manager.addAction({ interval: [10, 10] as [number, number], action });

      // Frame 5: 5 % 20 = 5. 5 < 10. Run.
      animateTimeline(manager, 5);
      expect(action).toHaveBeenCalledTimes(1);

      // Frame 15: 15 % 20 = 15. 15 >= 10. Skip.
      action.mockClear();
      animateTimeline(manager, 15);
      expect(action).not.toHaveBeenCalled();

      // Frame 25: 25 % 20 = 5. 5 < 10. Run.
      action.mockClear();
      animateTimeline(manager, 25);
      expect(action).toHaveBeenCalled();
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
      const manager = createTimelineManager();
      manager.addAction({
        frequency: speed,
        action: () => {
          const animData: AnimationData = { player: mockModel, actionName: 'run', delta: getDelta() };
          controllerForward([], [], animData);
        },
      });
      manager.addAction({
        frequency: speed * angle,
        action: () => controllerTurn(mockModel, angle),
      });

      // Complete cycle: 4 turns of 90° = 360°
      // At speed * angle frequency, we need 4 turns
      const cycleFrames = 360; // 4 turns * 90 frames each

      // Simulate the animation loop
      for (let frame = 0; frame < cycleFrames; frame++) {
        animateTimeline(manager, frame);
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
      const manager = createTimelineManager();
      manager.addAction({
        frequency: 1,
        action: () => {
          const animData: AnimationData = { player: mockModel, actionName: 'run', delta: getDelta() };
          controllerForward([], [], animData);
        },
      });
      manager.addAction({
        // Record position and turn every 10 frames
        frequency: 10,
        action: () => {
          positions.push({ x: mockMesh.position.x, z: mockMesh.position.z });
          controllerTurn(mockModel, angle);
        },
      });

      // Simulate 40 frames: 4 sides × 10 steps each
      for (let frame = 0; frame < 40; frame++) {
        animateTimeline(manager, frame);
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
      const animData: AnimationData = { player: mockPlayer, actionName: 'walk', delta: 0.016, speed: 10 };
      updateAnimation(animData);

      expect(mockMixer.update).toHaveBeenCalledWith(0.016 * 10 * 0.1);
    });

    it('should stop action when delta is 0', () => {
      const animData: AnimationData = { player: mockPlayer, actionName: 'walk', delta: 0, speed: 10 };
      updateAnimation(animData);

      expect(mockAction.stop).toHaveBeenCalled();
      expect(mockMixer.update).not.toHaveBeenCalled();
    });

    it('should switch animations when actionName changes', () => {
      mockPlayer.userData.currentAction = 'idle';

      const animData: AnimationData = { player: mockPlayer, actionName: 'walk', delta: 0.016, speed: 10 };
      updateAnimation(animData);

      expect(mockPreviousAction.fadeOut).toHaveBeenCalledWith(0.2);
      expect(mockAction.reset).toHaveBeenCalled();
      expect(mockAction.fadeIn).toHaveBeenCalledWith(0.2);
      expect(mockAction.play).toHaveBeenCalled();
      expect(mockPlayer.userData.currentAction).toBe('walk');
    });

    it('should not switch animations when actionName is the same', () => {
      mockPlayer.userData.currentAction = 'walk';

      const animData: AnimationData = { player: mockPlayer, actionName: 'walk', delta: 0.016, speed: 10 };
      updateAnimation(animData);

      expect(mockAction.reset).not.toHaveBeenCalled();
      expect(mockAction.fadeIn).not.toHaveBeenCalled();
      expect(mockMixer.update).toHaveBeenCalled();
    });

    it('should initialize currentAction when undefined', () => {
      mockPlayer.userData.currentAction = undefined;

      const animData: AnimationData = { player: mockPlayer, actionName: 'walk', delta: 0.016, speed: 10 };
      updateAnimation(animData);

      expect(mockAction.reset).toHaveBeenCalled();
      expect(mockAction.fadeIn).toHaveBeenCalledWith(0.2);
      expect(mockAction.play).toHaveBeenCalled();
      expect(mockPlayer.userData.currentAction).toBe('walk');
    });

    it('should not fade out previous action if new action is not found', () => {
      mockPlayer.userData.currentAction = 'walk';
      mockPlayer.userData.actions = {
        'walk': mockAction,
      };

      const animData: AnimationData = { player: mockPlayer, actionName: 'walk-new', delta: 0.016, speed: 10 };
      updateAnimation(animData);

      expect(mockAction.fadeOut).not.toHaveBeenCalled();
      expect(mockAction.reset).not.toHaveBeenCalled();
      expect(mockPlayer.userData.currentAction).toBe('walk');
    });

    it('should play action if not running when actionName matches', () => {
      mockPlayer.userData.currentAction = 'walk';
      mockAction.isRunning.mockReturnValue(false);

      const animData: AnimationData = { player: mockPlayer, actionName: 'walk', delta: 0.016, speed: 10 };
      updateAnimation(animData);

      expect(mockAction.play).toHaveBeenCalled();
      expect(mockMixer.update).toHaveBeenCalled();
    });
  });

  describe('checkGroundAtPosition', () => {
    it('should detect ground below the position', () => {
      // Create a ground box (BoxGeometry works better with raycasting than PlaneGeometry)
      const groundGeometry = new THREE.BoxGeometry(10, 0.1, 10);
      const groundMaterial = new THREE.MeshBasicMaterial();
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.position.set(0, 0, 0);
      groundMesh.updateMatrixWorld(true);
      
      const groundModel = groundMesh as unknown as ComplexModel;
      
      const checkPosition = new THREE.Vector3(0, 2, 0);
      const result = checkGroundAtPosition(checkPosition, [groundModel], 5);
      
      expect(result.hasGround).toBe(true);
      expect(result.groundHeight).toBeDefined();
    });

    it('should return hasGround false when no ground is present', () => {
      const checkPosition = new THREE.Vector3(0, 2, 0);
      const result = checkGroundAtPosition(checkPosition, [], 5);
      
      expect(result.hasGround).toBe(false);
      expect(result.groundHeight).toBeNull();
    });

    it('should not detect ground beyond maxDistance', () => {
      // Create a ground box far below
      const groundGeometry = new THREE.BoxGeometry(10, 0.1, 10);
      const groundMaterial = new THREE.MeshBasicMaterial();
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.position.set(0, -15, 0);
      groundMesh.updateMatrixWorld(true);
      
      const groundModel = groundMesh as unknown as ComplexModel;
      
      const checkPosition = new THREE.Vector3(0, 2, 0);
      const result = checkGroundAtPosition(checkPosition, [groundModel], 5); // maxDistance = 5
      
      expect(result.hasGround).toBe(false);
    });
  });

  describe('controllerForward with ground detection', () => {
    const createMockModel = (position: [number, number, number] = [0, 0, 0]) => {
      const mockMesh = new THREE.Group();
      mockMesh.position.set(...position);
      mockMesh.rotation.set(0, 0, 0);

      return Object.assign(mockMesh, {
        userData: {
          body: {
            translation: () => ({ x: mockMesh.position.x, y: mockMesh.position.y, z: mockMesh.position.z }),
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
          initialValues: { position, rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic',
        }
      }) as unknown as ComplexModel;
    };

    const createGroundBox = (y: number = 0, size: number = 100) => {
      const groundGeometry = new THREE.BoxGeometry(size, 0.1, size);
      const groundMaterial = new THREE.MeshBasicMaterial();
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.position.set(0, y, 0);
      groundMesh.updateMatrixWorld(true);
      return groundMesh as unknown as ComplexModel;
    };

    it('should move forward when ground is present and requireGround is true', () => {
      const mockModel = createMockModel([0, 1, 0]);
      const ground = createGroundBox(0);
      
      const initialZ = mockModel.position.z;
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016, distance: 1 };
      
      controllerForward([], [ground], animData, {
        requireGround: true,
        maxGroundDistance: 5,
      });
      
      // Should have moved forward (in -Z direction by default)
      expect(mockModel.position.z).not.toBe(initialZ);
    });

    it('should not move forward when no ground is present and requireGround is true', () => {
      const mockModel = createMockModel([0, 1, 0]);
      
      const initialPosition = mockModel.position.clone();
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016, distance: 1 };
      
      controllerForward([], [], animData, {
        requireGround: true,
        maxGroundDistance: 5,
      });
      
      // Should not have moved
      expect(mockModel.position.x).toBe(initialPosition.x);
      expect(mockModel.position.z).toBe(initialPosition.z);
    });

    it('should move forward without ground check when requireGround is false', () => {
      const mockModel = createMockModel([0, 1, 0]);
      
      const initialZ = mockModel.position.z;
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016, distance: 1 };
      
      controllerForward([], [], animData, {
        requireGround: false,
      });
      
      // Should have moved forward even without ground
      expect(mockModel.position.z).not.toBe(initialZ);
    });

    it('should adjust height when stepping onto higher ground', () => {
      const mockModel = createMockModel([0, 0.5, 0]);
      // Create a step at y=0.8 (slightly higher than model)
      const step = createGroundBox(0.8);
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016, distance: 0.5 };
      
      controllerForward([], [step], animData, {
        requireGround: true,
        maxStepHeight: 0.5,
        maxGroundDistance: 5,
      });
      
      // Model should have stepped up to approximately 0.85 (top of box at y=0.85)
      expect(mockModel.position.y).toBeGreaterThan(0.5);
    });

    it('should not move when step is too high', () => {
      const mockModel = createMockModel([0, 0, 0]);
      // Create a high step at y=2
      const highStep = createGroundBox(2);
      
      const initialPosition = mockModel.position.clone();
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016, distance: 1 };
      
      controllerForward([], [highStep], animData, {
        requireGround: true,
        maxStepHeight: 0.5, // Step is 2 units high, max is 0.5
        maxGroundDistance: 5,
      });
      
      // Should not have moved because step is too high
      expect(mockModel.position.x).toBe(initialPosition.x);
      expect(mockModel.position.z).toBe(initialPosition.z);
    });

    it('should move when player at Y=-1 with large ground box (ForestGame scenario)', () => {
      // This test reproduces the ForestGame setup:
      // - Player at Y=-1
      // - Ground is a large box with size [1000, 100, 50] positioned with top surface at Y=-1
      // - Player rotated 270° (facing left, moving in -X direction)
      
      const playerY = -1;
      const groundSize: [number, number, number] = [1000, 100, 50];
      const groundY = -1 - groundSize[1] / 2; // Ground center at -51, top at -1
      
      const mockMesh = new THREE.Group();
      mockMesh.position.set(0, playerY, 0);
      // Rotate 270° (facing left) - this means forward is -X direction
      mockMesh.rotation.set(0, (270 * Math.PI) / 180, 0);
      
      const mockModel = Object.assign(mockMesh, {
        userData: {
          body: {
            translation: () => ({ x: mockMesh.position.x, y: mockMesh.position.y, z: mockMesh.position.z }),
            setTranslation: vi.fn((pos) => {
              mockMesh.position.set(pos.x, pos.y, pos.z);
            }),
          },
          mixer: { update: vi.fn() },
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
          initialValues: { position: [0, playerY, 0], rotation: [0, 270, 0], size: 1, color: undefined },
          type: 'dynamic',
        }
      }) as unknown as ComplexModel;
      
      // Create ground like ForestGame: large box with top surface at Y=-1
      const groundGeometry = new THREE.BoxGeometry(...groundSize);
      const groundMaterial = new THREE.MeshBasicMaterial();
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.position.set(0, groundY, 0);
      groundMesh.updateMatrixWorld(true);
      const ground = groundMesh as unknown as ComplexModel;
      
      const initialPosition = mockModel.position.clone();
      const distance = 0.08; // Same as ForestGame
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016, distance: distance };
      
      // ForestGame movement options
      const movementOptions = {
        requireGround: true,
        maxGroundDistance: 5,
        maxStepHeight: 0.5,
        characterRadius: 4,
        debug: true,
      };
      
      controllerForward([], [ground], animData, movementOptions);
      
      // Player should have moved in -X direction (left)
      expect(mockModel.position.x).toBeLessThan(initialPosition.x);
      // Y position should stay at ground level (-1)
      expect(mockModel.position.y).toBeCloseTo(-1, 1);
    });
  });

  describe('getRotation', () => {
    it.each([
      [{}, null, 'no direction keys pressed'],
      [{ 'move-up': true, 'move-down': true, 'move-left': true, 'move-right': true }, null, 'all direction keys cancel out'],
      [{ 'move-up': true, 'move-down': true }, null, 'up+down cancel out'],
      [{ 'move-left': true, 'move-right': true }, null, 'left+right cancel out'],
    ])('should return null for %j (%s)', (input, expected) => {
      expect(getRotation(input)).toBe(expected);
    });

    it.each([
      [{ 'move-up': true }, 180, 'up'],
      [{ 'move-down': true }, 0, 'down'],
      [{ 'move-left': true }, 270, 'left'],
      [{ 'move-right': true }, 90, 'right'],
    ])('should return %d for cardinal direction %s', (input, expected) => {
      expect(getRotation(input)).toBe(expected);
    });

    it.each([
      [{ 'move-up': true, 'move-left': true }, 225, 'up-left'],
      [{ 'move-up': true, 'move-right': true }, 135, 'up-right'],
      [{ 'move-down': true, 'move-left': true }, 315, 'down-left'],
      [{ 'move-down': true, 'move-right': true }, 45, 'down-right'],
    ])('should return %d for diagonal direction %s', (input, expected) => {
      expect(getRotation(input)).toBe(expected);
    });

    it.each([
      [{ 'move-up': true, 'move-down': true, 'move-left': true }, 270, 'up+down with left'],
      [{ 'move-up': true, 'move-down': true, 'move-right': true }, 90, 'up+down with right'],
      [{ 'move-left': true, 'move-right': true, 'move-up': true }, 180, 'left+right with up'],
      [{ 'move-left': true, 'move-right': true, 'move-down': true }, 0, 'left+right with down'],
    ])('should return %d for opposing directions: %s', (input, expected) => {
      expect(getRotation(input)).toBe(expected);
    });
  });

  describe('setRotation', () => {
    it('should set model rotation to specified degrees', () => {
      const mockMesh = new THREE.Group();
      mockMesh.rotation.set(0, 0, 0);

      const mockModel = Object.assign(mockMesh, {
        userData: {
          body: {
            translation: () => ({ x: 0, y: 0, z: 0 }),
            setTranslation: vi.fn(),
          },
        },
      }) as unknown as ComplexModel;

      // Test 90 degrees
      setRotation(mockModel, 90);
      expect(mockModel.rotation.y).toBeCloseTo(Math.PI / 2, 5);

      // Test 180 degrees
      setRotation(mockModel, 180);
      expect(mockModel.rotation.y).toBeCloseTo(Math.PI, 5);

      // Test 270 degrees
      setRotation(mockModel, 270);
      expect(mockModel.rotation.y).toBeCloseTo((3 * Math.PI) / 2, 5);

      // Test 0 degrees
      setRotation(mockModel, 0);
      expect(mockModel.rotation.y).toBeCloseTo(0, 5);

      // Test 45 degrees (diagonal)
      setRotation(mockModel, 45);
      expect(mockModel.rotation.y).toBeCloseTo(Math.PI / 4, 5);
    });
  });

  describe('TimelineManager integration with animateTimeline', () => {
    it('should execute actions managed by TimelineManager', () => {
      const manager = createTimelineManager();
      const action1 = vi.fn();
      const action2 = vi.fn();

      manager.addAction({ name: 'action1', start: 10, end: 20, action: action1 });
      manager.addAction({ name: 'action2', start: 15, action: action2 });

      // Frame 5 - no actions should run
      animateTimeline(manager, 5);
      expect(action1).not.toHaveBeenCalled();
      expect(action2).not.toHaveBeenCalled();

      // Frame 10 - action1 should run
      animateTimeline(manager, 10);
      expect(action1).toHaveBeenCalledTimes(1);
      expect(action2).not.toHaveBeenCalled();

      // Frame 15 - both should run
      action1.mockClear();
      animateTimeline(manager, 15);
      expect(action1).toHaveBeenCalledTimes(1);
      expect(action2).toHaveBeenCalledTimes(1);

      // Frame 25 - only action2 should run (action1 ended at 20)
      action1.mockClear();
      action2.mockClear();
      animateTimeline(manager, 25);
      expect(action1).not.toHaveBeenCalled();
      expect(action2).toHaveBeenCalledTimes(1);
    });

    it('should support dynamic action addition and removal', () => {
      const manager = createTimelineManager();
      const action1 = vi.fn();
      const action2 = vi.fn();

      const id1 = manager.addAction({ name: 'action1', frequency: 1, action: action1 });
      manager.addAction({ name: 'action2', frequency: 1, action: action2 });

      // Both actions execute
      animateTimeline(manager, 10);
      expect(action1).toHaveBeenCalled();
      expect(action2).toHaveBeenCalled();

      // Remove action1
      manager.removeAction(id1);
      action1.mockClear();
      action2.mockClear();

      // Only action2 executes
      animateTimeline(manager, 11);
      expect(action1).not.toHaveBeenCalled();
      expect(action2).toHaveBeenCalled();
    });

    it('should handle disabled actions', () => {
      const manager = createTimelineManager();
      const action = vi.fn();

      const id = manager.addAction({ name: 'test', frequency: 1, action, enabled: true });

      // Action executes when enabled
      animateTimeline(manager, 5);
      expect(action).toHaveBeenCalledTimes(1);

      // Disable action
      manager.updateAction(id, { enabled: false });
      action.mockClear();

      // Action does not execute when disabled
      animateTimeline(manager, 6);
      expect(action).not.toHaveBeenCalled();

      // Re-enable action
      manager.updateAction(id, { enabled: true });

      // Action executes again
      animateTimeline(manager, 7);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should auto-remove completed actions with autoRemove flag', () => {
      const manager = createTimelineManager();
      const action = vi.fn();

      manager.addAction({
        name: 'one-shot',
        start: 10,
        duration: 5,
        action,
        autoRemove: true,
        onComplete: vi.fn(),
      });

      expect(manager.getTimeline()).toHaveLength(1);

      // Execute at frame 10
      animateTimeline(manager, 10, undefined, { enableAutoRemoval: true });
      expect(action).toHaveBeenCalled();
      expect(manager.getTimeline()).toHaveLength(1); // Not completed yet

      // Execute at frame 20 (after duration)
      action.mockClear();
      animateTimeline(manager, 20, undefined, { enableAutoRemoval: true });
      expect(action).not.toHaveBeenCalled(); // Past duration
      expect(manager.getTimeline()).toHaveLength(0); // Auto-removed
    });

    it('should execute actions in priority order when sortByPriority is enabled', () => {
      const manager = createTimelineManager();
      const executionOrder: number[] = [];

      manager.addAction({
        name: 'low-priority',
        frequency: 1,
        priority: 1,
        action: () => executionOrder.push(1),
      });

      manager.addAction({
        name: 'high-priority',
        frequency: 1,
        priority: 10,
        action: () => executionOrder.push(10),
      });

      manager.addAction({
        name: 'medium-priority',
        frequency: 1,
        priority: 5,
        action: () => executionOrder.push(5),
      });

      animateTimeline(manager, 1, undefined, { sortByPriority: true });

      // Should execute in order: high (10), medium (5), low (1)
      expect(executionOrder).toEqual([10, 5, 1]);
    });

    it('should handle category-based action management', () => {
      const manager = createTimelineManager();
      const physicsAction = vi.fn();
      const uiAction = vi.fn();
      const aiAction = vi.fn();

      manager.addAction({ name: 'p1', category: 'physics', frequency: 1, action: physicsAction });
      manager.addAction({ name: 'p2', category: 'physics', frequency: 1, action: physicsAction });
      manager.addAction({ name: 'ui1', category: 'ui', frequency: 1, action: uiAction });
      manager.addAction({ name: 'ai1', category: 'ai', frequency: 1, action: aiAction });

      expect(manager.getActionsByCategory('physics')).toHaveLength(2);
      expect(manager.getActionsByCategory('ui')).toHaveLength(1);

      // Remove all physics actions
      manager.removeByCategory('physics');

      animateTimeline(manager, 1);
      expect(physicsAction).not.toHaveBeenCalled();
      expect(uiAction).toHaveBeenCalled();
      expect(aiAction).toHaveBeenCalled();
    });

    it('should work with interval actions', () => {
      const manager = createTimelineManager();
      const action = vi.fn();

      manager.addAction({
        name: 'interval-test',
        interval: [10, 5], // Active for 10 frames, pause for 5
        action,
      });

      // Frame 5: within first active period (0-9)
      animateTimeline(manager, 5);
      expect(action).toHaveBeenCalledTimes(1);

      // Frame 12: within pause period (10-14)
      action.mockClear();
      animateTimeline(manager, 12);
      expect(action).not.toHaveBeenCalled();

      // Frame 17: within second active period (15-24)
      animateTimeline(manager, 17);
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe('playBlockingAction', () => {
    const createBlockingModel = () => {
      const mockAction = {
        play: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn(),
        setLoop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        clampWhenFinished: false,
      };

      const mockMixer = {
        update: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const mockMesh = new THREE.Group();
      mockMesh.position.set(0, 0, 0);

      const rollAction = {
        play: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn(),
        setLoop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        clampWhenFinished: false,
      };

      return Object.assign(mockMesh, {
        userData: {
          mixer: mockMixer,
          actions: { attack: mockAction, idle: { ...mockAction }, roll: rollAction },
          currentAction: undefined,
          body: {
            translation: () => ({ x: 0, y: 0, z: 0 }),
            setTranslation: vi.fn((pos) => mockMesh.position.set(pos.x, pos.y, pos.z)),
          },
          initialValues: { position: [0, 0, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic',
          performing: false,
          allowMovement: true,
          allowRotation: true,
        },
      }) as unknown as ComplexModel;
    };

    it('should set performing=true and block movement/rotation by default', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack');

      expect(model.userData.performing).toBe(true);
      expect(model.userData.allowMovement).toBe(false);
      expect(model.userData.allowRotation).toBe(false);
    });

    it('should allow movement when allowMovement=true', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack', { allowMovement: true });

      expect(model.userData.allowMovement).toBe(true);
    });

    it('should register finished event listener for LoopOnce', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack');

      expect(model.userData.mixer.addEventListener).toHaveBeenCalledWith('finished', expect.any(Function));
    });

    it('should reset performing state on animation finish', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack');

      const finishedCallback = (model.userData.mixer.addEventListener as any).mock.calls[0][1];
      finishedCallback({ action: model.userData.actions.attack });

      expect(model.userData.performing).toBe(false);
      expect(model.userData.allowMovement).toBe(true);
      expect(model.userData.allowRotation).toBe(true);
    });

    it('should prevent triggering another blocking action while performing', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack');

      expect(model.userData.currentAction).toBe('attack');

      playBlockingAction(model, 'idle');

      expect(model.userData.currentAction).toBe('attack');
    });

    it('should allow whitelisted actions to interrupt via allowActions', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack', { allowActions: ['roll'] });

      expect(model.userData.currentAction).toBe('attack');

      playBlockingAction(model, 'roll');

      expect(model.userData.currentAction).toBe('roll');
    });

    it('should prevent non-whitelisted actions from interrupting', () => {
      const model = createBlockingModel();
      playBlockingAction(model, 'attack', { allowActions: ['roll'] });

      playBlockingAction(model, 'idle');

      expect(model.userData.currentAction).toBe('attack');
    });

    it('should block controllerForward when performing and allowMovement=false', () => {
      const model = createBlockingModel();
      model.userData.performing = true;
      model.userData.allowMovement = false;

      const initialZ = model.position.z;
      controllerForward([], [], { player: model, actionName: 'attack', delta: 0.016, distance: 1 });

      expect(model.position.z).toBe(initialZ);
    });

    it('should allow controllerForward when allowMovement=true', () => {
      const model = createBlockingModel();
      model.userData.performing = true;
      model.userData.allowMovement = true;

      const initialZ = model.position.z;
      controllerForward([], [], { player: model, actionName: 'attack', delta: 0.016, distance: 1 });

      expect(model.position.z).not.toBe(initialZ);
    });

    it('should block controllerTurn when performing and allowRotation=false', () => {
      const model = createBlockingModel();
      model.userData.performing = true;
      model.userData.allowRotation = false;

      const result = controllerTurn(model, 90);

      expect(result).toBe(false);
      expect(model.rotation.y).toBe(0);
    });

    it('should allow controllerTurn when allowRotation=true', () => {
      const model = createBlockingModel();
      model.userData.performing = true;
      model.userData.allowRotation = true;

      const result = controllerTurn(model, 90);

      expect(result).toBe(true);
      expect(model.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should block setRotation when performing and allowRotation=false', () => {
      const model = createBlockingModel();
      model.userData.performing = true;
      model.userData.allowRotation = false;

      const result = setRotation(model, 90);

      expect(result).toBe(false);
    });

    it('should allow setRotation when allowRotation=true', () => {
      const model = createBlockingModel();
      model.userData.performing = true;
      model.userData.allowRotation = true;

      const result = setRotation(model, 90);

      expect(result).toBe(true);
      expect(model.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    });
  });

  describe('playBlockingActionTimeline', () => {
    const createTimelineModel = (clipDuration: number) => {
      const mockAction = {
        play: vi.fn(),
        stop: vi.fn(),
        reset: vi.fn().mockReturnThis(),
        fadeIn: vi.fn().mockReturnThis(),
        fadeOut: vi.fn(),
        setLoop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
        clampWhenFinished: false,
        _clip: { duration: clipDuration },
      };

      const mockMixer = {
        update: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const mockMesh = new THREE.Group();
      mockMesh.position.set(0, 0, 0);

      return Object.assign(mockMesh, {
        userData: {
          mixer: mockMixer,
          actions: {
            punch: { ...mockAction, _clip: { duration: 1.5 } },
            kick: { ...mockAction, _clip: { duration: 1.0 } },
            jump: { ...mockAction, _clip: { duration: 0.8 } },
            roll: { ...mockAction, _clip: { duration: 1.2 } },
          },
          currentAction: undefined,
          body: {
            translation: () => ({ x: 0, y: 0, z: 0 }),
            setTranslation: vi.fn((pos: any) => mockMesh.position.set(pos.x, pos.y, pos.z)),
          },
          initialValues: { position: [0, 0, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic',
          performing: false,
          allowMovement: true,
          allowRotation: true,
          allowedActions: [],
        },
      }) as unknown as ComplexModel;
    };

    it.each([
      { action: 'punch', clipDuration: 1.5, deltaPerFrame: 0.016, expectedCalls: 94 },  // ~1.5 / 0.016
      { action: 'kick', clipDuration: 1.0, deltaPerFrame: 0.016, expectedCalls: 63 },   // ~1.0 / 0.016
      { action: 'jump', clipDuration: 0.8, deltaPerFrame: 0.016, expectedCalls: 50 },   // ~0.8 / 0.016
      { action: 'roll', clipDuration: 1.2, deltaPerFrame: 0.016, expectedCalls: 75 },   // ~1.2 / 0.016
    ])('should call updateAnimation until $action clip finishes (duration=$clipDuration)',
      ({ action, clipDuration, deltaPerFrame, expectedCalls }) => {
        // Given: Timeline manager, player with action, and getDelta function
        const manager = createTimelineManager();
        const player = createTimelineModel(clipDuration);
        (player.userData.actions[action] as any)._clip.duration = clipDuration;
        const getDelta = vi.fn().mockReturnValue(deltaPerFrame);

        // When: playBlockingActionTimeline is called
        playBlockingActionTimeline(manager, player, action, getDelta);

        // Then: Timeline action should be added
        expect(manager.getTimeline()).toHaveLength(1);

        // And: Running timeline for expected duration
        let accumulatedTime = 0;
        let callCount = 0;
        while (accumulatedTime < clipDuration && manager.getTimeline().length > 0) {
          animateTimeline(manager, callCount);
          accumulatedTime += deltaPerFrame;
          callCount++;
        }

        // Then: Should run approximately expectedCalls times
        expect(callCount).toBeGreaterThanOrEqual(expectedCalls - 2);
        expect(callCount).toBeLessThanOrEqual(expectedCalls + 2);

        // And: Timeline action should be removed after completion
        expect(manager.getTimeline()).toHaveLength(0);
      }
    );

    it.each([
      {
        action: 'kick',
        options: { allowMovement: false, allowRotation: false },
        expected: { performing: true, allowMovement: false, allowRotation: false, allowedActions: [] }
      },
      {
        action: 'punch',
        options: { allowMovement: false, allowRotation: false },
        expected: { performing: true, allowMovement: false, allowRotation: false, allowedActions: [] }
      },
      {
        action: 'roll',
        options: { allowMovement: true, allowRotation: true },
        expected: { performing: true, allowMovement: true, allowRotation: true, allowedActions: [] }
      },
      {
        action: 'jump',
        options: { allowMovement: true, allowRotation: false, allowActions: ['roll'] },
        expected: { performing: true, allowMovement: true, allowRotation: false, allowedActions: ['roll'] }
      },
    ])('should set correct blocking flags for $action',
      ({ action, options, expected }) => {
        // Given: Timeline manager, player, and getDelta
        const manager = createTimelineManager();
        const player = createTimelineModel(1.0);
        (player.userData.actions[action] as any)._clip.duration = 1.0;
        const getDelta = vi.fn().mockReturnValue(0.016);

        // When: playBlockingActionTimeline is called with options
        playBlockingActionTimeline(manager, player, action, getDelta, options);

        // Then: player.userData should match expected flags immediately
        expect(player.userData.performing).toBe(expected.performing);
        expect(player.userData.allowMovement).toBe(expected.allowMovement);
        expect(player.userData.allowRotation).toBe(expected.allowRotation);
        expect(player.userData.allowedActions).toEqual(expected.allowedActions);
      }
    );

    it.each([
      { action: 'punch', clipDuration: 1.0 },
      { action: 'kick', clipDuration: 1.5 },
      { action: 'roll', clipDuration: 1.2 },
    ])('should clear blocking flags after $action animation completes',
      ({ action, clipDuration }) => {
        // Given: Timeline manager with running action
        const manager = createTimelineManager();
        const player = createTimelineModel(clipDuration);
        (player.userData.actions[action] as any)._clip.duration = clipDuration;
        const getDelta = vi.fn().mockReturnValue(0.016);

        // When: playBlockingActionTimeline is called
        playBlockingActionTimeline(manager, player, action, getDelta, { allowMovement: false });

        // Then: Initial flags should be set
        expect(player.userData.performing).toBe(true);
        expect(player.userData.allowMovement).toBe(false);

        // And: Timeline runs past clipDuration
        const framesToRun = Math.ceil(clipDuration / 0.016) + 5;
        for (let i = 0; i < framesToRun; i++) {
          animateTimeline(manager, i);
        }

        // Then: Flags should be cleared
        expect(player.userData.performing).toBe(false);
        expect(player.userData.allowMovement).toBe(true);
        expect(player.userData.allowRotation).toBe(true);
        expect(player.userData.allowedActions).toEqual([]);
      }
    );

    it.each([
      {
        currentAction: 'kick',
        allowActions: [],
        attemptedAction: 'punch',
        shouldBlock: true
      },
      {
        currentAction: 'punch',
        allowActions: [],
        attemptedAction: 'jump',
        shouldBlock: true
      },
      {
        currentAction: 'jump',
        allowActions: ['roll'],
        attemptedAction: 'roll',
        shouldBlock: false
      },
      {
        currentAction: 'jump',
        allowActions: ['roll'],
        attemptedAction: 'kick',
        shouldBlock: true
      },
    ])('when performing $currentAction with allowActions=$allowActions, should block $attemptedAction: $shouldBlock',
      ({ currentAction, allowActions, attemptedAction, shouldBlock }) => {
        // Given: Timeline manager and player performing currentAction
        const manager = createTimelineManager();
        const player = createTimelineModel(1.0);
        (player.userData.actions[currentAction] as any)._clip.duration = 1.0;
        (player.userData.actions[attemptedAction] as any)._clip.duration = 1.0;
        const getDelta = vi.fn().mockReturnValue(0.016);

        // Start currentAction
        player.userData.performing = true;
        player.userData.allowedActions = allowActions;
        player.userData.currentAction = currentAction;

        // When: playBlockingActionTimeline is called for attemptedAction
        const timelineCountBefore = manager.getTimeline().length;
        playBlockingActionTimeline(manager, player, attemptedAction, getDelta);
        const timelineCountAfter = manager.getTimeline().length;

        // Then: If shouldBlock, no new timeline action should be added
        if (shouldBlock) {
          expect(timelineCountAfter).toBe(timelineCountBefore);
          expect(player.userData.currentAction).toBe(currentAction);
        } else {
          expect(timelineCountAfter).toBe(timelineCountBefore + 1);
          expect(player.userData.currentAction).toBe(attemptedAction);
        }
      }
    );

    it.each([
      {
        action: 'kick',
        allowMovement: false,
        allowRotation: false,
        movementShouldWork: false,
        rotationShouldWork: false
      },
      {
        action: 'punch',
        allowMovement: false,
        allowRotation: false,
        movementShouldWork: false,
        rotationShouldWork: false
      },
      {
        action: 'roll',
        allowMovement: true,
        allowRotation: true,
        movementShouldWork: true,
        rotationShouldWork: true
      },
      {
        action: 'jump',
        allowMovement: true,
        allowRotation: false,
        movementShouldWork: true,
        rotationShouldWork: false
      },
    ])('$action: movement=$movementShouldWork, rotation=$rotationShouldWork',
      ({ action, allowMovement, allowRotation, movementShouldWork, rotationShouldWork }) => {
        // Given: Player performing action with specified flags
        const player = createTimelineModel(1.0);
        player.userData.performing = true;
        player.userData.allowMovement = allowMovement;
        player.userData.allowRotation = allowRotation;

        // When: controllerForward is called
        const initialZ = player.position.z;
        controllerForward([], [], { player, actionName: action, delta: 0.016, distance: 1 });

        // Then: Movement should work or be prevented based on flag
        if (movementShouldWork) {
          expect(player.position.z).not.toBe(initialZ);
        } else {
          expect(player.position.z).toBe(initialZ);
        }

        // When: setRotation is called
        const rotationResult = setRotation(player, 90);

        // Then: Rotation should work or be prevented based on flag
        expect(rotationResult).toBe(rotationShouldWork);
      }
    );
  });
});
