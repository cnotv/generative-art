export type ControlAction = string;
export type ControlEvent = 'down' | 'up';

export interface ControlMapping {
  keyboard?: Record<string, ControlAction>;
  gamepad?: Record<string, ControlAction>;
  touch?: Record<string, ControlAction>;
}

export interface ControlsOptions {
  mapping: ControlMapping;
  onAction?: (action: ControlAction, trigger: string, device: string) => void;
  onRelease?: (action: ControlAction, trigger: string, device: string) => void;
  onInput?: (action: ControlAction, trigger: string, device: string) => void;
  keyboard?: boolean;
  gamepad?: boolean;
  touch?: boolean;
  mouse?: boolean;
  touchTarget?: HTMLElement | null;
  mouseTarget?: HTMLElement | null;
  buttonMap?: string[]; // Optional: custom button names by index
}

export type ControlsCurrents = Record<string, { action: string; trigger: string; device: string }>;
export type ControlsLogs = Array<{ action: string; trigger: string; device: string; timestamp: number }>;

export type ControlsExtras = {
  destroyControls: () => void;
  remapControlsOptions: (newOptions: ControlsOptions) => void;
  currentActions: ControlsCurrents;
  logs: ControlsLogs;
  buttonMap: string[];
}

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
  // Default button names for DualShock/Xbox (can be overridden)
  const buttonMap = [
    'cross',    // 0
    'circle',   // 1
    'square',   // 2
    'triangle', // 3
    'l1',       // 4
    'r1',       // 5
    'l2',       // 6
    'r2',       // 7
    'share',    // 8
    'options',  // 9
    'l3',       // 10
    'r3',       // 11
    'dpad-up',  // 12
    'dpad-down',// 13
    'dpad-left',// 14
    'dpad-right',// 15
    'ps',       // 16
    'touchpad', // 17
  ];

  // Store for currently used actions and logs
  const currentActions: Record<string, { action: string; trigger: string; device: string }> = {};
  const logs: Array<{ action: string; trigger: string; device: string; timestamp: number; type: string }> = [];

  let mapping = options.mapping;
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

  // Keyboard
  function handleKeyDown(event: KeyboardEvent) {
    const action = mapping.keyboard?.[event.key] ?? 'no action';
    if (onAction) onAction(action, event.key, 'keyboard');
    if (onInput) onInput(action, event.key, 'keyboard');
  }
  function handleKeyUp(event: KeyboardEvent) {
    const action = mapping.keyboard?.[event.key] ?? 'no action';
    if (onRelease) onRelease(action, event.key, 'keyboard');
    if (onInput) onInput(action, event.key, 'keyboard');
  }

  function bindKeyboard() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }
  function unbindKeyboard() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  }

  // Gamepad (polling based)
  let gamepadIndex: number | null = null;
  let gamepadInterval: number | null = null;
  let lastButtons: boolean[] = [];

  function pollGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepadIndex !== null ? gamepads[gamepadIndex] : null;
    if (!gp) return;
    gp.buttons.forEach((btn, i) => {
      const btnName = (options.buttonMap && options.buttonMap[i]) || buttonMap[i] || `button${i}`;
      const action = mapping.gamepad?.[btnName] ?? 'no action';
      if (!action) {
        lastButtons[i] = btn.pressed;
        return;
      }
      if (btn.pressed && !lastButtons[i] && onAction) onAction(action, btnName, 'gamepad');
      if (!btn.pressed && lastButtons[i] && onRelease) onRelease(action, btnName, 'gamepad');
      lastButtons[i] = btn.pressed;
    });
  }
  function bindGamepad(index = 0) {
    gamepadIndex = index;
    lastButtons = [];
    gamepadInterval = window.setInterval(pollGamepad, 1000 / 30);
  }
  function unbindGamepad() {
    if (gamepadInterval) window.clearInterval(gamepadInterval);
    gamepadInterval = null;
    gamepadIndex = null;
    lastButtons = [];
  }

  // Touch
  function handleTouch(event: TouchEvent, eventType: ControlEvent) {
    const action = mapping.touch?.['tap'] ?? 'no action';
    if (action) {
      if (onAction && eventType === 'up') onAction(action, event.type, 'touch');
      if (onRelease && eventType === 'down') onRelease(action, event.type, 'touch');
    }
  }
  function bindTouch(target: HTMLElement) {
    target.addEventListener('touchstart', (e) => handleTouch(e, 'down'));
    target.addEventListener('touchend', (e) => handleTouch(e, 'up'));
  }
  function unbindTouch(target: HTMLElement) {
    target.removeEventListener('touchstart', (e) => handleTouch(e, 'down'));
    target.removeEventListener('touchend', (e) => handleTouch(e, 'up'));
  }

  // Mouse
  function handleMouse(event: MouseEvent, eventType: ControlEvent) {
    const action = mapping.touch?.['tap'] ?? 'no action';
    if (action) {
      if (onAction && eventType === 'down') onAction(action, event.type, 'mouse');
      if (onRelease && eventType === 'up') onRelease(action, event.type, 'mouse');
    }
  }
  function bindMouse(target: HTMLElement) {
    target.addEventListener('mousedown', (e) => handleMouse(e, 'down'));
    target.addEventListener('mouseup', (e) => handleMouse(e, 'up'));
  }
  function unbindMouse(target: HTMLElement) {
    target.removeEventListener('mousedown', (e) => handleMouse(e, 'down'));
    target.removeEventListener('mouseup', (e) => handleMouse(e, 'up'));
  }

  // Automatic binding logic
  function isGamepadSupported() {
    return typeof window !== 'undefined' && typeof navigator.getGamepads === 'function';
  }
  function isTouchSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function autoBind() {
    const unbinds: (() => void)[] = [];
    // Keyboard
    if (options.keyboard !== false) {
      bindKeyboard();
      unbinds.push(unbindKeyboard);
    }
    // Gamepad
    if (options.gamepad !== false && isGamepadSupported()) {
      bindGamepad();
      unbinds.push(unbindGamepad);
    }
    // Touch
    const touchTarget = options.touchTarget || window;
    if (options.touch !== false && isTouchSupported() && touchTarget) {
      // @ts-ignore
      bindTouch(touchTarget);
      if (touchTarget instanceof HTMLElement) {
        unbinds.push(() => unbindTouch(touchTarget));
      }
    }
    // Mouse
    const mouseTarget = options.mouseTarget || window;
    if (options.mouse !== false && mouseTarget) {
      // @ts-ignore
      bindMouse(mouseTarget);
      if (mouseTarget instanceof HTMLElement) {
        unbinds.push(() => unbindMouse(mouseTarget));
      }
    }
    return () => {
      unbinds.forEach((fn) => fn());
    };
  }

  // Auto-bind on create
  const destroyControls = function() {
    // Unbind all listeners
    unbindAll();
    // Reset state
    for (const key in currentActions) delete currentActions[key];
    logs.length = 0;
  };
  // Helper to unbind all listeners (used in remap and destroy)
  function unbindAll() {
    // Re-run autoBind to get unbinds, but don't rebind
    const unbinds: (() => void)[] = [];
    if (options.keyboard !== false) unbinds.push(unbindKeyboard);
    if (options.gamepad !== false && isGamepadSupported()) unbinds.push(unbindGamepad);
    const touchTarget = options.touchTarget || window;
    if (options.touch !== false && isTouchSupported() && touchTarget && touchTarget instanceof HTMLElement) unbinds.push(() => unbindTouch(touchTarget));
    const mouseTarget = options.mouseTarget || window;
    if (options.mouse !== false && mouseTarget && mouseTarget instanceof HTMLElement) unbinds.push(() => unbindMouse(mouseTarget));
    unbinds.forEach((fn) => fn());
  }

  function remapControlsOptions(newOptions: ControlsOptions) {
    // Unbind all current event listeners, but do not reset logs/currentActions
    unbindAll();
    // Update internal state
    Object.assign(options, newOptions);
    mapping = newOptions.mapping || {};
    onActionRaw = newOptions.onAction || null;
    onReleaseRaw = newOptions.onRelease || null;
    // Re-bind listeners with new options
    autoBind();
  }

  return {
    destroyControls,
    remapControlsOptions,
    currentActions,
    logs,
    buttonMap,
  };
}
