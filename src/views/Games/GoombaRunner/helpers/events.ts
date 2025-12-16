export const handleJumpGoomba = (uiStore: any) => {
  uiStore.controls.jump = true;
  console.log("Jump action triggered");

  // Reset jump control after a short delay to allow the jump to register
  setTimeout(() => {
    uiStore.controls.jump = false;
  }, 100);
};
