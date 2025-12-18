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

    // Simulate keydown event
    const event = new KeyboardEvent('keydown', { key: 'a' });
    window.dispatchEvent(event);
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

    // Remap to new options
    controls.remapControlsOptions({
      mapping: {
        keyboard: { b: 'new-action' },
      },
      onAction: onActionNew,
    });

    // Simulate keydown for old and new keys
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

    expect(onActionOld).not.toHaveBeenCalled();
    expect(onActionNew).toHaveBeenCalledWith('new-action', 'b', 'keyboard');
    controls.destroyControls();
  });
});
