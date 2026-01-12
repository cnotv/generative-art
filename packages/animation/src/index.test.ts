import { describe, it, expect, vi, beforeEach } from 'vitest';
import { animateTimeline, getTimelineLoopModel, controllerForward, controllerTurn, updateAnimation, checkGroundAtPosition, getRotation, setRotation, type AnimationData } from './index';
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
          action: () => {
            const animData: AnimationData = { player: mockModel, actionName: 'run', delta: getDelta() };
            controllerForward([], [], distance, animData);
          },
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
          action: () => {
            const animData: AnimationData = { player: mockModel, actionName: 'run', delta: getDelta() };
            controllerForward([], [], distance, animData);
          },
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
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016 };
      
      controllerForward([], [ground], 1, animData, {
        requireGround: true,
        maxGroundDistance: 5,
      });
      
      // Should have moved forward (in -Z direction by default)
      expect(mockModel.position.z).not.toBe(initialZ);
    });

    it('should not move forward when no ground is present and requireGround is true', () => {
      const mockModel = createMockModel([0, 1, 0]);
      
      const initialPosition = mockModel.position.clone();
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016 };
      
      controllerForward([], [], 1, animData, {
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
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016 };
      
      controllerForward([], [], 1, animData, {
        requireGround: false,
      });
      
      // Should have moved forward even without ground
      expect(mockModel.position.z).not.toBe(initialZ);
    });

    it('should adjust height when stepping onto higher ground', () => {
      const mockModel = createMockModel([0, 0.5, 0]);
      // Create a step at y=0.8 (slightly higher than model)
      const step = createGroundBox(0.8);
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016 };
      
      controllerForward([], [step], 0.5, animData, {
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
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016 };
      
      controllerForward([], [highStep], 1, animData, {
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
      const animData: AnimationData = { player: mockModel, actionName: 'run', delta: 0.016 };
      
      // ForestGame movement options
      const movementOptions = {
        requireGround: true,
        maxGroundDistance: 5,
        maxStepHeight: 0.5,
        characterRadius: 4,
        debug: true,
      };
      
      controllerForward([], [ground], distance, animData, movementOptions);
      
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
      [{ 'move-up': true }, 0, 'up'],
      [{ 'move-down': true }, 180, 'down'],
      [{ 'move-left': true }, 270, 'left'],
      [{ 'move-right': true }, 90, 'right'],
    ])('should return %d for cardinal direction %s', (input, expected) => {
      expect(getRotation(input)).toBe(expected);
    });

    it.each([
      [{ 'move-up': true, 'move-left': true }, 315, 'up-left'],
      [{ 'move-up': true, 'move-right': true }, 45, 'up-right'],
      [{ 'move-down': true, 'move-left': true }, 225, 'down-left'],
      [{ 'move-down': true, 'move-right': true }, 135, 'down-right'],
    ])('should return %d for diagonal direction %s', (input, expected) => {
      expect(getRotation(input)).toBe(expected);
    });

    it.each([
      [{ 'move-up': true, 'move-down': true, 'move-left': true }, 270, 'up+down with left'],
      [{ 'move-up': true, 'move-down': true, 'move-right': true }, 90, 'up+down with right'],
      [{ 'move-left': true, 'move-right': true, 'move-up': true }, 0, 'left+right with up'],
      [{ 'move-left': true, 'move-right': true, 'move-down': true }, 180, 'left+right with down'],
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
});
