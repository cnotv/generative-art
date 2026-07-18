import { onMounted, onUnmounted, ref } from 'vue'
import { createControls } from '@webgamekit/controls'
import type { ControlsExtras, ControlMapping } from '@webgamekit/controls'
import { reportInputSource } from './useInputDevice'

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'activate' | 'cancel' | 'decrease'

const MENU_ACTIONS = new Set<MenuAction>([
  'up',
  'down',
  'left',
  'right',
  'activate',
  'cancel',
  'decrease'
])

const MENU_MAPPING = {
  keyboard: {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Enter: 'activate',
    Escape: 'cancel'
  },
  gamepad: {
    'dpad-up': 'up',
    'dpad-down': 'down',
    'dpad-left': 'left',
    'dpad-right': 'right',
    'axis1-up': 'up',
    'axis1-down': 'down',
    'axis0-left': 'left',
    'axis0-right': 'right',
    'axis3-up': 'up',
    'axis3-down': 'down',
    'axis2-left': 'left',
    'axis2-right': 'right',
    // South face button (PS cross / Xbox A / Switch B) = activate; on number input → increase.
    cross: 'activate',
    a: 'activate',
    // West face button (PS square / Xbox X / Switch Y) = decrease on number input.
    square: 'decrease',
    x: 'decrease',
    y: 'decrease',
    // East face button = cancel.
    circle: 'cancel',
    b: 'cancel'
  }
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const TEXT_INPUT_TYPES = new Set(['text', 'number', 'email', 'password', 'search', 'tel', 'url'])
// Keys that would otherwise open the native <select> picker. Blocked when the
// active element is a <select> so the kit can run its own focus-trap behavior
// without the OS dropdown popping up on top.
const SELECT_OPEN_KEYS = new Set(['Enter', ' ', 'Spacebar', 'F4'])

const shouldPreventDefault = (event: KeyboardEvent): boolean => {
  const active = document.activeElement
  if (active instanceof HTMLSelectElement && SELECT_OPEN_KEYS.has(event.key)) return true
  if (!SCROLL_KEYS.has(event.key)) return false
  if (active instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(active.type)) return false
  if (active instanceof HTMLTextAreaElement) return false
  return true
}

const preventScrollKeys = (event: KeyboardEvent): void => {
  if (shouldPreventDefault(event)) event.preventDefault()
}

const announceGamepad = (event: GamepadEvent): void => {
  console.warn(
    '[useMenuNavigation] gamepad connected:',
    event.gamepad.id,
    `(index ${event.gamepad.index}, ${event.gamepad.buttons.length} buttons, ${event.gamepad.axes.length} axes)`
  )
}

export type MenuSource = 'keyboard' | 'gamepad'

const sourceOf = (rawSource: string | undefined): MenuSource =>
  rawSource === 'gamepad' || rawSource === 'gamepad-axis' ? 'gamepad' : 'keyboard'

// Depth of currently open modal dialogs. While any modal scope is active,
// every non-modal menu handler is muted, so input reaches only the dialog.
// Singleton by design: modality is a property of the whole page.
const modalScopeDepth = ref(0)

// Every handler polls the gamepad on its own interval, so the press that
// closed a dialog can still be seen as a fresh edge by a background poller a
// few milliseconds after the modal scope ends. Background handlers therefore
// stay muted for a short grace period after the last modal closes.
const MODAL_RELEASE_GRACE_MS = 250
const modalReleasedAt = ref(0)

const isModalScopeActive = (): boolean =>
  modalScopeDepth.value > 0 || Date.now() - modalReleasedAt.value < MODAL_RELEASE_GRACE_MS

export type MenuNavigationOptions = {
  modal?: boolean
}

/**
 * Registers a callback for menu-style navigation events emitted by either the
 * keyboard arrow cluster or a connected gamepad's d-pad / left stick / A / B.
 * Filters out unmapped inputs so the handler only ever sees known MenuActions.
 * @param handler Called with the semantic action and its originating input source.
 * @param mapping Optional input mapping override; defaults to the full menu mapping (d-pad, both sticks, face buttons).
 * @param options Set `modal: true` for dialog handlers: they keep receiving input and mute every non-modal handler while mounted.
 * @returns Object with `destroy()` for manual teardown; the composable also cleans up on unmount.
 */
export function useMenuNavigation(
  handler: (action: MenuAction, source: MenuSource) => void,
  mapping: ControlMapping = MENU_MAPPING,
  options: MenuNavigationOptions = {}
): {
  destroy: () => void
} {
  let controls: ControlsExtras | null = null

  const setup = (): void => {
    if (options.modal) modalScopeDepth.value += 1
    controls = createControls({
      mapping,
      onAction: (action, _key, rawSource) => {
        reportInputSource(String(rawSource ?? 'keyboard'))
        if (!options.modal && isModalScopeActive()) return
        if (MENU_ACTIONS.has(action as MenuAction)) {
          handler(action as MenuAction, sourceOf(rawSource as string | undefined))
        }
      }
    })
    window.addEventListener('keydown', preventScrollKeys)
    window.addEventListener('gamepadconnected', announceGamepad)
  }

  const destroy = (): void => {
    if (options.modal) {
      modalScopeDepth.value = Math.max(0, modalScopeDepth.value - 1)
      if (modalScopeDepth.value === 0) modalReleasedAt.value = Date.now()
    }
    controls?.destroyControls()
    controls = null
    window.removeEventListener('keydown', preventScrollKeys)
    window.removeEventListener('gamepadconnected', announceGamepad)
  }

  onMounted(setup)
  onUnmounted(destroy)

  return { destroy }
}
