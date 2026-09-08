import { ref } from 'vue'

/** Reads and writes the rig timeline state a live-motion recording drives, kept as plain
 * accessors rather than direct refs so the composable never assumes which reactive source
 * (the panel's config, the rig's own keyframe state) each one actually comes from. */
export interface RigMotionRecordingDependencies {
  fps: () => number
  currentFrame: () => number
  frameMax: () => number
  setFrame: (frame: number) => void
  setFrameMax: (frameMax: number) => void
  addKeyframe: () => void
}

/**
 * Turns a live camera-driven pose stream into an authored clip automatically: while recording,
 * every applied camera frame samples the rig's current pose onto the timeline at whatever frame
 * real elapsed time has reached, rather than requiring a manual Add Keyframe click per pose.
 */
export const useRigMotionRecording = (deps: RigMotionRecordingDependencies) => {
  const isRecording = ref(false)
  let anchorFrame = 0
  let anchorTimeMs = 0

  /** Arm recording from whatever frame the playhead currently sits on. */
  const startRecording = (): void => {
    isRecording.value = true
    anchorFrame = deps.currentFrame()
    anchorTimeMs = performance.now()
  }

  const stopRecording = (): void => {
    isRecording.value = false
  }

  /**
   * Call once per applied camera frame. A no-op while not recording, and while real elapsed
   * time has not yet reached a new integer frame (a live detection typically runs faster than
   * the timeline's own fps, so most calls land within the same frame as the last one). Growing
   * the visible frame range as recording runs past it keeps a long take from being silently cut
   * off, the same way the timeline's own resize handle only ever extends to fit real content.
   */
  const recordFrameIfActive = (): void => {
    if (!isRecording.value) return
    const elapsedSeconds = (performance.now() - anchorTimeMs) / 1000
    const nextFrame = anchorFrame + Math.round(elapsedSeconds * deps.fps())
    if (nextFrame <= deps.currentFrame()) return
    if (nextFrame > deps.frameMax()) deps.setFrameMax(nextFrame)
    deps.setFrame(nextFrame)
    deps.addKeyframe()
  }

  return { isRecording, startRecording, stopRecording, recordFrameIfActive }
}
