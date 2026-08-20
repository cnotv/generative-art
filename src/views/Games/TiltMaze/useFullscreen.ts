import { onMounted, onUnmounted, ref, type Ref } from 'vue'

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
}

const getFullscreenElement = (): Element | null => {
  const webkitDocument = document as WebkitFullscreenDocument
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null
}

/**
 * Enter and leave fullscreen on a target element.
 *
 * Safari only unprefixed the Fullscreen API in 16.4, and iPhone did not accept non-video
 * elements at all until iOS 17, so the `webkit` entry points stay as a fallback and an
 * unsupported browser degrades to windowed play rather than throwing.
 *
 * Entering requires transient activation — a real tap — and leaving can always be done by the
 * user through Esc or a system gesture, which is why state is read back from `fullscreenchange`
 * rather than assumed from the call that requested it.
 * @param target The element to show fullscreen
 * @returns Fullscreen state, support flag, and enter/exit/toggle actions
 */
export const useFullscreen = (
  target: Ref<HTMLElement | null>
): {
  isFullscreen: Ref<boolean>
  isFullscreenSupported: boolean
  enterFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
  toggleFullscreen: () => Promise<void>
} => {
  const isFullscreen = ref(false)
  const isFullscreenSupported =
    typeof document !== 'undefined' &&
    Boolean(
      document.fullscreenEnabled ||
      (document as WebkitFullscreenDocument).webkitExitFullscreen ||
      document.documentElement.requestFullscreen
    )

  const syncFullscreenState = (): void => {
    isFullscreen.value = Boolean(getFullscreenElement())
  }

  const enterFullscreen = async (): Promise<void> => {
    const element = target.value as WebkitFullscreenElement | null
    if (!element || getFullscreenElement()) return
    const request = element.requestFullscreen
      ? () => element.requestFullscreen({ navigationUI: 'hide' })
      : element.webkitRequestFullscreen
    if (!request) return
    await Promise.resolve(request.call(element)).catch(() => undefined)
    syncFullscreenState()
  }

  const exitFullscreen = async (): Promise<void> => {
    if (!getFullscreenElement()) return
    const webkitDocument = document as WebkitFullscreenDocument
    const exit = document.exitFullscreen ?? webkitDocument.webkitExitFullscreen
    if (!exit) return
    await Promise.resolve(exit.call(document)).catch(() => undefined)
    syncFullscreenState()
  }

  const toggleFullscreen = async (): Promise<void> =>
    isFullscreen.value ? exitFullscreen() : enterFullscreen()

  onMounted(() => {
    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', syncFullscreenState)
    document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
  })

  return { isFullscreen, isFullscreenSupported, enterFullscreen, exitFullscreen, toggleFullscreen }
}
