import type {
  ControlAction,
  ControlsOptions,
  ControlsExtras,
  ControlsCurrents,
  ControlsLogs,
  ControlHandlers,
} from './types';
import { DEFAULT_BUTTON_MAP } from './constants';
import { createKeyboardController } from './keyboard';
import { createGamepadController } from './gamepad';
import { createTouchController } from './touch';
import { createMouseController } from './mouse';

/**
 * Detect if the device is mobile
 */
export const isMobile = (): boolean => {
  // Modern device detection: prioritize touch capability and iPadOS quirks
  const ua = navigator.userAgent;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
  const isSmallScreen = window.innerWidth < 768;
  // iPadOS 13+ reports as Macintosh, but has touch
  const isModernIpad = isTouch && /Macintosh/.test(ua) && (
    ua.includes('Safari') || ua.includes('AppleWebKit')
  );
  // Fallback to classic mobile UA
  const isClassicMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  return isModernIpad || (isTouch && isSmallScreen) || isClassicMobile;
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
  const mappingReference = { current: options.mapping };

  let onActionRaw = options.onAction || null;
  let onReleaseRaw = options.onRelease || null;
  const onInput = options.onInput;

  // Wrapper for onAction to compile logic before calling user handler
  function onAction(action: ControlAction, trigger: string, device: string) {
    const triggerKey = `${device}:${trigger}`;
    
    if (!currentActions[action]) {
      // First trigger for this action
      currentActions[action] = { 
        action, 
        trigger, 
        device,
        triggers: new Set([triggerKey])
      };
      logs.push({ action, trigger, device, timestamp: Date.now(), type: 'action' });
      if (onActionRaw) onActionRaw(action, trigger, device);
    } else {
      // Additional trigger for already active action
      currentActions[action].triggers.add(triggerKey);
    }
  }

  // Wrapper for onRelease to remove from currentActions and log
  function onRelease(action: ControlAction, trigger: string, device: string) {
    const triggerKey = `${device}:${trigger}`;
    
    if (currentActions[action]) {
      currentActions[action].triggers.delete(triggerKey);
      
      // Only remove the action if no triggers remain
      if (currentActions[action].triggers.size === 0) {
        delete currentActions[action];
        logs.push({ action, trigger, device, timestamp: Date.now(), type: 'release' });
        if (onReleaseRaw) onReleaseRaw(action, trigger, device);
      }
    }
  }

  const handlers: ControlHandlers = {
    onAction,
    onRelease,
    onInput,
  };

  // Create controllers
  const keyboardController = createKeyboardController(mappingReference, handlers);
  const gamepadController = createGamepadController(mappingReference, handlers, buttonMap, options.axisThreshold || 0.5);
  const touchController = createTouchController(mappingReference, handlers);
  const mouseController = createMouseController(mappingReference, handlers);

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
    mappingReference.current = newOptions.mapping || {};
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
