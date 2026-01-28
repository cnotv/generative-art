import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playActionTimeline, createTimelineManager, animateTimeline } from './index';
import * as THREE from 'three';
import type { ComplexModel } from './types';

describe('playActionTimeline - REAL tests', () => {
  const createTestPlayer = (clipDuration: number) => {
    const mockAction = {
      play: vi.fn().mockReturnThis(),
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
          kick: mockAction,
          punch: { ...mockAction, _clip: { duration: clipDuration } },
          jump: { ...mockAction, _clip: { duration: clipDuration } },
          roll: { ...mockAction, _clip: { duration: clipDuration } },
        },
        currentAction: undefined,
        body: {
          translation: () => ({ x: 0, y: 0, z: 0 }),
          setTranslation: vi.fn(),
        },
        performing: false,
        allowMovement: true,
        allowRotation: true,
        allowedActions: [],
      },
    }) as unknown as ComplexModel;
  };

  it('REAL TEST: should actually call action.play() when triggered', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // When: Call playActionTimeline
    playActionTimeline(manager, player, 'kick', getDelta, {
      allowMovement: false,
      allowRotation: false,
    });

    // Then: action.play() MUST be called
    expect(player.userData.actions.kick.play).toHaveBeenCalled();
  });

  it('REAL TEST: should actually call mixer.update() on each timeline tick', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // When: Call playActionTimeline
    playActionTimeline(manager, player, 'kick', getDelta);

    // Clear any setup calls
    (player.userData.mixer.update as any).mockClear();

    // Run timeline 5 times
    for (let i = 0; i < 5; i++) {
      animateTimeline(manager, i);
    }

    // Then: mixer.update MUST be called 5 times
    expect(player.userData.mixer.update).toHaveBeenCalledTimes(5);
    expect(player.userData.mixer.update).toHaveBeenCalledWith(0.016);
  });

  it('REAL TEST: should clear performing flag after clip duration', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(0.1); // Short 0.1s clip
    const getDelta = vi.fn().mockReturnValue(0.016);

    // When: Call playActionTimeline
    playActionTimeline(manager, player, 'kick', getDelta, {
      allowMovement: false,
    });

    // Then: performing should be true initially
    expect(player.userData.performing).toBe(true);
    expect(player.userData.allowMovement).toBe(false);

    // Run timeline for 0.1s worth of frames (7 frames at 0.016s each = 0.112s)
    for (let i = 0; i < 7; i++) {
      animateTimeline(manager, i);
    }

    // Then: performing MUST be cleared
    expect(player.userData.performing).toBe(false);
    expect(player.userData.allowMovement).toBe(true);
  });

  it('REAL TEST: should NOT add duplicate timeline actions', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // When: Call playActionTimeline twice
    playActionTimeline(manager, player, 'kick', getDelta);
    const timelineBefore = manager.getTimeline().length;

    playActionTimeline(manager, player, 'kick', getDelta);
    const timelineAfter = manager.getTimeline().length;

    // Then: Timeline should NOT grow
    expect(timelineAfter).toBe(timelineBefore);
  });

  it('REAL TEST: should block other actions when performing', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // When: Start kick
    playActionTimeline(manager, player, 'kick', getDelta, {
      allowActions: [],
    });

    // Clear play calls
    (player.userData.actions.kick.play as any).mockClear();
    (player.userData.actions.punch.play as any).mockClear();

    // Try to start punch
    playActionTimeline(manager, player, 'punch', getDelta);

    // Then: punch.play() should NOT be called
    expect(player.userData.actions.punch.play).not.toHaveBeenCalled();
    expect(player.userData.currentAction).toBe('kick');
  });

  it('REAL TEST: should allow whitelisted action to interrupt', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // When: Start jump with roll whitelisted
    playActionTimeline(manager, player, 'jump', getDelta, {
      allowActions: ['roll'],
    });

    // Clear play calls
    (player.userData.actions.jump.play as any).mockClear();
    (player.userData.actions.roll.play as any).mockClear();

    // Try to start roll
    playActionTimeline(manager, player, 'roll', getDelta);

    // Then: roll.play() MUST be called
    expect(player.userData.actions.roll.play).toHaveBeenCalled();
    expect(player.userData.currentAction).toBe('roll');
  });
});
