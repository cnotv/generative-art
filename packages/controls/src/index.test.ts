import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createControls, ControlsOptions } from './index';

describe('createControls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should accept options and call onAction for keyboard events', () => {
    const onAction = vi.fn();
    const options: ControlsOptions = {
      mapping: {
        keyboard: { a: 'test-action' },
      },
      onAction,
    };
    const { destroyControls } = createControls(options);
    // Directly call the onAction logic to simulate keydown
    onAction('test-action', 'a', 'keyboard');
    expect(onAction).toHaveBeenCalledWith('test-action', 'a', 'keyboard');
    destroyControls();
  });

  it('should override actions with remapControlsOptions and not call old actions', () => {
    const onActionOld = vi.fn();
    const onActionNew = vi.fn();
    const options: ControlsOptions = {
      mapping: {
        keyboard: { a: 'old-action' },
      },
      onAction: onActionOld,
    };
    const controls = createControls(options);

      // Remap to new options using the same key
      controls.remapControlsOptions({
        mapping: {
          keyboard: { a: 'new-action' },
        },
        onAction: onActionNew,
      });

    // Simulate keydown for old and new keys
      // Simulate keydown event for the same key
      const event = new KeyboardEvent('keydown', { key: 'a' });
      window.dispatchEvent(event);

    expect(onActionOld).not.toHaveBeenCalled();
    expect(onActionNew).toHaveBeenCalledWith('new-action', 'a', 'keyboard');
    expect(onActionNew).toHaveBeenCalledTimes(1);
    controls.destroyControls();
  });

  it('should properly handle action release and remove from currentActions', () => {
    const onAction = vi.fn();
    const onRelease = vi.fn();
    const options: ControlsOptions = {
      mapping: {
        keyboard: { w: 'moving' },
      },
      onAction,
      onRelease,
    };
    
    const { destroyControls, currentActions } = createControls(options);

    // Simulate keydown
    const keydownEvent = new KeyboardEvent('keydown', { key: 'w' });
    window.dispatchEvent(keydownEvent);

    // Action should be in currentActions
    expect(currentActions['moving']).toBeDefined();
    expect(currentActions['moving'].trigger).toBe('w');
    expect(currentActions['moving'].device).toBe('keyboard');
    expect(onAction).toHaveBeenCalledWith('moving', 'w', 'keyboard');

    // Simulate keyup
    const keyupEvent = new KeyboardEvent('keyup', { key: 'w' });
    window.dispatchEvent(keyupEvent);

    // Action should be removed from currentActions
    expect(currentActions['moving']).toBeUndefined();
    expect(onRelease).toHaveBeenCalledWith('moving', 'w', 'keyboard');

    destroyControls();
  });

  it('should handle multiple triggers for the same action and only release when all are inactive', () => {
    const onAction = vi.fn();
    const onRelease = vi.fn();
    const options: ControlsOptions = {
      mapping: {
        keyboard: { w: 'moving', s: 'moving' },
      },
      onAction,
      onRelease,
    };
    
    const { destroyControls, currentActions } = createControls(options);

    // Press 'w' key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(currentActions['moving']).toBeDefined();
    expect(currentActions['moving'].trigger).toBe('w');
    expect(onAction).toHaveBeenCalledTimes(1);

    // Press 's' key (also maps to 'moving')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    // currentActions should still have 'moving' but shouldn't trigger onAction again
    expect(currentActions['moving']).toBeDefined();
    expect(onAction).toHaveBeenCalledTimes(1); // Should not call again

    // Release 'w' key
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    // Since 's' is still pressed, action should still be in currentActions
    // With multi-trigger support, it should remain active!
    expect(currentActions['moving']).toBeDefined();
    expect(currentActions['moving'].triggers.size).toBe(1);
    expect(currentActions['moving'].triggers.has('keyboard:s')).toBe(true);
    expect(onRelease).toHaveBeenCalledTimes(0); // Should NOT call onRelease yet

    // Release 's' key
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
    // Now the action should be fully released
    expect(currentActions['moving']).toBeUndefined();
    expect(onRelease).toHaveBeenCalledTimes(1);

    destroyControls();
  });

  it('should track each trigger independently for the same action', () => {
    const onAction = vi.fn();
    const onRelease = vi.fn();
    
    const options: ControlsOptions = {
      mapping: {
        keyboard: { w: 'moving', ArrowUp: 'moving' },
      },
      onAction,
      onRelease,
    };
    
    const { destroyControls, currentActions } = createControls(options);

    // Press 'w' - should trigger action
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(currentActions['moving']).toBeDefined();
    expect(onAction).toHaveBeenCalledWith('moving', 'w', 'keyboard');
    expect(currentActions['moving'].triggers.size).toBe(1);

    // Press 'ArrowUp' while 'w' is still pressed - should NOT trigger action again
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(onAction).toHaveBeenCalledTimes(1); // Still 1
    expect(currentActions['moving'].triggers.size).toBe(2); // But now tracking 2 triggers

    // Release 'w' - action should still be active because ArrowUp is pressed
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    expect(currentActions['moving']).toBeDefined(); // Should still be defined!
    expect(currentActions['moving'].triggers.size).toBe(1); // Only ArrowUp remains
    expect(onRelease).toHaveBeenCalledTimes(0); // Should not call onRelease yet

    // Release 'ArrowUp' - now action should be released
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
    expect(currentActions['moving']).toBeUndefined();
    expect(onRelease).toHaveBeenCalledTimes(1); // Now onRelease is called

    destroyControls();
  });
});

describe('controls state management', () => {
  it('should update currentActions and logs on action and release', () => {
    const options: ControlsOptions = {
      mapping: { keyboard: { a: 'test-action' } },
    };
    const controls = createControls(options);
    // Simulate action
    controls.currentActions['test-action'] = { action: 'test-action', trigger: 'a', device: 'keyboard' };
    controls.logs.push({ action: 'test-action', trigger: 'a', device: 'keyboard', timestamp: Date.now(), type: 'action' });
    expect(Object.keys(controls.currentActions)).toContain('test-action');
    expect(controls.logs.length).toBeGreaterThan(0);
    // Simulate release
    delete controls.currentActions['test-action'];
    controls.logs.push({ action: 'test-action', trigger: 'a', device: 'keyboard', timestamp: Date.now(), type: 'release' });
    expect(Object.keys(controls.currentActions)).not.toContain('test-action');
    expect(controls.logs[controls.logs.length - 1].type).toBe('release');
    controls.destroyControls();
  });

  it('should clear currentActions and logs on destroyControls', () => {
    const options: ControlsOptions = {
      mapping: { keyboard: { a: 'test-action' } },
    };
    const controls = createControls(options);
    // Simulate action
    controls.currentActions['test-action'] = { action: 'test-action', trigger: 'a', device: 'keyboard' };
    controls.logs.push({ action: 'test-action', trigger: 'a', device: 'keyboard', timestamp: Date.now(), type: 'action' });
    // Clear
    controls.destroyControls();
    expect(Object.keys(controls.currentActions)).toHaveLength(0);
    expect(controls.logs).toHaveLength(0);
  });
});
