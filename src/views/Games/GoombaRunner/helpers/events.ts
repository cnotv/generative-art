import { GAME_STATUS } from "../config";

interface EventHandlers {
  keyboard?: Record<string, () => void>;
  touch?: () => void;
  gamepad?: {
    buttons?: Record<number, () => void>; // Button index to handler mapping
    axes?: Record<number, (value: number) => void>; // Axis index to handler mapping
  };
}

const activeListeners: Array<{
  target: EventTarget;
  type: string;
  listener: EventListener;
}> = [];

let gamepadPollingInterval: number | null = null;
let lastGamepadButtonStates: Record<string, boolean> = {};

// Add event listener with tracking
const addTrackedEventListener = (
  target: EventTarget,
  type: string,
  listener: EventListener
) => {
  target.addEventListener(type, listener);
  activeListeners.push({ target, type, listener });
};

// Stop gamepad polling
const stopGamepadPolling = () => {
  if (gamepadPollingInterval !== null) {
    window.clearInterval(gamepadPollingInterval);
    gamepadPollingInterval = null;
  }
  lastGamepadButtonStates = {};
};

// Remove all tracked event listeners
export const removeAllEventListeners = () => {
  activeListeners.forEach(({ target, type, listener }) => {
    target.removeEventListener(type, listener);
  });
  activeListeners.length = 0;
  stopGamepadPolling(); // Also stop gamepad polling
};

// Start gamepad polling
const startGamepadPolling = (gamepadConfig: {
  buttons?: Record<number, () => void>;
  axes?: Record<number, (value: number) => void>;
}) => {
  stopGamepadPolling(); // Clear any existing polling

  gamepadPollingInterval = window.setInterval(() => {
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (gamepad && gamepadConfig.buttons) {
        // Check all configured buttons
        Object.entries(gamepadConfig.buttons).forEach(([buttonIndex, handler]) => {
          const buttonIdx = parseInt(buttonIndex);
          const button = gamepad.buttons[buttonIdx];
          const buttonKey = `gamepad${i}_button${buttonIdx}`;

          // Trigger handler on button press (not held)
          if (button && button.pressed && !lastGamepadButtonStates[buttonKey]) {
            handler();
          }

          // Update button state
          lastGamepadButtonStates[buttonKey] = button ? button.pressed : false;
        });
      }

      // Handle axes if configured
      if (gamepad && gamepadConfig.axes) {
        Object.entries(gamepadConfig.axes).forEach(([axisIndex, handler]) => {
          const axisIdx = parseInt(axisIndex);
          const axisValue = gamepad.axes[axisIdx];
          if (axisValue !== undefined) {
            handler(axisValue);
          }
        });
      }
    }
  }, 50); // Poll every 50ms for responsive input
};

export const handleJumpGoomba = (uiStore: any) => {
  uiStore.controls.jump = true;
  // Reset jump control after a short delay to allow the jump to register
  setTimeout(() => {
    uiStore.controls.jump = false;
  }, 100);
};

export const updateEventListeners = (
  gameStatus: string,
  callbacks: {
    onStart: () => void;
    onRestart: () => void;
    onJump: () => void;
  }
) => {
  removeAllEventListeners();

  const listenersMap: Record<string, EventHandlers> = {
    [GAME_STATUS.START]: {
      keyboard: {
        " ": callbacks.onStart,
        Enter: callbacks.onStart,
      },
      touch: callbacks.onStart,
      gamepad: {
        buttons: {
          0: callbacks.onStart, // X button
          12: callbacks.onStart, // D-pad up
        },
      },
    },
    [GAME_STATUS.PLAYING]: {
      keyboard: {
        " ": callbacks.onJump,
        ArrowUp: callbacks.onJump,
      },
      touch: callbacks.onJump,
      gamepad: {
        buttons: {
          0: callbacks.onJump, // X button (jump)
          12: callbacks.onJump, // D-pad up (jump)
        },
      },
    },
    [GAME_STATUS.GAME_OVER]: {
      keyboard: {
        " ": callbacks.onRestart,
        Enter: callbacks.onRestart,
      },
      touch: callbacks.onRestart,
      gamepad: {
        buttons: {
          0: callbacks.onRestart, // X button
          12: callbacks.onRestart, // D-pad up
        },
      },
    },
  };

  const listeners = listenersMap[gameStatus];

  // Add keyboard listeners
  if (listeners.keyboard) {
    const keyHandler = (event: KeyboardEvent) => {
      const handler = listeners.keyboard![event.key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };
    addTrackedEventListener(window, "keydown", keyHandler as EventListener);
  }

  // Add touch/click listeners
  if (listeners.touch) {
    const touchHandler = (event: TouchEvent) => {
      const handler = listeners.touch;
      if (handler && event.type === "touchstart") {
        event.preventDefault();
        handler();
      }
    };

    addTrackedEventListener(window, "touchstart", touchHandler as EventListener);
    addTrackedEventListener(window, "click", touchHandler as EventListener);
  }

  // Add gamepad polling
  if (listeners.gamepad) {
    startGamepadPolling(listeners.gamepad);
  }
};
