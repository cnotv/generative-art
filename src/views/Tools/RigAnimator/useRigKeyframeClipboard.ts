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

/**
 * Plain-data copy of a pose. `keyframes` is a Vue ref, so a stored pose is wrapped in a
 * reactive Proxy; `structuredClone` cannot clone that Proxy, but a pose is pure JSON-safe
 * numeric data, so a JSON round-trip clones it without touching the Proxy machinery.
 */
const clonePose = (pose: Pose): Pose => JSON.parse(JSON.stringify(pose))

/**
 * Owns copying and pasting a keyframe's pose, split out of `useRigKeyframes` to stay under its
 * function-length lint cap.
 */
export const useRigKeyframeClipboard = ({
  config,
  keyframes,
  rebuildPreviewClip,
  persistAutosave
}: Dependencies) => {
  const clipboardPose = shallowRef<Pose | null>(null)
  const hasClipboard = computed(() => clipboardPose.value !== null)

  /** Copy the pose at the panel's current frame, if one exists there, onto the clipboard. */
  const copyKeyframe = (): void => {
    const keyframe = keyframes.value.find((candidate) => candidate.frame === config.value.frame)
    if (keyframe) clipboardPose.value = clonePose(keyframe.pose)
  }

  /**
   * Paste the clipboard pose onto the panel's current frame, replacing whatever keyframe was
   * there, and apply it to the live rig so the view matches immediately.
   * @param bones The rig's bones, so the pasted pose is visible without scrubbing
   */
  const pasteKeyframe = (bones: THREE.Bone[]): void => {
    if (!clipboardPose.value) return
    const pose = clonePose(clipboardPose.value)
    const withoutSameFrame = keyframes.value.filter(
      (keyframe) => keyframe.frame !== config.value.frame
    )
    keyframes.value = [...withoutSameFrame, { frame: config.value.frame, pose }]
    poseApply(bones, pose)
    rebuildPreviewClip()
    persistAutosave()
  }

  return { hasClipboard, copyKeyframe, pasteKeyframe }
}
