import type { ControlMapping, ControlHandlers } from './types';

export interface GamepadController {
  bind: (index?: number) => void;
  unbind: () => void;
  isSupported: () => boolean;
}

function pollButtons(
  gp: Gamepad,
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers,
  buttonMap: string[],
  lastButtons: boolean[]
): void {
  gp.buttons.forEach((button, i) => {
    const buttonName = buttonMap[i] || `button${i}`;
    const action = mappingReference.current.gamepad?.[buttonName] ?? 'no action';
    
    if (!action) {
      lastButtons[i] = button.pressed;
      return;
    }

    if (button.pressed && !lastButtons[i]) {
      handlers.onAction(action, buttonName, 'gamepad');
    }
    if (!button.pressed && lastButtons[i]) {
      handlers.onRelease(action, buttonName, 'gamepad');
    }
    
    lastButtons[i] = button.pressed;
  });
}

function pollAxisDirection(
  axesMapping: Record<string, string>,
  handlers: ControlHandlers,
  key: string,
  isActive: boolean,
  lastAxesStates: Record<string, boolean>
): void {
  const action = axesMapping[key];
  if (!action) return;

  if (isActive && !lastAxesStates[key]) {
    handlers.onAction(action, key, 'gamepad-axis');
  } else if (!isActive && lastAxesStates[key]) {
    handlers.onRelease(action, key, 'gamepad-axis');
  }
  lastAxesStates[key] = isActive;
}

function pollHorizontalAxis(
  axesMapping: Record<string, string>,
  handlers: ControlHandlers,
  axisValue: number,
  axisIndex: number,
  axisThreshold: number,
  lastAxesStates: Record<string, boolean>
): void {
  const leftKey = `axis${axisIndex}-left`;
  const rightKey = `axis${axisIndex}-right`;
  
  const isLeft = axisValue < -axisThreshold;
  const isRight = axisValue > axisThreshold;
  
  pollAxisDirection(axesMapping, handlers, leftKey, isLeft, lastAxesStates);
  pollAxisDirection(axesMapping, handlers, rightKey, isRight, lastAxesStates);
}

function pollVerticalAxis(
  axesMapping: Record<string, string>,
  handlers: ControlHandlers,
  axisValue: number,
  axisIndex: number,
  axisThreshold: number,
  lastAxesStates: Record<string, boolean>
): void {
  const upKey = `axis${axisIndex}-up`;
  const downKey = `axis${axisIndex}-down`;
  
  const isUp = axisValue < -axisThreshold;
  const isDown = axisValue > axisThreshold;
  
  pollAxisDirection(axesMapping, handlers, upKey, isUp, lastAxesStates);
  pollAxisDirection(axesMapping, handlers, downKey, isDown, lastAxesStates);
}

function pollAxes(
  gp: Gamepad,
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers,
  axisThreshold: number,
  lastAxesStates: Record<string, boolean>
): void {
  const axesMapping = mappingReference.current.gamepad;
  if (!axesMapping) return;

  gp.axes.forEach((axisValue, axisIndex) => {
    // Horizontal axes (usually 0 and 2 for left/right sticks)
    if (axisIndex % 2 === 0) {
      pollHorizontalAxis(axesMapping, handlers, axisValue, axisIndex, axisThreshold, lastAxesStates);
    } else {
      // Vertical axes (usually 1 and 3 for left/right sticks)
      pollVerticalAxis(axesMapping, handlers, axisValue, axisIndex, axisThreshold, lastAxesStates);
    }
  });
}

export function createGamepadController(
  mappingReference: { current: ControlMapping },
  handlers: ControlHandlers,
  buttonMap: string[],
  axisThreshold: number = 0.5
): GamepadController {
  let gamepadIndex: number | null = null;
  let gamepadInterval: number | null = null;
  let lastButtons: boolean[] = [];
  let lastAxesStates: Record<string, boolean> = {};

  function pollGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepadIndex !== null ? gamepads[gamepadIndex] : null;
    if (!gp) return;

    pollButtons(gp, mappingReference, handlers, buttonMap, lastButtons);
    pollAxes(gp, mappingReference, handlers, axisThreshold, lastAxesStates);
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
    lastAxesStates = {};
  }

  function isSupported() {
    return typeof window !== 'undefined' && typeof navigator.getGamepads === 'function';
  }

  return { bind, unbind, isSupported };
}
