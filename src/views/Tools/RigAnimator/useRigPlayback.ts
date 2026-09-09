import { ref, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import type { RigAnimatorConfig } from './types'

interface RigPlaybackDependencies {
  config: Ref<RigAnimatorConfig>
  mixer: ShallowRef<THREE.AnimationMixer | null>
  action: ShallowRef<THREE.AnimationAction | null>
}

/** Owns real-time playback of the preview clip built from the authored keyframes, split out
 * of `useRigKeyframes` to stay under its function-length lint cap. */
export const useRigPlayback = (deps: RigPlaybackDependencies) => {
  const isPlaying = ref(false)
  const clock = new THREE.Clock()

  /** Scrub the preview to a given frame without advancing playback. */
  const scrubToFrame = (frame: number): void => {
    if (deps.mixer.value) deps.mixer.value.setTime(frame / deps.config.value.fps)
  }

  /** Start or stop real-time playback of the preview clip. */
  const togglePlayback = (): void => {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) clock.start()
  }

  /** Advance playback by one frame tick; a no-op while paused or with nothing to play. */
  const tickPlayback = (): void => {
    if (!isPlaying.value || !deps.mixer.value || !deps.action.value) return
    const delta = clock.getDelta()
    deps.mixer.value.update(delta)
    const clipDuration = deps.action.value.getClip().duration
    deps.config.value.frame =
      clipDuration > 0
        ? Math.round((deps.mixer.value.time % clipDuration) * deps.config.value.fps)
        : 0
  }

  return { isPlaying, scrubToFrame, togglePlayback, tickPlayback }
}
