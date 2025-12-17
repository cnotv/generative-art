export const handleJumpGoomba = (uiStore: any) => {
  uiStore.controls.jump = true;

  // Reset jump control after a short delay to allow the jump to register
  setTimeout(() => {
    uiStore.controls.jump = false;
  }, 100);
};
