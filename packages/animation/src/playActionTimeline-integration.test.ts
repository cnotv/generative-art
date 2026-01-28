import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playActionTimeline, createTimelineManager, animateTimeline, updateAnimation } from './index';
import * as THREE from 'three';
import type { ComplexModel, AnimationData } from './types';

describe('playActionTimeline - BUG REPRODUCTION', () => {
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
          walk2: { ...mockAction, _clip: { duration: 1.0 } },
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

  it('FIX: mixer.update() should only be called ONCE per frame with proper Walk action guard', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // Simulate the Walk timeline action WITH THE FIX (like updated MixamoPlayground)
    manager.addAction({
      name: 'Walk',
      category: 'user-input',
      action: () => {
        // FIX: Check performing flag before updating animation
        if (player.userData.performing) {
          if (!player.userData.allowMovement && !player.userData.allowRotation) {
            return;
          }
        }

        // Only update animation if not performing
        if (!player.userData.performing) {
          const animationData: AnimationData = {
            actionName: 'walk2',
            player,
            delta: getDelta() * 2,
            speed: 20,
            backward: false,
            distance: 0.5,
          };
          updateAnimation(animationData);
        }
      },
    });

    // Start kick animation
    playActionTimeline(manager, player, 'kick', getDelta, {
      allowMovement: false,
      allowRotation: false,
    });

    // Clear previous update calls
    (player.userData.mixer.update as any).mockClear();

    // Run timeline once
    animateTimeline(manager, 0);

    console.log('mixer.update call count:', (player.userData.mixer.update as any).mock.calls.length);
    console.log('mixer.update calls:', (player.userData.mixer.update as any).mock.calls);

    // NOW THIS SHOULD PASS: mixer.update() called only once (by blocking action)
    expect(player.userData.mixer.update).toHaveBeenCalledTimes(1);
    expect(player.userData.mixer.update).toHaveBeenCalledWith(0.016);
  });

  it('BUG: Walk action should NOT call updateAnimation when performing blocking action', () => {
    const manager = createTimelineManager();
    const player = createTestPlayer(1.0);
    const getDelta = vi.fn().mockReturnValue(0.016);

    // Simulate the Walk timeline action WITH THE FIX
    manager.addAction({
      name: 'Walk',
      category: 'user-input',
      action: () => {
        // FIX: Check performing flag before updating animation
        if (player.userData.performing) {
          if (!player.userData.allowMovement && !player.userData.allowRotation) {
            return;
          }
        }

        // Only update animation if not performing
        if (!player.userData.performing) {
          const animationData: AnimationData = {
            actionName: 'walk2',
            player,
            delta: getDelta() * 2,
            speed: 20,
            backward: false,
            distance: 0.5,
          };
          updateAnimation(animationData);
        }
      },
    });

    // Start kick animation
    playActionTimeline(manager, player, 'kick', getDelta, {
      allowMovement: false,
      allowRotation: false,
    });

    // Clear action calls
    (player.userData.actions.walk2.play as any).mockClear();
    (player.userData.actions.walk2.fadeIn as any).mockClear();

    // Run timeline once
    animateTimeline(manager, 0);

    // NOW THIS SHOULD PASS: walk2 action should NOT be triggered when kick is performing
    expect(player.userData.actions.walk2.play).not.toHaveBeenCalled();
    expect(player.userData.actions.walk2.fadeIn).not.toHaveBeenCalled();
  });
});
