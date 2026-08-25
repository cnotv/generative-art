import { ref, type Ref } from 'vue'
import * as THREE from 'three'
import { lightPresets, updateLights, blendLightPresets } from '@webgamekit/threejs'
import type { LightPreset, LightRig } from '@webgamekit/threejs'

/** The order the player walks, looping back from night to dawn. */
const LIGHT_PRESET_CYCLE: LightPreset[] = ['dawn', 'noon', 'dusk', 'night']

/** Seconds for one full day at speed 1, slow enough to read as a passing day. */
const CYCLE_SECONDS = 60

/** Scenes open on a moving sky, at a speed that shows a whole day without waiting a minute. */
export const DEFAULT_SPEED = 4

/** Wrap into [0, length), which `%` alone does not do for negative values. */
const wrapPhase = (value: number, length: number): number => ((value % length) + length) % length

interface LightTransitionOptions {
  threeScene: Ref<THREE.Scene | null>
  onStart: () => void
  onStop: (rig: LightRig) => void
}

/**
 * Drive the light rig continuously through the day cycle, blending between the presets.
 * Runs on its own animation frame rather than the scene timeline, so it keeps playing
 * while the scene is paused and stops with the view.
 * @param options.threeScene - The scene to light
 * @param options.onStart - Called when playback begins, to clear any active preset
 * @param options.onStop - Called with the rig playback settled on, to mirror into the panel
 * @returns The player state and its controls
 */
export const createLightTransitionPlayer = ({
  threeScene,
  onStart,
  onStop
}: LightTransitionOptions) => {
  const enabled = ref(false)
  const speed = ref(DEFAULT_SPEED)
  let frameId = 0
  let phase = 0
  let lastTime = 0

  const currentRig = (): LightRig => {
    const fromIndex = Math.floor(phase) % LIGHT_PRESET_CYCLE.length
    const toIndex = (fromIndex + 1) % LIGHT_PRESET_CYCLE.length
    return blendLightPresets(
      lightPresets[LIGHT_PRESET_CYCLE[fromIndex]],
      lightPresets[LIGHT_PRESET_CYCLE[toIndex]],
      phase - Math.floor(phase)
    )
  }

  const tick = (now: number) => {
    const scene = threeScene.value
    if (!scene) return
    // The first frame's timestamp can precede the clock read taken when playback started,
    // which would otherwise step the phase backwards past the first preset.
    const deltaSeconds = Math.max(0, (now - lastTime) / 1000)
    lastTime = now
    phase = wrapPhase(
      phase + (deltaSeconds * LIGHT_PRESET_CYCLE.length * speed.value) / CYCLE_SECONDS,
      LIGHT_PRESET_CYCLE.length
    )
    updateLights(scene, currentRig())
    frameId = requestAnimationFrame(tick)
  }

  const setEnabled = (next: boolean) => {
    if (next === enabled.value) return
    enabled.value = next
    if (next) {
      onStart()
      lastTime = performance.now()
      frameId = requestAnimationFrame(tick)
      return
    }
    cancelAnimationFrame(frameId)
    onStop(currentRig())
  }

  const stop = () => {
    cancelAnimationFrame(frameId)
    enabled.value = false
    phase = 0
  }

  return {
    enabled,
    speed,
    setEnabled,
    setSpeed: (next: number) => {
      speed.value = next
    },
    stop
  }
}
