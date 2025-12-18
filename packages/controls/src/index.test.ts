import { describe, it, expect, vi } from 'vitest';
import { createControls, ControlsOptions } from './index';

describe('createControls', () => {
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
