import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useMenuNavigation, type MenuAction, type MenuSource } from './useMenuNavigation'

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'email', 'password', 'search', 'tel', 'url'])
const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'

export interface HintRect {
  top: number
  left: number
  width: number
  height: number
}

export interface FocusHint {
  rect: HintRect
  label: string
}

export type MenuFocusSource = MenuSource | 'mouse'

interface FocusState {
  panel: Ref<HTMLElement | null>
  row: Ref<number>
  col: Ref<number>
  hint: Ref<FocusHint | null>
  editing: Ref<HTMLElement | null>
}

const isTextInput = (element: Element | null): boolean =>
  element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)

const isNumberInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'number'

const isSelect = (element: Element | null): element is HTMLSelectElement =>
  element instanceof HTMLSelectElement

const bumpNumberInput = (input: HTMLInputElement, direction: 1 | -1): void => {
  if (direction === 1) input.stepUp()
  else input.stepDown()
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const cycleSelect = (select: HTMLSelectElement, direction: 1 | -1): void => {
  const next = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + direction))
  if (next === select.selectedIndex) return
  select.value = select.options[next].value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

const describeControl = (element: HTMLElement, editing: boolean): string => {
  if (isNumberInput(element) || isSelect(element)) return editing ? 'Confirm' : 'Change'
  if (element instanceof HTMLInputElement && element.type === 'checkbox') return 'Toggle'
  if (isTextInput(element)) return 'Edit'
  return 'Select'
}

const queryRows = (panel: HTMLElement | null): HTMLElement[] => {
  if (!panel) return []
  return [...panel.querySelectorAll<HTMLElement>('[data-lui-row]')].filter(
    (row) => row.querySelectorAll(FOCUSABLE_SELECTOR).length > 0
  )
}

const queryFocusables = (row: HTMLElement): HTMLElement[] => [
  ...row.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
]

const updateHint = (state: FocusState, element: HTMLElement | null): void => {
  if (!element) {
    state.hint.value = null
    return
  }
  const rect = element.getBoundingClientRect()
  state.hint.value = {
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    label: describeControl(element, state.editing.value === element)
  }
}

const applyFocus = (state: FocusState): void => {
  const rows = queryRows(state.panel.value)
  const row = rows[state.row.value]
  if (!row) {
    updateHint(state, null)
    return
  }
  const focusables = queryFocusables(row)
  const target = focusables[Math.min(state.col.value, focusables.length - 1)]
  target?.focus()
  updateHint(state, target ?? null)
}

const moveRow = (state: FocusState, delta: number, rowCount: number): void => {
  state.editing.value = null
  state.row.value = Math.min(Math.max(state.row.value + delta, 0), rowCount - 1)
  state.col.value = 0
  applyFocus(state)
}

const moveCol = (state: FocusState, delta: number, row: HTMLElement | undefined): void => {
  if (!row) return
  const focusables = queryFocusables(row)
  state.col.value = Math.min(Math.max(state.col.value + delta, 0), focusables.length - 1)
  applyFocus(state)
}

const handleEditable = (
  state: FocusState,
  element: HTMLInputElement | HTMLSelectElement,
  action: MenuAction,
  rowCount: number
): boolean => {
  if (action === 'activate') {
    if (state.editing.value !== element) {
      state.editing.value = element
      updateHint(state, element)
    } else {
      state.editing.value = null
      moveRow(state, 1, rowCount)
    }
    return true
  }
  if ((action === 'up' || action === 'down') && state.editing.value === element) {
    if (isNumberInput(element)) bumpNumberInput(element, action === 'up' ? 1 : -1)
    else cycleSelect(element, action === 'down' ? 1 : -1)
    return true
  }
  return false
}

const handleControlAction = (
  state: FocusState,
  active: Element | null,
  action: MenuAction,
  rowCount: number
): boolean => {
  if (isTextInput(active) && (action === 'left' || action === 'right')) return true
  if (isNumberInput(active) || isSelect(active))
    return handleEditable(state, active, action, rowCount)
  return false
}

const runMenuAction = (state: FocusState, action: MenuAction): void => {
  const active = document.activeElement
  const rows = queryRows(state.panel.value)
  if (!rows.length || handleControlAction(state, active, action, rows.length)) return

  const handlers: Record<MenuAction, () => void> = {
    up: () => moveRow(state, -1, rows.length),
    down: () => moveRow(state, 1, rows.length),
    left: () => moveCol(state, -1, rows[state.row.value]),
    right: () => moveCol(state, 1, rows[state.row.value]),
    activate: () => {
      if (!isTextInput(active) && active instanceof HTMLElement) active.click()
    },
    decrease: () => undefined,
    cancel: () => (active as HTMLElement | null)?.blur?.()
  }
  handlers[action]()
}

/**
 * Roving keyboard/gamepad focus over a panel of `[data-lui-row]` rows. Up/down
 * move between rows, left/right between focusable controls in a row, activate
 * clicks buttons and edits number/select inputs, cancel blurs.
 *
 * @param {Ref<HTMLElement | null>} panel The panel element containing the rows
 * @returns {{ focusedHint: Ref<FocusHint | null>, inputSource: Ref<MenuFocusSource | null>, focusFirst: () => void }} Focus state and control
 */
export function useMenuFocus(panel: Ref<HTMLElement | null>) {
  const state: FocusState = {
    panel,
    row: ref(0),
    col: ref(0),
    hint: ref<FocusHint | null>(null),
    editing: ref<HTMLElement | null>(null)
  }
  const inputSource = ref<MenuFocusSource | null>(null)

  const onMouseActivity = (): void => {
    inputSource.value = 'mouse'
  }
  const onBlur = (): void => {
    state.hint.value = null
    state.editing.value = null
  }

  onMounted(() => {
    window.addEventListener('mousedown', onMouseActivity)
    window.addEventListener('mousemove', onMouseActivity, { passive: true })
    window.addEventListener('blur', onBlur)
  })
  onUnmounted(() => {
    window.removeEventListener('mousedown', onMouseActivity)
    window.removeEventListener('mousemove', onMouseActivity)
    window.removeEventListener('blur', onBlur)
  })

  useMenuNavigation((action, source) => {
    inputSource.value = source
    runMenuAction(state, action)
  })

  const focusFirst = (): void => {
    state.row.value = 0
    state.col.value = 0
    applyFocus(state)
  }

  return { focusedHint: state.hint, inputSource, focusFirst }
}
