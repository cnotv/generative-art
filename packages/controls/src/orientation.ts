/**
 * `lock` is absent from the DOM library TypeScript ships and absent at runtime on iOS, so both
 * halves of the pair are declared optional here rather than assumed present.
 */
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: ScreenOrientation['type']) => Promise<void>
  unlock?: () => void
}

const getScreenOrientation = (): LockableScreenOrientation | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window.screen?.orientation as LockableScreenOrientation | undefined)

/**
 * Pin the screen to one orientation, so a rotation cannot reshape a running scene.
 *
 * A game laid out for the screen it started on can only refit its framing when the screen
 * turns, because regenerating would discard the round in progress. Not turning is the better
 * answer where the platform allows it.
 *
 * Every platform may refuse: iOS Safari has never implemented the lock, and Android grants it
 * only to a fullscreen document — which is why the call is worth repeating once fullscreen has
 * been entered. A refusal resolves rather than rejecting, since the caller's fallback is the
 * layout it already performs on resize and there is nothing useful to do with the error.
 * @param orientation The orientation to hold; defaults to whichever is current
 * @returns Resolves once the platform has accepted or refused
 */
export const lockScreenOrientation = async (
  orientation?: ScreenOrientation['type']
): Promise<void> => {
  const screenOrientation = getScreenOrientation()
  if (!screenOrientation?.lock) return
  await screenOrientation.lock(orientation ?? screenOrientation.type).catch(() => undefined)
}

/**
 * Release the lock, so leaving a scene does not leave the rest of the page pinned to it.
 * @returns Nothing
 */
export const unlockScreenOrientation = (): void => {
  getScreenOrientation()?.unlock?.()
}
