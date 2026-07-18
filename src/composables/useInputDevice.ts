import { ref, type Ref } from 'vue'

export type InputDevice = 'keyboard' | 'gamepad'

// Singleton by design: the "device the player is currently using" is a
// page-wide fact, reported from every controls instance and read by every
// key pill.
const device = ref<InputDevice>('keyboard')

/**
 * Records which input device produced the latest action, so device-aware UI
 * (key pills) can show only the relevant bindings.
 *
 * @param rawSource Source string from a controls callback ("gamepad", "gamepad-axis", "keyboard", "mouse", ...)
 */
export const reportInputSource = (rawSource: string): void => {
  device.value = rawSource.startsWith('gamepad') ? 'gamepad' : 'keyboard'
}

/**
 * The input device the player used most recently.
 *
 * @returns Reactive reference to the current input device
 */
export const useInputDevice = (): { device: Ref<InputDevice> } => ({ device })
