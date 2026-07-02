import { ref } from 'vue'
import { DEFAULT_BUTTON_MAP } from '@webgamekit/controls'
import type { ControlDevice } from '@webgamekit/controls'

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
      // Buttons already held when capture starts (e.g. the button used to
      // activate "Listen"). They are ignored until released so only a fresh
      // press is captured.
      let ignored: number[] | null = null
      const poll = () => {
        const pad = navigator.getGamepads?.().find((entry) => entry)
        const pressed = pad
          ? pad.buttons.map((button, index) => (button.pressed ? index : -1)).filter((i) => i >= 0)
          : []
        if (ignored === null) ignored = pressed
        const fresh = pressed.find((index) => !ignored!.includes(index))
        if (fresh !== undefined) {
          resolve(DEFAULT_BUTTON_MAP[fresh] ?? `button-${fresh}`)
          return
        }
        ignored = ignored.filter((index) => pressed.includes(index))
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
