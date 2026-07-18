import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useMenuNavigation, type MenuAction, type MenuSource } from './useMenuNavigation'
import { useHintRefreshTriggers, toHintRect, hintRectsEqual } from './useHintRefreshTriggers'

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
  anchor: Ref<HTMLElement | null>
  editing: Ref<HTMLElement | null>
  original: Ref<string | null>
}

const isTextInput = (element: Element | null): boolean =>
  element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)

const isNumberInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'number'

const isSelect = (element: Element | null): element is HTMLSelectElement =>
  element instanceof HTMLSelectElement

// While editing, the value only changes visually; it is applied on confirm so
// other state is not disturbed until the choice is committed.
const bumpNumberInput = (input: HTMLInputElement, direction: 1 | -1): void => {
  if (direction === 1) input.stepUp()
  else input.stepDown()
}

const cycleSelect = (select: HTMLSelectElement, direction: 1 | -1): void => {
  const next = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + direction))
  if (next === select.selectedIndex) return
  select.value = select.options[next].value
}

const commitEdit = (element: HTMLInputElement | HTMLSelectElement): void => {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

const revertEdit = (state: FocusState): void => {
  const element = state.editing.value
  if (
    (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
    state.original.value !== null
  ) {
    element.value = state.original.value
  }
  state.editing.value = null
  state.original.value = null
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
  state.anchor.value = element
  if (!element) {
    state.hint.value = null
    return
  }
  state.hint.value = {
    rect: toHintRect(element.getBoundingClientRect()),
    label: describeControl(element, state.editing.value === element)
  }
}

// The hint chip is position: fixed, so its captured rect goes stale whenever
// layout shifts under it (images loading, rows wrapping, scrolling).
const refreshHintRect = (state: FocusState): void => {
  const anchor = state.anchor.value
  const hint = state.hint.value
  if (!anchor || !hint) return
  if (!anchor.isConnected) {
    updateHint(state, null)
    return
  }
  const rect = toHintRect(anchor.getBoundingClientRect())
  if (hintRectsEqual(rect, hint.rect)) return
  state.hint.value = { ...hint, rect }
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

const editNumber = (input: HTMLInputElement, action: MenuAction): boolean => {
  if (action === 'up' || action === 'right') {
    bumpNumberInput(input, 1)
    return true
  }
  if (action === 'down' || action === 'left') {
    bumpNumberInput(input, -1)
    return true
  }
  return false
}

const editSelect = (select: HTMLSelectElement, action: MenuAction): boolean => {
  if (action === 'up' || action === 'left') {
    cycleSelect(select, -1)
    return true
  }
  if (action === 'down' || action === 'right') {
    cycleSelect(select, 1)
    return true
  }
  return false
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
      state.original.value = element.value
      updateHint(state, element)
    } else {
      commitEdit(element)
      state.original.value = null
      moveRow(state, 1, rowCount)
    }
    return true
  }
  if (state.editing.value !== element) return false
  return isNumberInput(element) ? editNumber(element, action) : editSelect(element, action)
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

const runMenuAction = (state: FocusState, action: MenuAction, isPaused: () => boolean): void => {
  if (isPaused()) return
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
    cancel: () => {
      if (state.editing.value) revertEdit(state)
      else (active as HTMLElement | null)?.blur?.()
    }
  }
  handlers[action]()
}

/**
 * Roving keyboard/gamepad focus over a panel of `[data-lui-row]` rows. Up/down
 * move between rows, left/right between focusable controls in a row, activate
 * clicks buttons and edits number/select inputs, cancel blurs.
 *
 * @param {Ref<HTMLElement | null>} panel The panel element containing the rows
 * @param {() => boolean} [isPaused] When it returns true, navigation is ignored (e.g. while capturing a key binding)
 * @param {Parameters<typeof useMenuNavigation>[1]} [mapping] Optional input mapping override passed to useMenuNavigation
 * @param {Parameters<typeof useMenuNavigation>[2]} [options] Options forwarded to useMenuNavigation (e.g. `modal: true` for dialogs)
 * @returns {{ focusedHint: Ref<FocusHint | null>, inputSource: Ref<MenuFocusSource | null>, focusFirst: () => void }} Focus state and control
 */
export function useMenuFocus(
  panel: Ref<HTMLElement | null>,
  isPaused: () => boolean = () => false,
  mapping?: Parameters<typeof useMenuNavigation>[1],
  options?: Parameters<typeof useMenuNavigation>[2]
) {
  const state: FocusState = {
    panel,
    row: ref(0),
    col: ref(0),
    hint: ref<FocusHint | null>(null),
    anchor: ref<HTMLElement | null>(null),
    editing: ref<HTMLElement | null>(null),
    original: ref<string | null>(null)
  }
  const inputSource = ref<MenuFocusSource | null>(null)

  useHintRefreshTriggers(() => refreshHintRect(state))

  const onMouseActivity = (): void => {
    inputSource.value = 'mouse'
  }
  const clearHint = (): void => {
    if (state.editing.value) revertEdit(state)
    state.hint.value = null
    state.anchor.value = null
    state.editing.value = null
  }
  // Hide the hint whenever focus leaves the panel (e.g. cancelling with the
  // joypad blurs the option), not only when the whole window loses focus.
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget
    if (!(next instanceof HTMLElement) || !panel.value?.contains(next)) clearHint()
  }

  onMounted(() => {
    window.addEventListener('mousedown', onMouseActivity)
    window.addEventListener('mousemove', onMouseActivity, { passive: true })
    window.addEventListener('blur', clearHint)
    window.addEventListener('focusout', onFocusOut)
  })
  onUnmounted(() => {
    window.removeEventListener('mousedown', onMouseActivity)
    window.removeEventListener('mousemove', onMouseActivity)
    window.removeEventListener('blur', clearHint)
    window.removeEventListener('focusout', onFocusOut)
  })

  useMenuNavigation(
    (action, source) => {
      inputSource.value = source
      runMenuAction(state, action, isPaused)
    },
    mapping,
    options
  )

  const focusFirst = (): void => {
    state.row.value = 0
    state.col.value = 0
    applyFocus(state)
  }

  return { focusedHint: state.hint, inputSource, focusFirst }
}
