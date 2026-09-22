import { computed, watch, type Ref } from 'vue'
import type * as THREE from 'three'
import {
  CAMERA_POSE_REQUIRED_BONES,
  applyCameraPoseFrame,
  cameraBoneMaxTurnRadians,
  cameraBoneSmoothingShare,
  cameraFrameDrivenBoneNames,
  captureBoneTransforms,
  captureCameraRetargetRest,
  easeBonesFromTransforms
} from './cameraPoseRetarget'
import { boneNamesInGroups, type RigBodyPartGroup } from './bodyPartGroups'
import type {
  BoneRollTracks,
  CameraPoseFrame,
  CameraPoseMappingOptions,
  CameraRetargetRest
} from './types'

/**
 * Owns the camera-pose-capture readiness check and applies a detected frame to the rig, split out
 * of `useRigModel` to stay under its function-length lint cap.
 * @param bones The rig's current bones
 * @param resetAllBonesToRest Snaps every bone not excluded back to its loaded rest transform
 */
export const useRigCameraPose = (
  bones: Ref<THREE.Bone[]>,
  resetAllBonesToRest: (excludeBoneNames?: Set<string>) => void
) => {
  const canCaptureFromCamera = computed(() =>
    CAMERA_POSE_REQUIRED_BONES.every((name) => bones.value.some((bone) => bone.name === name))
  )

  let retargetRest: CameraRetargetRest | null = null
  /** When the last frame was applied, so bone smoothing knows how long it has been. */
  let lastAppliedAtMilliseconds: number | null = null
  /** How each bone has been rolling, so a reading that flips it over can be spotted. */
  const rollTracks: BoneRollTracks = new Map()
  // Synchronous on purpose: the rig stands at rest the instant its bones are adopted, and a
  // deferred watcher could run after a restored autosave has already posed it.
  watch(
    bones,
    (nextBones) => {
      retargetRest = nextBones.length > 0 ? captureCameraRetargetRest(nextBones) : null
      rollTracks.clear()
    },
    { immediate: true, flush: 'sync' }
  )

  /**
   * Apply a detected frame to the rig: reset whichever bones the frame drives back to rest, then
   * rotate them to match it (see `applyCameraPoseFrame`). Resetting first means a bone the frame
   * has nothing for this time, a limb out of frame, falls back to rest rather than keeping a pose
   * from an earlier edit or capture mixed in with the new one.
   *
   * `targetGroups` scopes both the reset and the application to the bones inside those groups
   * (see `boneBodyPartGroup`): a bone outside every selected group is left exactly as it was,
   * whether that is an earlier capture, a preset, or a manual edit, so a capture can be re-shot
   * for just one limb without disturbing whatever the rest of the rig already carries.
   * With bone smoothing or the joint speed cap on, each driven bone then eases from where the
   * previous frame left it toward its new rotation, see `easeBonesFromTransforms`.
   * @param frame The detected body, hands and head, from `CameraPoseCapture`
   * @param options Which rules to apply and how, see `CameraPoseMappingOptions`
   * @param targetGroups Which body-part groups this capture is allowed to touch
   * @param timestampMilliseconds When this frame is applied, for bone smoothing and roll tracking
   */
  const applyCameraPose = (
    frame: CameraPoseFrame,
    options: CameraPoseMappingOptions,
    targetGroups: Set<RigBodyPartGroup>,
    timestampMilliseconds: number = performance.now()
  ): void => {
    if (!retargetRest) return
    const drivenBoneNames = cameraFrameDrivenBoneNames(
      frame,
      boneNamesInGroups(bones.value, targetGroups)
    )
    const previousTransforms =
      options.boneSmoothingMilliseconds > 0 || options.maxBoneTurnRadiansPerSecond > 0
        ? captureBoneTransforms(bones.value, drivenBoneNames)
        : new Map()
    resetAllBonesToRest(
      new Set(bones.value.map((bone) => bone.name).filter((name) => !drivenBoneNames.has(name)))
    )
    const elapsedSeconds =
      lastAppliedAtMilliseconds === null
        ? Infinity
        : (timestampMilliseconds - lastAppliedAtMilliseconds) / 1000
    lastAppliedAtMilliseconds = timestampMilliseconds
    applyCameraPoseFrame(bones.value, retargetRest, frame, options, {
      drivenBoneNames,
      rollTracks,
      elapsedSeconds
    })
    easeBonesFromTransforms(
      bones.value,
      previousTransforms,
      cameraBoneSmoothingShare(options.boneSmoothingMilliseconds, elapsedSeconds),
      cameraBoneMaxTurnRadians(options.maxBoneTurnRadiansPerSecond, elapsedSeconds)
    )
  }

  return { canCaptureFromCamera, applyCameraPose }
}
