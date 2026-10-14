interface UiStore {
  controls: { jump: boolean }
}

/**
 * Presses jump for a moment, long enough for the game loop to see it.
 * @param uiStore The store holding the controls.
 */
export const handleJumpGoomba = (uiStore: UiStore) => {
  uiStore.controls.jump = true

  // Reset jump control after a short delay to allow the jump to register
  setTimeout(() => {
    uiStore.controls.jump = false
  }, 100)
}
