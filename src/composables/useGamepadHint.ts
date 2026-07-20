import { ref, onMounted, onUnmounted } from 'vue'
import type { MenuSource } from './useMenuNavigation'
import { useHintRefreshTriggers, toHintRect, hintRectsEqual } from './useHintRefreshTriggers'

export type HintPart = { glyph: string; label: string }

export type HintState = {
  rect: { top: number; left: number; width: number; height: number }
  parts: HintPart[]
} | null

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'email', 'password', 'search', 'tel', 'url'])

const isNumberInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'number'

const isSelectElement = (element: Element | null): element is HTMLSelectElement =>
  element instanceof HTMLSelectElement

/**
 * Composable that tracks which element has gamepad focus and returns a
 * positioned hint chip describing the active button affordance. Only
 * renders when the most recent input was a gamepad press.
 *
 * @param editingElement Reactive ref to the element currently in "edit mode"
 * (cycling via Up/Down). Pass `null` when not tracking edit mode.
 * @returns focusedHint, inputSource, updateFocusedHint, onInputSource
 */
export const useGamepadHint = (editingElement: { value: HTMLElement | null }) => {
  const focusedHint = ref<HintState>(null)
  const inputSource = ref<MenuSource | 'mouse' | null>(null)
  const anchorElement = ref<HTMLElement | null>(null)

  const describeControl = (element: HTMLElement): HintPart[] => {
    const isCyclable = isNumberInput(element) || isSelectElement(element)
    if (isCyclable) {
      return editingElement.value === element
        ? [{ glyph: '✕', label: 'Confirm' }]
        : [{ glyph: '↕', label: 'Change' }]
    }
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox') return [{ glyph: '✕', label: 'Toggle' }]
      if (TEXT_INPUT_TYPES.has(element.type)) return [{ glyph: '✕', label: 'Edit' }]
    }
    return [{ glyph: '✕', label: 'Confirm' }]
  }

  const getHintAnchor = (element: HTMLElement): HTMLElement => {
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      return element.closest('label') ?? element
    }
    return element
  }

  const updateFocusedHint = (element: HTMLElement | null): void => {
    const anchor = element ? getHintAnchor(element) : null
    anchorElement.value = anchor
    if (!element || !anchor) {
      focusedHint.value = null
      return
    }
    focusedHint.value = {
      rect: toHintRect(anchor.getBoundingClientRect()),
      parts: describeControl(element)
    }
  }

  // The hint chip is position: fixed; re-anchor it when layout shifts.
  const refreshHintRect = (): void => {
    const anchor = anchorElement.value
    const hint = focusedHint.value
    if (!anchor || !hint) return
    if (!anchor.isConnected) {
      updateFocusedHint(null)
      return
    }
    const rect = toHintRect(anchor.getBoundingClientRect())
    if (hintRectsEqual(rect, hint.rect)) return
    focusedHint.value = { ...hint, rect }
  }

  useHintRefreshTriggers(refreshHintRect)

  const onInputSource = (source: MenuSource): void => {
    inputSource.value = source
  }

  const onMouseActivity = (): void => {
    inputSource.value = 'mouse'
  }

  const onWindowBlur = (): void => {
    focusedHint.value = null
    anchorElement.value = null
    editingElement.value = null
  }

  onMounted(() => {
    window.addEventListener('mousemove', onMouseActivity, { passive: true })
    window.addEventListener('mousedown', onMouseActivity)
    window.addEventListener('blur', onWindowBlur)
  })

  onUnmounted(() => {
    window.removeEventListener('mousemove', onMouseActivity)
    window.removeEventListener('mousedown', onMouseActivity)
    window.removeEventListener('blur', onWindowBlur)
  })

  return { focusedHint, inputSource, updateFocusedHint, onInputSource }
}
