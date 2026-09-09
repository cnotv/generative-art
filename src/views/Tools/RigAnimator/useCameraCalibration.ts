import { ref, computed } from 'vue'
import type * as THREE from 'three'
import type { HandSide } from '@webgamekit/rig'
import {
  createEmptyCalibrationBaseline,
  captureFrontCalibration,
  captureSideCalibration,
  type CameraCalibrationStep,
  type CameraCalibrationBaseline
} from './cameraCalibration'
import type { CameraLandmark } from './cameraPoseMapping'
import type { RigBodyPartGroup } from './bodyPartGroups'

/**
 * Owns one calibration session's step and captured baseline for the Rig Animator's camera
 * capture: a front snapshot for body/hand rotation and whole-body position, a side snapshot for
 * reach, and an optional bone-to-group assignment pass for a non-mixamorig rig. Session-only, by
 * design (see the calibration design discussion): nothing here persists past a reload.
 */
export const useCameraCalibration = () => {
  const step = ref<CameraCalibrationStep>(null)
  const baseline = ref<CameraCalibrationBaseline>(createEmptyCalibrationBaseline())
  /** Which group is waiting for its root bone to be clicked on the model, or null when the
   * "assign parts" step isn't armed for one; read by the canvas's own bone-pick handler. */
  const armedGroup = ref<Exclude<RigBodyPartGroup, 'spineHead'> | null>(null)

  const isActive = computed(() => step.value !== null)

  const start = (): void => {
    step.value = 'assignParts'
  }

  const finish = (): void => {
    step.value = null
    armedGroup.value = null
  }

  const goToStep = (next: CameraCalibrationStep): void => {
    step.value = next
    armedGroup.value = null
  }

  const armGroupAssignment = (group: Exclude<RigBodyPartGroup, 'spineHead'>): void => {
    armedGroup.value = group
  }

  /** The canvas's own bone-pick handler calls this when a group is armed, instead of the normal
   * select-and-drag behaviour; see `RigAnimator.vue`'s `onCanvasPointerDown`. */
  const assignRootBone = (
    group: Exclude<RigBodyPartGroup, 'spineHead'>,
    boneName: string
  ): void => {
    baseline.value = {
      ...baseline.value,
      rootBoneNames: { ...baseline.value.rootBoneNames, [group]: boneName }
    }
    armedGroup.value = null
  }

  const captureFront = (
    landmarks: CameraLandmark[],
    bodyCenterImage: { x: number; y: number } | null,
    handRotations: Partial<Record<HandSide, number>>
  ): void => {
    baseline.value = {
      ...baseline.value,
      ...captureFrontCalibration(landmarks, bodyCenterImage, handRotations)
    }
  }

  /** Returns the derived reach multiplier so the caller can write it straight into the Config
   * panel's own `cameraReachMultiplier` field, the same value the manual slider controls. */
  const captureSide = (landmarks: CameraLandmark[], bones: THREE.Bone[]): number | null => {
    const result = captureSideCalibration(landmarks, bones)
    if (!result) return null
    baseline.value = { ...baseline.value, autoReachMultiplier: result.autoReachMultiplier }
    return result.autoReachMultiplier
  }

  const reset = (): void => {
    baseline.value = createEmptyCalibrationBaseline()
    step.value = null
    armedGroup.value = null
  }

  return {
    step,
    baseline,
    armedGroup,
    isActive,
    start,
    finish,
    goToStep,
    armGroupAssignment,
    assignRootBone,
    captureFront,
    captureSide,
    reset
  }
}
