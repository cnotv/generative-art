import { ref } from 'vue'
import type { Pose, PoseKeyframe } from '@webgamekit/rig'
import { RECORDING_SAMPLES_PER_FRAME } from './config'
import { filterRecordedSamples } from './keyframeOps'

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
  /** The rig's pose right now, sampled `RECORDING_SAMPLES_PER_FRAME` times a frame. */
  capturePose: () => Pose
  /** Swap the take's keyframes, `fromFrame` to `toFrame`, for the ones filtered from its samples. */
  replaceTake: (fromFrame: number, toFrame: number, keyframes: PoseKeyframe[]) => void
}

/**
 * Turns a live camera-driven pose stream into an authored clip automatically: while recording,
 * every applied camera frame samples the rig's current pose onto the timeline at whatever frame
 * real elapsed time has reached, rather than requiring a manual Add Keyframe click per pose.
 */
export const useRigMotionRecording = (deps: RigMotionRecordingDependencies) => {
  const isRecording = ref(false)
  /** How many frames this recording session has actually sampled, so a caller can tell a take
   * that genuinely captured motion from a toggle-on/toggle-off that never advanced a frame. */
  const capturedFrameCount = ref(0)
  let anchorFrame = 0
  let anchorTimeMs = 0
  let lastSampleStep = 0
  // Appended to in place: a long take gathers thousands of samples, and copying the whole list for
  // each one would make every sample slower than the last.
  const samples: PoseKeyframe[] = []

  /** Arm recording from whatever frame the playhead currently sits on. */
  const startRecording = (): void => {
    isRecording.value = true
    capturedFrameCount.value = 0
    anchorFrame = deps.currentFrame()
    anchorTimeMs = performance.now()
    lastSampleStep = 0
    samples.splice(0, samples.length, { frame: anchorFrame, pose: deps.capturePose() })
    // recordFrameIfActive only ever captures a frame strictly past this one (its own guard
    // below skips anything <= currentFrame, and currentFrame is this very frame until real
    // time advances past it) — so without this, the anchor frame is left holding whatever
    // keyframe, if any, already sat there. Scrubbing or playing into the start of a take then
    // interpolates from that unrelated pose into the first real sample: a visible twitch right
    // at the seam. Capturing the live pose already on the rig the instant recording arms closes
    // that gap; it is not counted in `capturedFrameCount` since no time-driven motion happened.
    deps.addKeyframe()
  }

  /** Stop, and replace the keyframes the take laid down live with ones filtered from all its
   * samples, see `filterRecordedSamples`. */
  const stopRecording = (): void => {
    if (!isRecording.value) return
    isRecording.value = false
    // A last sample half a frame past the playhead would otherwise add a keyframe beyond the take.
    const lastFrame = deps.currentFrame()
    const filtered = filterRecordedSamples(samples).filter(({ frame }) => frame <= lastFrame)
    if (capturedFrameCount.value > 0) deps.replaceTake(anchorFrame, lastFrame, filtered)
    samples.splice(0, samples.length)
  }

  const sampleIfDue = (elapsedSeconds: number): void => {
    const step = Math.round(elapsedSeconds * deps.fps() * RECORDING_SAMPLES_PER_FRAME)
    if (step <= lastSampleStep) return
    lastSampleStep = step
    samples.push({
      frame: anchorFrame + step / RECORDING_SAMPLES_PER_FRAME,
      pose: deps.capturePose()
    })
  }

  /**
   * Call once per applied camera frame. Samples the pose whenever real time has reached a new
   * sample step, `RECORDING_SAMPLES_PER_FRAME` of them a frame. A no-op while not recording, and
   * otherwise lays down a live keyframe only while real elapsed
   * time has not yet reached a new integer frame (a live detection typically runs faster than
   * the timeline's own fps, so most calls land within the same frame as the last one). Growing
   * the visible frame range as recording runs past it keeps a long take from being silently cut
   * off, the same way the timeline's own resize handle only ever extends to fit real content.
   */
  const recordFrameIfActive = (): void => {
    if (!isRecording.value) return
    const elapsedSeconds = (performance.now() - anchorTimeMs) / 1000
    sampleIfDue(elapsedSeconds)
    const nextFrame = anchorFrame + Math.round(elapsedSeconds * deps.fps())
    if (nextFrame <= deps.currentFrame()) return
    if (nextFrame > deps.frameMax()) deps.setFrameMax(nextFrame)
    deps.setFrame(nextFrame)
    deps.addKeyframe()
    capturedFrameCount.value += 1
  }

  return { isRecording, capturedFrameCount, startRecording, stopRecording, recordFrameIfActive }
}
