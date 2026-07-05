import { ref, type Ref } from 'vue'
import { useMenuNavigation, type MenuAction } from '@/composables/useMenuNavigation'
import { useGamepadHint } from '@/composables/useGamepadHint'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'
const TEXT_INPUT_TYPES = new Set(['text', 'number', 'email', 'password'])

interface WizardFocusState {
  root: Ref<HTMLElement | null>
  row: Ref<number>
  col: Ref<number>
  editing: Ref<HTMLElement | null>
  updateFocusedHint: (element: HTMLElement | null) => void
}

const isTextInput = (element: Element | null): boolean =>
  element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)

const isNumberInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === 'number'

const isSelectElement = (element: Element | null): element is HTMLSelectElement =>
  element instanceof HTMLSelectElement

const queryRows = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>('[data-lui-row]')].filter(
    (row) => row.querySelectorAll(FOCUSABLE_SELECTOR).length > 0
  )
}

const queryFocusables = (row: HTMLElement): HTMLElement[] => [
  ...row.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
]

const applyFocus = (state: WizardFocusState): void => {
  const rows = queryRows(state.root.value)
  const row = rows[state.row.value]
  if (!row) return
  const items = queryFocusables(row)
  const target = items[Math.min(state.col.value, items.length - 1)]
  target?.focus()
  state.updateFocusedHint(target ?? null)
}

const jumpToAutofocus = (state: WizardFocusState): void => {
  if (!state.root.value) return
  const autofocused = state.root.value.querySelector<HTMLElement>('[autofocus]')
  if (!autofocused) return
  const rows = queryRows(state.root.value)
  const rowIndex = rows.findIndex((row) => row.contains(autofocused))
  if (rowIndex === -1) return
  state.row.value = rowIndex
  const items = queryFocusables(rows[rowIndex])
  state.col.value = items.indexOf(autofocused)
  autofocused.focus()
}

const commitControl = (element: HTMLElement): void => {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

const bumpControl = (element: HTMLElement, direction: 1 | -1): void => {
  if (isNumberInput(element)) {
    if (direction === 1) element.stepUp()
    else element.stepDown()
    commitControl(element)
  } else if (isSelectElement(element)) {
    const next = Math.max(
      0,
      Math.min(element.options.length - 1, element.selectedIndex + direction)
    )
    if (next !== element.selectedIndex) {
      element.value = element.options[next].value
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
}

const handleCyclableControl = (
  state: WizardFocusState,
  active: HTMLElement,
  action: MenuAction,
  rowCount: number
): boolean => {
  const isEditing = state.editing.value === active

  if (!isEditing) {
    if (action === 'activate') {
      state.editing.value = active
      state.updateFocusedHint(active)
      return true
    }
    return false
  }

  if (action === 'up' || action === 'down') {
    bumpControl(active, action === 'up' ? 1 : -1)
    return true
  }
  if (action === 'activate') {
    state.editing.value = null
    state.row.value = Math.min(rowCount - 1, state.row.value + 1)
    state.col.value = 0
    applyFocus(state)
    return true
  }
  return false
}

const handleRowNav = (
  state: WizardFocusState,
  action: MenuAction,
  rows: HTMLElement[],
  active: Element | null
): void => {
  const handlers: Partial<Record<MenuAction, () => void>> = {
    up: () => {
      state.editing.value = null
      state.row.value = Math.max(0, state.row.value - 1)
      state.col.value = 0
      applyFocus(state)
    },
    down: () => {
      state.editing.value = null
      state.row.value = Math.min(rows.length - 1, state.row.value + 1)
      state.col.value = 0
      applyFocus(state)
    },
    left: () => {
      if (!rows[state.row.value]) return
      state.col.value = Math.max(0, state.col.value - 1)
      applyFocus(state)
    },
    right: () => {
      const row = rows[state.row.value]
      if (!row) return
      state.col.value = Math.min(queryFocusables(row).length - 1, state.col.value + 1)
      applyFocus(state)
    },
    activate: () => {
      if (active instanceof HTMLElement && !isTextInput(active)) active.click()
    },
    cancel: () => (active as HTMLElement | null)?.blur?.()
  }
  handlers[action]?.()
}

const runWizardAction = (state: WizardFocusState, action: MenuAction): void => {
  const rows = queryRows(state.root.value)
  if (!rows.length) return
  const active = document.activeElement
  if (isTextInput(active) && (action === 'left' || action === 'right')) return
  if (
    active instanceof HTMLElement &&
    (isNumberInput(active) || isSelectElement(active)) &&
    handleCyclableControl(state, active, action, rows.length)
  )
    return
  handleRowNav(state, action, rows, active)
}

/**
 * Roving keyboard/gamepad focus for the lobby wizard: up/down move between
 * `[data-lui-row]` rows, left/right between controls in a row, activate clicks
 * buttons and edit-cycles number/select inputs (committing on each bump).
 * Renders gamepad hints via `useGamepadHint`.
 *
 * @param {Ref<HTMLElement | null>} root The wizard root element containing the rows
 * @param {() => boolean} isBlocked When it returns true, navigation input is ignored
 * @returns {{ focusedHint: Ref<import('@/composables/useGamepadHint').HintState>, inputSource: Ref<string | null>, jumpToAutofocus: () => void }} Hint state, input source and autofocus jump
 */
export const useLobbyWizardFocus = (root: Ref<HTMLElement | null>, isBlocked: () => boolean) => {
  const editing = ref<HTMLElement | null>(null)
  const { focusedHint, inputSource, updateFocusedHint, onInputSource } = useGamepadHint(editing)

  const state: WizardFocusState = {
    root,
    row: ref(0),
    col: ref(0),
    editing,
    updateFocusedHint
  }

  useMenuNavigation((action, source) => {
    if (isBlocked()) return
    onInputSource(source)
    runWizardAction(state, action)
  })

  return { focusedHint, inputSource, jumpToAutofocus: () => jumpToAutofocus(state) }
}
