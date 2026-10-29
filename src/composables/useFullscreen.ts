import { getCurrentScope, onScopeDispose, ref } from 'vue'

const isDocumentFullscreen = (): boolean => document.fullscreenElement !== null

/**
 * Toggles fullscreen on the whole page, so overlays stay on top of the game.
 * The state follows the browser, which also leaves fullscreen on Escape.
 * @returns whether fullscreen is available, whether it is on, and a toggle
 */
export const useFullscreen = () => {
  // iPhone Safari has no Fullscreen API for pages; the button hides itself there.
  const isSupported = ref(document.fullscreenEnabled === true)
  const isFullscreen = ref(isDocumentFullscreen())

  const syncState = (): void => {
    isFullscreen.value = isDocumentFullscreen()
  }

  document.addEventListener('fullscreenchange', syncState)
  if (getCurrentScope()) {
    onScopeDispose(() => document.removeEventListener('fullscreenchange', syncState))
  }

  const toggleFullscreen = async (): Promise<void> => {
    if (!isSupported.value) return
    await (isDocumentFullscreen()
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen())
  }

  return { isSupported, isFullscreen, toggleFullscreen }
}
