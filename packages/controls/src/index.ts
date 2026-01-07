import type {
  ControlAction,
  ControlMapping,
  ControlsOptions,
  ControlsExtras,
  ControlsCurrents,
  ControlsLogs,
  ControlHandlers,
} from './core';
import { DEFAULT_BUTTON_MAP } from './core';
import { createKeyboardController } from './keyboard';
import { createGamepadController } from './gamepad';
import { createTouchController } from './touch';
import { createMouseController } from './mouse';

// Re-export types
export type {
  ControlAction,
  ControlMapping,
  ControlsOptions,
  ControlsExtras,
  ControlsCurrents,
  ControlsLogs,
};

/**
 * Stateless controls logic for keyboard, gamepad, and touch
 * This module does not manage state, but emits events or calls callbacks
 * All mapping is configurable via a config object and updated with remapControlsOptions()
 * 
 * @param { ControlsOptions } options Controls configuration options
 * @returns { ControlsExtras }
 * @example
 * ```typescript
 * import { createControls } from '@webgamekit/controls';
 * const { destroyControls, remapControlsOptions, currentActions, logs, buttonMap } = createControls({
 *   mapping: {
 *     keyboard: { ArrowLeft: 'left', ArrowRight: 'right', ' ': 'jump' },
 *     gamepad: { left: 'left', right: 'right', a: 'jump' },
 *     touch: { tap: 'jump' }
 *   },
 *   onAction: (action, trigger, device) => {
 *     // e.g. jump, tap, touch
 *   }
 * });
 * ```
 */
export function createControls(options: ControlsOptions): ControlsExtras {
  const buttonMap = options.buttonMap || DEFAULT_BUTTON_MAP;

  // Store for currently used actions and logs
  const currentActions: ControlsCurrents = {};
  const logs: ControlsLogs = [];

  // Mutable reference for mapping (used by controllers)
  const mappingRef = { current: options.mapping };

  let onActionRaw = options.onAction || null;
  let onReleaseRaw = options.onRelease || null;
  const onInput = options.onInput;

  // Wrapper for onAction to compile logic before calling user handler
  function onAction(action: ControlAction, trigger: string, device: string) {
    if (currentActions[action]) return;
    currentActions[action] = { action, trigger, device };
    logs.push({ action, trigger, device, timestamp: Date.now(), type: 'action' });
    if (onActionRaw) onActionRaw(action, trigger, device);
  }

  // Wrapper for onRelease to remove from currentActions and log
  function onRelease(action: ControlAction, trigger: string, device: string) {
    if (currentActions[action]) {
      delete currentActions[action];
      logs.push({ action, trigger, device, timestamp: Date.now(), type: 'release' });
    }
    if (onReleaseRaw) onReleaseRaw(action, trigger, device);
  }

  const handlers: ControlHandlers = {
    onAction,
    onRelease,
    onInput,
  };

  // Create controllers
  const keyboardController = createKeyboardController(mappingRef, handlers);
  const gamepadController = createGamepadController(mappingRef, handlers, buttonMap);
  const touchController = createTouchController(mappingRef, handlers);
  const mouseController = createMouseController(mappingRef, handlers);

  // Track bound controllers and their targets
  const boundControllers: Array<() => void> = [];

  function autoBind() {
    // Keyboard
    if (options.keyboard !== false) {
      keyboardController.bind();
      boundControllers.push(() => keyboardController.unbind());
    }

    // Gamepad
    if (options.gamepad !== false && gamepadController.isSupported()) {
      gamepadController.bind();
      boundControllers.push(() => gamepadController.unbind());
    }

    // Touch
    const touchTarget = (options.touchTarget || window) as HTMLElement;
    if (options.touch !== false && touchController.isSupported() && touchTarget) {
      touchController.bind(touchTarget);
      boundControllers.push(() => touchController.unbind(touchTarget));
    }

    // Mouse
    const mouseTarget = (options.mouseTarget || window) as HTMLElement;
    if (options.mouse !== false && mouseTarget) {
      mouseController.bind(mouseTarget);
      boundControllers.push(() => mouseController.unbind(mouseTarget));
    }
  }

  function unbindAll() {
    boundControllers.forEach((unbind) => unbind());
    boundControllers.length = 0;
  }

  function destroyControls() {
    unbindAll();
    // Reset state
    for (const key in currentActions) delete currentActions[key];
    logs.length = 0;
  }

  function remapControlsOptions(newOptions: ControlsOptions) {
    // Unbind all current event listeners, but do not reset logs/currentActions
    unbindAll();
    
    // Update internal state
    Object.assign(options, newOptions);
    mappingRef.current = newOptions.mapping || {};
    onActionRaw = newOptions.onAction || null;
    onReleaseRaw = newOptions.onRelease || null;
    
    // Re-bind listeners with new options
    autoBind();
  }

  // Auto-bind on create
  autoBind();

  return {
    destroyControls,
    remapControlsOptions,
    currentActions,
    logs,
    buttonMap,
  };
}
