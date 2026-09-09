import { computed, shallowRef, type Ref } from 'vue'
import type * as THREE from 'three'
import { poseApply, type Pose, type PoseKeyframe } from '@webgamekit/rig'
import type { RigAnimatorConfig } from './types'

interface Dependencies {
  config: Ref<RigAnimatorConfig>
  keyframes: Ref<PoseKeyframe[]>
  rebuildPreviewClip: () => void
  persistAutosave: () => void
}

/** One copied pose, kept relative to the earliest frame in the copy rather than an absolute
 * frame, so paste can drop the whole block starting wherever the playhead currently sits. */
interface ClipboardEntry {
  offset: number
  pose: Pose
}

/**
 * Plain-data copy of a pose. `keyframes` is a Vue ref, so a stored pose is wrapped in a
 * reactive Proxy; `structuredClone` cannot clone that Proxy, but a pose is pure JSON-safe
 * numeric data, so a JSON round-trip clones it without touching the Proxy machinery.
 */
const clonePose = (pose: Pose): Pose => JSON.parse(JSON.stringify(pose))

/**
 * Owns copying and pasting a block of keyframes' poses, split out of `useRigKeyframes` to stay
 * under its function-length lint cap. A single copied frame is just a one-entry block, so
 * copying the current keyframe and copying a multi-select range go through the same path.
 */
export const useRigKeyframeClipboard = ({
  config,
  keyframes,
  rebuildPreviewClip,
  persistAutosave
}: Dependencies) => {
  const clipboardEntries = shallowRef<ClipboardEntry[] | null>(null)
  const hasClipboard = computed(() => (clipboardEntries.value?.length ?? 0) > 0)

  /** Copy the poses at every given frame onto the clipboard, keyed relative to the earliest
   * one among them. Frames with no keyframe of their own are silently skipped. */
  const copyKeyframes = (frames: number[]): void => {
    if (frames.length === 0) return
    const baseFrame = Math.min(...frames)
    const entries = frames
      .map((frame) => keyframes.value.find((keyframe) => keyframe.frame === frame))
      .filter((keyframe): keyframe is PoseKeyframe => keyframe !== undefined)
      .map((keyframe) => ({ offset: keyframe.frame - baseFrame, pose: clonePose(keyframe.pose) }))
    if (entries.length > 0) clipboardEntries.value = entries
  }

  /**
   * Paste the clipboard block starting at the panel's current frame, replacing whatever
   * keyframes were already at the landing frames, and apply the pose that lands on the current
   * frame to the live rig so the view matches immediately.
   * @param bones The rig's bones, so the pasted pose is visible without scrubbing
   */
  const pasteKeyframes = (bones: THREE.Bone[]): void => {
    if (!clipboardEntries.value) return
    const baseFrame = config.value.frame
    const pasted = clipboardEntries.value.map((entry) => ({
      frame: baseFrame + entry.offset,
      pose: clonePose(entry.pose)
    }))
    const pastedFrames = new Set(pasted.map((keyframe) => keyframe.frame))
    const withoutOverlap = keyframes.value.filter((keyframe) => !pastedFrames.has(keyframe.frame))
    keyframes.value = [...withoutOverlap, ...pasted]
    const poseAtCurrentFrame = pasted.find((keyframe) => keyframe.frame === baseFrame)?.pose
    if (poseAtCurrentFrame) poseApply(bones, poseAtCurrentFrame)
    rebuildPreviewClip()
    persistAutosave()
  }

  return { hasClipboard, copyKeyframes, pasteKeyframes }
}
