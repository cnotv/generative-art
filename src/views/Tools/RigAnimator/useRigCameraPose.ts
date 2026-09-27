import { computed, watch, type Ref } from 'vue'
import type * as THREE from 'three'
import {
  CAMERA_HIPS_BONE,
  CAMERA_POSE_REQUIRED_BONES,
  applyCameraPoseFrame,
  cameraBoneMaxTurnRadians,
  cameraBoneSmoothingShare,
  cameraFrameDrivenBoneNames,
  captureBoneTransforms,
  captureCameraRetargetRest,
  easeBonesFromTransforms
} from './cameraPoseRetarget'
import {
  advanceCameraTravel,
  cameraLegLength,
  offsetBoneInWorld,
  pinPlantedFeet,
  rigLegLength
} from './cameraPoseTravel'
import { boneNamesInGroups, type RigBodyPartGroup } from './bodyPartGroups'
import type {
  TurnTracks,
  CameraFootPins,
  CameraPoseFrame,
  CameraPoseMappingOptions,
  CameraRetargetRest,
  CameraTravel
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
  const turnTracks: TurnTracks = new Map()
  /** How far the current source has carried the rig, null until its first reading. */
  let travel: CameraTravel | null = null
  /** Each foot held where it landed. */
  let footPins: CameraFootPins = {}
  /** Whether no body has been applied since the source started, so there is no pose to hold. */
  let isFreshSource = true

  /**
   * Start the next reading afresh, as a new video, photo or camera session should: travel from the
   * rig's own spot, no foot held, and a limb the first frame cannot see at rest rather than held in
   * whatever pose the rig was left in.
   */
  const startNewCameraSource = (): void => {
    travel = null
    footPins = {}
    isFreshSource = true
  }

  // Synchronous on purpose: the rig stands at rest the instant its bones are adopted, and a
  // deferred watcher could run after a restored autosave has already posed it.
  watch(
    bones,
    (nextBones) => {
      retargetRest = nextBones.length > 0 ? captureCameraRetargetRest(nextBones) : null
      turnTracks.clear()
      startNewCameraSource()
    },
    { immediate: true, flush: 'sync' }
  )

  /**
   * Carry the hips to where the performer now stands. A frame that cannot say where that is,
   * the hips out of the picture or the legs out of view, keeps the rig where it last was.
   */
  const carryHips = (
    rest: CameraRetargetRest,
    frame: CameraPoseFrame,
    elapsedSeconds: number
  ): void => {
    const hips = bones.value.find((bone) => bone.name === CAMERA_HIPS_BONE)
    const rigLeg = rigLegLength(rest)
    const performerLeg = frame.bodyLandmarks && cameraLegLength(frame.bodyLandmarks)
    if (frame.bodyPosition && rigLeg && performerLeg) {
      travel = advanceCameraTravel(
        travel,
        { bodyPosition: frame.bodyPosition, performerLegLength: performerLeg },
        rigLeg,
        elapsedSeconds
      )
    }
    if (hips && travel) offsetBoneInWorld(hips, travel.offset)
  }

  /**
   * Apply a detected frame to the rig: reset whichever bones the frame drives back to rest, then
   * rotate them to match it (see `applyCameraPoseFrame`). Resetting first means a driven bone no
   * rule turns, a clavicle, never keeps a pose from an earlier edit mixed in with the new one. A
   * limb the frame cannot see is not driven at all (see `cameraFrameDrivenBoneNames`), so it
   * keeps the pose the last frame that saw it left.
   *
   * `targetGroups` scopes both the reset and the application to the bones inside those groups
   * (see `boneBodyPartGroup`): a bone outside every selected group is left exactly as it was,
   * whether that is an earlier capture, a preset, or a manual edit, so a capture can be re-shot
   * for just one limb without disturbing whatever the rest of the rig already carries.
   * With bone smoothing or the joint speed cap on, each driven bone then eases from where the
   * previous frame left it toward its new rotation, see `easeBonesFromTransforms`.
   *
   * With `options.followTravel` the hips are then carried across the floor to where the performer
   * stands, before easing so a smoothed hip eases between two carried positions. With
   * `options.pinPlantedFeet` the legs are solved last, on the final pose, to hold each planted
   * foot where it landed.
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
    // A cut-off of 0 counts every limb as seen: each is reset to rest, and only the ones really in
    // view are posed.
    const drivenBoneNames = cameraFrameDrivenBoneNames(
      frame,
      boneNamesInGroups(bones.value, targetGroups),
      isFreshSource ? 0 : options.visibilityThreshold
    )
    if (frame.bodyLandmarks) isFreshSource = false
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
      turnTracks,
      elapsedSeconds
    })
    if (!options.followTravel) travel = null
    else if (drivenBoneNames.has(CAMERA_HIPS_BONE)) carryHips(retargetRest, frame, elapsedSeconds)
    easeBonesFromTransforms(
      bones.value,
      previousTransforms,
      cameraBoneSmoothingShare(options.boneSmoothingMilliseconds, elapsedSeconds),
      cameraBoneMaxTurnRadians(options.maxBoneTurnRadiansPerSecond, elapsedSeconds)
    )
    if (!options.pinPlantedFeet) footPins = {}
    else if (frame.bodyLandmarks) {
      footPins = pinPlantedFeet(
        bones.value,
        retargetRest,
        footPins,
        elapsedSeconds,
        drivenBoneNames
      )
    }
  }

  return { canCaptureFromCamera, applyCameraPose, startNewCameraSource }
}
