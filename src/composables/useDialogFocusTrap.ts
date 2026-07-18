import { onMounted, onUnmounted, type Ref } from 'vue'
import { useMenuFocus } from './useMenuFocus'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'

/**
 * Traps all focus inside an open LobbyUI dialog: marks a modal navigation
 * scope (muting every non-modal menu handler behind the dialog), drives
 * stick/d-pad/arrow focus over the dialog's `[data-lui-row]` rows, and cycles
 * Tab / Shift-Tab within the dialog's focusable controls.
 *
 * @param dialog The dialog root element containing the `[data-lui-row]` rows
 * @returns Focus hint state for `LobbyUIFocusHint`, input source and `focusFirst`
 */
export const useDialogFocusTrap = (dialog: Ref<HTMLElement | null>) => {
  const menuFocus = useMenuFocus(dialog, () => false, undefined, { modal: true })

  const trapTab = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !dialog.value) return
    const focusables = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    if (!focusables.length) return
    event.preventDefault()
    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement)
    const step = event.shiftKey ? -1 : 1
    const nextIndex = (currentIndex + step + focusables.length) % focusables.length
    focusables[nextIndex]?.focus()
  }

  onMounted(() => window.addEventListener('keydown', trapTab))
  onUnmounted(() => window.removeEventListener('keydown', trapTab))

  return menuFocus
}
