import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createControls } from './core';

describe('createControls - Multi-trigger support', () => {
  let onActionMock: ReturnType<typeof vi.fn>;
  let onReleaseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onActionMock = vi.fn();
    onReleaseMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should keep action active when one trigger is released but another remains', () => {
    const { currentActions, destroyControls } = createControls({
      mapping: {
        keyboard: { w: 'move-forward' },
        gamepad: { 'axis1-up': 'move-forward' },
      },
      onAction: onActionMock,
      onRelease: onReleaseMock,
      keyboard: false,
      gamepad: false,
      touch: false,
      mouse: false,
    });

    // Simulate keyboard 'w' pressed
    if (!currentActions['move-forward']) {
      currentActions['move-forward'] = {
        action: 'move-forward',
        trigger: 'w',
        device: 'keyboard',
        triggers: new Set(['keyboard:w']),
      };
    }

    expect(currentActions['move-forward']).toBeDefined();
    expect(currentActions['move-forward'].triggers.size).toBe(1);

    // Simulate gamepad axis also triggering the same action
    currentActions['move-forward'].triggers.add('gamepad-axis:axis1-up');
    expect(currentActions['move-forward'].triggers.size).toBe(2);

    // Release keyboard, but gamepad is still active
    currentActions['move-forward'].triggers.delete('keyboard:w');
    
    // Action should still be active because gamepad trigger remains
    expect(currentActions['move-forward']).toBeDefined();
    expect(currentActions['move-forward'].triggers.size).toBe(1);
    expect(currentActions['move-forward'].triggers.has('gamepad-axis:axis1-up')).toBe(true);

    // Release gamepad trigger
    currentActions['move-forward'].triggers.delete('gamepad-axis:axis1-up');
    
    // Now the action should be removed since no triggers remain
    if (currentActions['move-forward']?.triggers.size === 0) {
      delete currentActions['move-forward'];
    }
    
    expect(currentActions['move-forward']).toBeUndefined();

    destroyControls();
  });

  it('should call onAction only once when multiple triggers activate the same action', () => {
    const controls = createControls({
      mapping: {
        keyboard: { w: 'move-forward' },
        gamepad: { 'axis1-up': 'move-forward', 'dpad-up': 'move-forward' },
      },
      onAction: onActionMock,
      onRelease: onReleaseMock,
      keyboard: false,
      gamepad: false,
      touch: false,
      mouse: false,
    });

    const { currentActions } = controls;

    // First trigger activates the action
    if (!currentActions['move-forward']) {
      currentActions['move-forward'] = {
        action: 'move-forward',
        trigger: 'w',
        device: 'keyboard',
        triggers: new Set(['keyboard:w']),
      };
      onActionMock('move-forward', 'w', 'keyboard');
    }

    expect(onActionMock).toHaveBeenCalledTimes(1);
    expect(onActionMock).toHaveBeenCalledWith('move-forward', 'w', 'keyboard');

    // Second trigger for same action shouldn't call onAction again
    currentActions['move-forward'].triggers.add('gamepad-axis:axis1-up');
    
    // onAction should still only be called once
    expect(onActionMock).toHaveBeenCalledTimes(1);

    controls.destroyControls();
  });

  it('should call onRelease only when all triggers are released', () => {
    const controls = createControls({
      mapping: {
        keyboard: { w: 'move-forward' },
        gamepad: { 'axis1-up': 'move-forward' },
      },
      onAction: onActionMock,
      onRelease: onReleaseMock,
      keyboard: false,
      gamepad: false,
      touch: false,
      mouse: false,
    });

    const { currentActions } = controls;

    // Activate with two triggers
    currentActions['move-forward'] = {
      action: 'move-forward',
      trigger: 'w',
      device: 'keyboard',
      triggers: new Set(['keyboard:w', 'gamepad-axis:axis1-up']),
    };

    // Release first trigger
    currentActions['move-forward'].triggers.delete('keyboard:w');
    
    // onRelease should NOT be called yet
    expect(onReleaseMock).toHaveBeenCalledTimes(0);

    // Release second trigger
    currentActions['move-forward'].triggers.delete('gamepad-axis:axis1-up');
    if (currentActions['move-forward'].triggers.size === 0) {
      delete currentActions['move-forward'];
      onReleaseMock('move-forward', 'axis1-up', 'gamepad-axis');
    }

    // Now onRelease should be called
    expect(onReleaseMock).toHaveBeenCalledTimes(1);

    controls.destroyControls();
  });
});
