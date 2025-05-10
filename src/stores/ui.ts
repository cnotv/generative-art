import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    keyState: {} as Record<string, boolean>,
    gamepad: {
      input: null as Gamepad | null,
      buttons: {} as Record<string, GamepadButton>
    },
    controls: {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false
    } as Record<string, boolean>,
    isConfigOpen: false,
    isTouchDevice: false
  }),

  actions: {
    toggleConfig(state?: boolean) {
      this.isConfigOpen = state ?? !this.isConfigOpen
    },
    setKeyState(key: string, state: boolean) {
      this.keyState[key] = state
      switch (key) {
        case 'ArrowLeft':
        case 'a':
          this.controls.left = state
          break
        case 'ArrowRight':
        case 'd':
          this.controls.right = state
          break
        case 'ArrowUp':
        case 'w':
          this.controls.up = state
          break
        case 'ArrowDown':
        case 's':
          this.controls.down = state
          break
        case ' ':
          this.controls.jump = state
          break
      }
    },
    setGamePad(input: Gamepad | null) {
      this.gamepad.input = input
    },
    setGamePadButtons(buttons: Record<string, GamepadButton>) {
      this.gamepad.buttons = buttons

      this.controls.left = this.gamepad.buttons.left?.pressed || false
      this.controls.right = this.gamepad.buttons.right?.pressed || false
      this.controls.up = this.gamepad.buttons.up?.pressed || false
      this.controls.down = this.gamepad.buttons.down?.pressed || false
      this.controls.jump = this.gamepad.buttons.a?.pressed || false
    }
  }
})
