/**
 * `lock` is absent from the DOM library TypeScript ships and absent at runtime on iOS, so it
 * is declared optional here rather than assumed present.
 */
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: ScreenOrientation['type']) => Promise<void>
}

/**
 * Pin the screen to the orientation play started in.
 *
 * The board is cut for the screen it was generated on. A rotation mid-run can only refit the
 * framing, because regenerating would throw away the run in progress, and a maze cut across a
 * portrait screen reads badly stretched over a landscape one.
 *
 * Every platform may refuse: iOS Safari has never implemented the lock at all, and Android
 * grants it only to a fullscreen document. A refusal is swallowed rather than surfaced, since
 * the fallback is the refit the game already does on resize.
 * @returns Resolves once the platform has accepted or refused the lock
 */
export const lockScreenOrientation = async (): Promise<void> => {
  const orientation = window.screen?.orientation as LockableScreenOrientation | undefined
  if (!orientation?.lock) return
  await orientation.lock(orientation.type).catch(() => undefined)
}

/**
 * Release the lock, so leaving the game does not leave the rest of the app pinned.
 * @returns Nothing
 */
export const unlockScreenOrientation = (): void => {
  window.screen?.orientation?.unlock?.()
}
