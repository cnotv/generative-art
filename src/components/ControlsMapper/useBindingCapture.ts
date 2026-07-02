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

/**
 * Capture the next physical input for a device so it can be assigned to an
 * action. Keyboard resolves with the pressed key; gamepad polls until a button
 * is pressed and resolves with its mapped name. This is UI event wiring; the
 * resulting binding is applied through the package/store.
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

  const captureKeyboard = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const onKeyDown = (event: KeyboardEvent) => {
        event.preventDefault()
        window.removeEventListener('keydown', onKeyDown)
        resolve(event.key)
      }
      window.addEventListener('keydown', onKeyDown)
      cancelActive = () => {
        window.removeEventListener('keydown', onKeyDown)
        reject(new Error('cancelled'))
      }
    })

  const captureGamepad = (): Promise<string> =>
    new Promise((resolve, reject) => {
      let frame = 0
      // Inputs already active when capture starts (e.g. the button that
      // activated "Listen", or a stick already deflected) are ignored until
      // they return to rest, so only a fresh input is captured.
      let ignoredButtons: number[] | null = null
      let ignoredAxes: number[] | null = null
      // A freshly pressed button is bound on release so the confirm button can
      // be assigned without immediately re-triggering navigation.
      let pendingButton: number | null = null

      const poll = () => {
        const pad = navigator.getGamepads?.().find((entry) => entry) ?? undefined
        const buttons = pressedButtons(pad)
        const axes = deflectedAxes(pad)
        if (ignoredButtons === null) ignoredButtons = buttons
        if (ignoredAxes === null) ignoredAxes = axes

        if (pendingButton !== null) {
          if (!buttons.includes(pendingButton)) {
            resolve(buttonName(pendingButton))
            return
          }
        } else {
          const freshButton = buttons.find((index) => !ignoredButtons!.includes(index))
          const freshAxis = axes.find((index) => !ignoredAxes!.includes(index))
          if (freshButton !== undefined) {
            pendingButton = freshButton
          } else if (freshAxis !== undefined && pad) {
            resolve(axisName(freshAxis, pad.axes[freshAxis]))
            return
          } else {
            ignoredButtons = ignoredButtons.filter((index) => buttons.includes(index))
            ignoredAxes = ignoredAxes.filter((index) => axes.includes(index))
          }
        }
        frame = requestAnimationFrame(poll)
      }
      frame = requestAnimationFrame(poll)
      cancelActive = () => {
        cancelAnimationFrame(frame)
        reject(new Error('cancelled'))
      }
    })

  const capture = async (device: ControlDevice): Promise<string> => {
    cancel()
    listeningDevice.value = device
    try {
      const trigger = device === 'gamepad' ? await captureGamepad() : await captureKeyboard()
      return trigger
    } finally {
      cancelActive = null
      listeningDevice.value = null
    }
  }

  return { listeningDevice, capture, cancel }
}
