interface UiStore {
  controls: { jump: boolean }
}

export const handleJumpGoomba = (uiStore: UiStore) => {
  uiStore.controls.jump = true

  // Reset jump control after a short delay to allow the jump to register
  setTimeout(() => {
    uiStore.controls.jump = false
  }, 100)
}
