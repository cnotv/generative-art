import { ref } from 'vue'
import { DEFAULT_BUTTON_MAP } from '@webgamekit/controls'
import type { ControlDevice } from '@webgamekit/controls'

const AXIS_THRESHOLD = 0.6

const buttonName = (index: number): string => DEFAULT_BUTTON_MAP[index] ?? `button-${index}`

const axisName = (index: number, value: number): string => {
  const dir = index % 2 === 0 ? (value < 0 ? 'left' : 'right') : value < 0 ? 'up' : 'down'
  return `axis${index}-${dir}`
}

const pressedButtons = (pad: Gamepad | undefined): number[] =>
  pad ? pad.buttons.flatMap((button, index) => (button.pressed ? [index] : [])) : []

const deflectedAxes = (pad: Gamepad | undefined): number[] =>
  pad ? pad.axes.flatMap((value, index) => (Math.abs(value) > AXIS_THRESHOLD ? [index] : [])) : []

const findFresh = (values: number[], ignored: number[]): number | undefined =>
  values.find((value) => !ignored.includes(value))

type RegisterCancel = (cancel: () => void) => void

// Capture a key, but interrupt if a gamepad input (wrong device) is used.
const captureKeyboard = (registerCancel: RegisterCancel): Promise<string> =>
  new Promise((resolve, reject) => {
    let frame = 0
    let ignoredButtons: number[] | null = null
    let ignoredAxes: number[] | null = null

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      window.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      resolve(event.key)
    }

    const poll = () => {
      const pad = navigator.getGamepads?.().find((entry) => entry) ?? undefined
      const buttons = pressedButtons(pad)
      const axes = deflectedAxes(pad)
      if (ignoredButtons === null) ignoredButtons = buttons
      if (ignoredAxes === null) ignoredAxes = axes
      if (
        findFresh(buttons, ignoredButtons) !== undefined ||
        findFresh(axes, ignoredAxes) !== undefined
      ) {
        window.removeEventListener('keydown', onKeyDown)
        cancelAnimationFrame(frame)
        reject(new Error('interrupted'))
        return
      }
      ignoredButtons = ignoredButtons.filter((index) => buttons.includes(index))
      ignoredAxes = ignoredAxes.filter((index) => axes.includes(index))
      frame = requestAnimationFrame(poll)
    }

    window.addEventListener('keydown', onKeyDown)
    frame = requestAnimationFrame(poll)
    registerCancel(() => {
      window.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      reject(new Error('cancelled'))
    })
  })

// Capture a gamepad button (on release) or stick axis, but interrupt if a key
// (wrong device) is pressed. Inputs already active when capture starts are
// ignored until they return to rest.
const captureGamepad = (registerCancel: RegisterCancel): Promise<string> =>
  new Promise((resolve, reject) => {
    let frame = 0
    let ignoredButtons: number[] | null = null
    let ignoredAxes: number[] | null = null
    let pendingButton: number | null = null

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      window.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      reject(new Error('interrupted'))
    }

    const settle = (trigger: string) => {
      window.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      resolve(trigger)
    }

    const poll = () => {
      const pad = navigator.getGamepads?.().find((entry) => entry) ?? undefined
      const buttons = pressedButtons(pad)
      const axes = deflectedAxes(pad)
      if (ignoredButtons === null) ignoredButtons = buttons
      if (ignoredAxes === null) ignoredAxes = axes

      if (pendingButton !== null) {
        if (!buttons.includes(pendingButton)) {
          settle(buttonName(pendingButton))
          return
        }
      } else {
        const freshButton = findFresh(buttons, ignoredButtons)
        const freshAxis = findFresh(axes, ignoredAxes)
        if (freshButton !== undefined) {
          pendingButton = freshButton
        } else if (freshAxis !== undefined && pad) {
          settle(axisName(freshAxis, pad.axes[freshAxis]))
          return
        } else {
          ignoredButtons = ignoredButtons.filter((index) => buttons.includes(index))
          ignoredAxes = ignoredAxes.filter((index) => axes.includes(index))
        }
      }
      frame = requestAnimationFrame(poll)
    }

    window.addEventListener('keydown', onKeyDown)
    frame = requestAnimationFrame(poll)
    registerCancel(() => {
      window.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(frame)
      reject(new Error('cancelled'))
    })
  })

/**
 * Capture the next physical input for a device so it can be assigned to an
 * action. Keyboard resolves with the pressed key; gamepad resolves with its
 * mapped button/axis name. Input from the other device interrupts the capture.
 *
 * @returns {{ listeningDevice: import('vue').Ref<ControlDevice | null>, capture: (device: ControlDevice) => Promise<string>, cancel: () => void }} Capture helpers
 */
export function useBindingCapture() {
  const listeningDevice = ref<ControlDevice | null>(null)
  let cancelActive: (() => void) | null = null

  const cancel = () => {
    cancelActive?.()
    cancelActive = null
    listeningDevice.value = null
  }

  const capture = async (device: ControlDevice): Promise<string> => {
    cancel()
    listeningDevice.value = device
    const registerCancel: RegisterCancel = (fn) => {
      cancelActive = fn
    }
    try {
      return device === 'gamepad'
        ? await captureGamepad(registerCancel)
        : await captureKeyboard(registerCancel)
    } finally {
      cancelActive = null
      listeningDevice.value = null
    }
  }

  return { listeningDevice, capture, cancel }
}
