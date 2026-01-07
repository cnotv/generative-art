import type { ControlMapping, ControlHandlers } from './types';

export interface GamepadController {
  bind: (index?: number) => void;
  unbind: () => void;
  isSupported: () => boolean;
}

export function createGamepadController(
  mappingRef: { current: ControlMapping },
  handlers: ControlHandlers,
  buttonMap: string[]
): GamepadController {
  let gamepadIndex: number | null = null;
  let gamepadInterval: number | null = null;
  let lastButtons: boolean[] = [];

  function pollGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepadIndex !== null ? gamepads[gamepadIndex] : null;
    if (!gp) return;

    gp.buttons.forEach((btn, i) => {
      const btnName = buttonMap[i] || `button${i}`;
      const action = mappingRef.current.gamepad?.[btnName] ?? 'no action';
      
      if (!action) {
        lastButtons[i] = btn.pressed;
        return;
      }

      if (btn.pressed && !lastButtons[i]) {
        handlers.onAction(action, btnName, 'gamepad');
      }
      if (!btn.pressed && lastButtons[i]) {
        handlers.onRelease(action, btnName, 'gamepad');
      }
      
      lastButtons[i] = btn.pressed;
    });
  }

  function bind(index = 0) {
    gamepadIndex = index;
    lastButtons = [];
    gamepadInterval = window.setInterval(pollGamepad, 1000 / 30);
  }

  function unbind() {
    if (gamepadInterval) window.clearInterval(gamepadInterval);
    gamepadInterval = null;
    gamepadIndex = null;
    lastButtons = [];
  }

  function isSupported() {
    return typeof window !== 'undefined' && typeof navigator.getGamepads === 'function';
  }

  return { bind, unbind, isSupported };
}
