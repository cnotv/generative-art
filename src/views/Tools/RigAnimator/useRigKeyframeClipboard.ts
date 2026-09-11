import { computed, shallowRef, type Ref } from 'vue'
import type * as THREE from 'three'
import { poseApply, poseApplyPositions, type PoseKeyframe } from '@webgamekit/rig'
import type { RigAnimatorConfig } from './types'

interface Dependencies {
  config: Ref<RigAnimatorConfig>
  keyframes: Ref<PoseKeyframe[]>
  rebuildPreviewClip: () => void
  persistAutosave: () => void
}

type KeyframeContent = Pick<PoseKeyframe, 'pose' | 'positions'>

/** One copied keyframe, kept relative to the earliest frame in the copy rather than an absolute
 * frame, so paste can drop the whole block starting wherever the playhead currently sits. */
interface ClipboardEntry extends KeyframeContent {
  offset: number
}

/**
 * Plain-data copy of a keyframe's pose and positions. `keyframes` is a Vue ref, so stored data
 * is wrapped in a reactive Proxy; `structuredClone` cannot clone that Proxy, but both are pure
 * JSON-safe numeric data, so a JSON round-trip clones them without touching the Proxy machinery.
 */
const cloneContent = ({ pose, positions }: KeyframeContent): KeyframeContent =>
  JSON.parse(JSON.stringify(positions ? { pose, positions } : { pose }))

/**
 * Owns copying and pasting a block of keyframes, split out of `useRigKeyframes` to stay under
 * its function-length lint cap. A single copied frame is just a one-entry block, so copying the
 * current keyframe and copying a multi-select range go through the same path.
 */
export const useRigKeyframeClipboard = ({
  config,
  keyframes,
  rebuildPreviewClip,
  persistAutosave
}: Dependencies) => {
  const clipboardEntries = shallowRef<ClipboardEntry[] | null>(null)
  const hasClipboard = computed(() => (clipboardEntries.value?.length ?? 0) > 0)

  /** Copy the keyframes at every given frame onto the clipboard, keyed relative to the earliest
   * one among them. Frames with no keyframe of their own are silently skipped. */
  const copyKeyframes = (frames: number[]): void => {
    if (frames.length === 0) return
    const baseFrame = Math.min(...frames)
    const entries = frames
      .map((frame) => keyframes.value.find((keyframe) => keyframe.frame === frame))
      .filter((keyframe): keyframe is PoseKeyframe => keyframe !== undefined)
      .map((keyframe) => ({ offset: keyframe.frame - baseFrame, ...cloneContent(keyframe) }))
    if (entries.length > 0) clipboardEntries.value = entries
  }

  /**
   * Paste the clipboard block starting at the panel's current frame, replacing whatever
   * keyframes were already at the landing frames, and apply the keyframe that lands on the
   * current frame to the live rig so the view matches immediately.
   * @param bones The rig's bones, so the pasted pose is visible without scrubbing
   */
  const pasteKeyframes = (bones: THREE.Bone[]): void => {
    if (!clipboardEntries.value) return
    const baseFrame = config.value.frame
    const pasted: PoseKeyframe[] = clipboardEntries.value.map(({ offset, ...content }) => ({
      frame: baseFrame + offset,
      ...cloneContent(content)
    }))
    const pastedFrames = new Set(pasted.map((keyframe) => keyframe.frame))
    const withoutOverlap = keyframes.value.filter((keyframe) => !pastedFrames.has(keyframe.frame))
    keyframes.value = [...withoutOverlap, ...pasted]
    const landing = pasted.find((keyframe) => keyframe.frame === baseFrame)
    if (landing) poseApply(bones, landing.pose)
    if (landing?.positions) poseApplyPositions(bones, landing.positions)
    rebuildPreviewClip()
    persistAutosave()
  }

  return { hasClipboard, copyKeyframes, pasteKeyframes }
}
