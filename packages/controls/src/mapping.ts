import type { ControlAction, ControlDevice, ControlMapping } from './types'

/**
 * Assign a trigger to an action on a device, returning a new mapping.
 * Any other trigger already bound to the same action on that device is removed,
 * so each action keeps a single trigger per device.
 *
 * @param {ControlMapping} mapping Current mapping (not mutated)
 * @param {ControlDevice} device Device to update
 * @param {string} trigger Trigger key/button/direction to bind
 * @param {ControlAction} action Action the trigger should fire
 * @returns {ControlMapping} A new mapping with the binding applied
 */
export function assignBinding(
  mapping: ControlMapping,
  device: ControlDevice,
  trigger: string,
  action: ControlAction
): ControlMapping {
  const deviceMap = mapping[device] ?? {}
  const withoutAction = Object.fromEntries(
    Object.entries(deviceMap).filter(([, boundAction]) => boundAction !== action)
  )
  return { ...mapping, [device]: { ...withoutAction, [trigger]: action } }
}

/**
 * Remove a trigger from a device, returning a new mapping.
 *
 * @param {ControlMapping} mapping Current mapping (not mutated)
 * @param {ControlDevice} device Device to update
 * @param {string} trigger Trigger to remove
 * @returns {ControlMapping} A new mapping without the trigger
 */
export function removeBinding(
  mapping: ControlMapping,
  device: ControlDevice,
  trigger: string
): ControlMapping {
  const deviceMap = mapping[device] ?? {}
  const next = Object.fromEntries(
    Object.entries(deviceMap).filter(([boundTrigger]) => boundTrigger !== trigger)
  )
  return { ...mapping, [device]: next }
}

/**
 * Build the default control mapping used as a starting point in the mapper.
 * Covers keyboard (WASD + arrows), gamepad (face buttons + dpad) and faux-pad
 * directions for the standard movement actions.
 *
 * @returns {ControlMapping} A fresh default mapping
 */
export function createDefaultMapping(): ControlMapping {
  return {
    keyboard: {
      w: 'move-forward',
      s: 'move-back',
      a: 'move-left',
      d: 'move-right',
      ArrowUp: 'move-forward',
      ArrowDown: 'move-back',
      ArrowLeft: 'move-left',
      ArrowRight: 'move-right',
      ' ': 'jump'
    },
    gamepad: {
      'dpad-up': 'move-forward',
      'dpad-down': 'move-back',
      'dpad-left': 'move-left',
      'dpad-right': 'move-right',
      cross: 'jump'
    },
    'faux-pad': {
      up: 'move-forward',
      down: 'move-back',
      left: 'move-left',
      right: 'move-right'
    }
  }
}
