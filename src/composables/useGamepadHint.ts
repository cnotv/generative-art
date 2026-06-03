import { ref, onMounted, onUnmounted } from 'vue'
import type { MenuSource } from './useMenuNavigation'

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

  const updateFocusedHint = (element: HTMLElement | null): void => {
    if (!element) {
      focusedHint.value = null
      return
    }
    const r = element.getBoundingClientRect()
    focusedHint.value = {
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      parts: describeControl(element)
    }
  }

  const onInputSource = (source: MenuSource): void => {
    inputSource.value = source
  }

  const onMouseActivity = (): void => {
    inputSource.value = 'mouse'
  }

  const onWindowBlur = (): void => {
    focusedHint.value = null
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
