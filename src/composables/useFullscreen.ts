import { getCurrentScope, onScopeDispose, ref } from 'vue'

const pageElement = (): HTMLElement => document.documentElement

/**
 * Toggles fullscreen on one element, the whole page by default so overlays stay on top.
 * The state follows the browser, which also leaves fullscreen on Escape.
 * @param getTarget - the element to show fullscreen; the page when omitted
 * @returns whether fullscreen is available, whether the target is fullscreen, and a toggle
 */
export const useFullscreen = (getTarget: () => HTMLElement | null = pageElement) => {
  // iPhone Safari has no Fullscreen API for pages; the button hides itself there.
  const isSupported = ref(document.fullscreenEnabled === true)

  const isTargetFullscreen = (): boolean => {
    const target = getTarget()
    return target !== null && document.fullscreenElement === target
  }

  const isFullscreen = ref(isTargetFullscreen())

  const syncState = (): void => {
    isFullscreen.value = isTargetFullscreen()
  }

  document.addEventListener('fullscreenchange', syncState)
  if (getCurrentScope()) {
    onScopeDispose(() => document.removeEventListener('fullscreenchange', syncState))
  }

  const toggleFullscreen = async (): Promise<void> => {
    const target = getTarget()
    if (!isSupported.value || target === null) return
    await (isTargetFullscreen() ? document.exitFullscreen() : target.requestFullscreen())
  }

  return { isSupported, isFullscreen, toggleFullscreen }
}
