import { ref, onMounted, onUnmounted } from 'vue'

const DEFAULT_DEADZONE = 0.15

/**
 * Track the first connected gamepad's left stick as a normalized -1..1 vector,
 * polled each animation frame. Used to drive the faux-pad preview visually.
 *
 * @param {number} deadzone Minimum absolute axis value before it registers
 * @returns {{ position: import('vue').Ref<{ x: number; y: number }> }} Reactive stick position
 */
export function useGamepadStick(deadzone: number = DEFAULT_DEADZONE) {
  const position = ref({ x: 0, y: 0 })
  let frame = 0

  const applyDeadzone = (value: number): number => (Math.abs(value) > deadzone ? value : 0)

  const poll = () => {
    const pad = navigator.getGamepads?.().find((entry) => entry)
    position.value = {
      x: applyDeadzone(pad?.axes[0] ?? 0),
      y: applyDeadzone(pad?.axes[1] ?? 0)
    }
    frame = requestAnimationFrame(poll)
  }

  onMounted(() => {
    frame = requestAnimationFrame(poll)
  })

  onUnmounted(() => {
    cancelAnimationFrame(frame)
  })

  return { position }
}
