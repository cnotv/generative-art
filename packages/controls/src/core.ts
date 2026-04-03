import type {
  ControlAction,
  ControlsOptions,
  ControlsExtras,
  ControlsCurrents,
  ControlsLogs,
  ControlHandlers
} from './types'
import { DEFAULT_BUTTON_MAP } from './constants'
import { createKeyboardController } from './keyboard'
import type { KeyboardController } from './keyboard'
import { createGamepadController } from './gamepad'
import type { GamepadController } from './gamepad'
import { createTouchController } from './touch'
import type { TouchController } from './touch'
import { createMouseController } from './mouse'
import type { MouseController } from './mouse'

/**
 * Detect if the device is mobile
 */
export const isMobile = (): boolean => {
  // Modern device detection: prioritize touch capability and iPadOS quirks
  const ua = navigator.userAgent
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1
  const isSmallScreen = window.innerWidth < 768
  // iPadOS 13+ reports as Macintosh, but has touch
  const isModernIpad =
    isTouch && /Macintosh/.test(ua) && (ua.includes('Safari') || ua.includes('AppleWebKit'))
  // Fallback to classic mobile UA
  const isClassicMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  return isModernIpad || (isTouch && isSmallScreen) || isClassicMobile
}

interface BoundControllers {
  keyboard: KeyboardController
  gamepad: GamepadController
  touch: TouchController
  mouse: MouseController
}

function bindKeyboard(
  controller: KeyboardController,
  options: ControlsOptions,
  boundList: Array<() => void>
) {
  if (options.keyboard === false) return
  const keyboardTarget = options.keyboardTarget ?? null
  controller.bind(keyboardTarget)
  boundList.push(() => controller.unbind(keyboardTarget))
}

function bindGamepad(
  controller: GamepadController,
  options: ControlsOptions,
  boundList: Array<() => void>
) {
  if (options.gamepad === false || !controller.isSupported()) return
  controller.bind()
  boundList.push(() => controller.unbind())
}

function bindTouch(
  controller: TouchController,
  options: ControlsOptions,
  boundList: Array<() => void>
) {
  const touchTarget = (options.touchTarget || window) as HTMLElement
  if (options.touch === false || !controller.isSupported() || !touchTarget) return
  controller.bind(touchTarget)
  boundList.push(() => controller.unbind(touchTarget))
}

function bindMouse(
  controller: MouseController,
  options: ControlsOptions,
  boundList: Array<() => void>
) {
  const mouseTarget = (options.mouseTarget || window) as HTMLElement
  if (options.mouse === false || !mouseTarget) return
  controller.bind(mouseTarget)
  boundList.push(() => controller.unbind(mouseTarget))
}

function bindAllControllers(
  controllers: BoundControllers,
  options: ControlsOptions,
  boundList: Array<() => void>
) {
  bindKeyboard(controllers.keyboard, options, boundList)
  bindGamepad(controllers.gamepad, options, boundList)
  bindTouch(controllers.touch, options, boundList)
  bindMouse(controllers.mouse, options, boundList)
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
  const buttonMap = options.buttonMap || DEFAULT_BUTTON_MAP

  const currentActions: ControlsCurrents = {}
  const logs: ControlsLogs = []
  const mappingReference = { current: options.mapping }

  let onActionRaw = options.onAction || null
  let onReleaseRaw = options.onRelease || null
  const onInput = options.onInput

  function onAction(action: ControlAction, trigger: string, device: string) {
    const triggerKey = `${device}:${trigger}`
    if (!currentActions[action]) {
      currentActions[action] = { action, trigger, device, triggers: new Set([triggerKey]) }
      logs.push({ action, trigger, device, timestamp: Date.now(), type: 'action' })
      if (onActionRaw) onActionRaw(action, trigger, device)
    } else {
      currentActions[action].triggers.add(triggerKey)
    }
  }

  function onRelease(action: ControlAction, trigger: string, device: string) {
    const triggerKey = `${device}:${trigger}`
    if (currentActions[action]) {
      currentActions[action].triggers.delete(triggerKey)
      if (currentActions[action].triggers.size === 0) {
        delete currentActions[action]
        logs.push({ action, trigger, device, timestamp: Date.now(), type: 'release' })
        if (onReleaseRaw) onReleaseRaw(action, trigger, device)
      }
    }
  }

  const handlers: ControlHandlers = { onAction, onRelease, onInput }

  const controllers: BoundControllers = {
    keyboard: createKeyboardController(mappingReference, handlers),
    gamepad: createGamepadController(
      mappingReference,
      handlers,
      buttonMap,
      options.axisThreshold || 0.5
    ),
    touch: createTouchController(mappingReference, handlers),
    mouse: createMouseController(mappingReference, handlers)
  }

  const boundList: Array<() => void> = []

  function autoBind() {
    bindAllControllers(controllers, options, boundList)
  }

  function unbindAll() {
    boundList.forEach((unbind) => unbind())
    boundList.length = 0
  }

  function destroyControls() {
    unbindAll()
    Object.keys(currentActions).forEach((key) => delete currentActions[key])
    logs.length = 0
  }

  function remapControlsOptions(newOptions: ControlsOptions) {
    unbindAll()
    Object.assign(options, newOptions)
    mappingReference.current = newOptions.mapping || {}
    onActionRaw = newOptions.onAction || null
    onReleaseRaw = newOptions.onRelease || null
    autoBind()
  }

  autoBind()

  return { destroyControls, remapControlsOptions, currentActions, logs, buttonMap }
}
