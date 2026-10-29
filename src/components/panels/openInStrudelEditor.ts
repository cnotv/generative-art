import { STRUDEL_SAVED_CODE_STORAGE_KEY } from '@/views/Tools/StrudelEditor/config'
import { writeStorage } from '@/utils/storage'

/**
 * Opens the full Strudel Editor on a sound's code. The editor opens on whatever code it saved
 * last, so the sound's code is saved first. It opens in a new tab, which leaves the game, and
 * the edits not yet applied, where they are.
 * @param code The Strudel code to open.
 * @param editorUrl Where the Strudel Editor lives.
 */
export const openInStrudelEditor = (code: string, editorUrl: string): void => {
  writeStorage(STRUDEL_SAVED_CODE_STORAGE_KEY, code)
  window.open(editorUrl, '_blank')
}
