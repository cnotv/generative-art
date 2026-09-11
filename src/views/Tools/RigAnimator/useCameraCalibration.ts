import { ref, computed } from 'vue'
import type { HandSide } from '@webgamekit/rig'
import { detectCalibrationTPose, averageCalibrationFrames } from './cameraCalibrationPose'
import {
  createCalibrationCountdown,
  advanceCalibrationCountdown
} from './cameraCalibrationCountdown'
import {
  createEmptyCameraCalibration,
  measureFrontCalibration,
  measureSideCalibration
} from './cameraCalibration'
import {
  loadCameraCalibration,
  saveCameraCalibration,
  clearCameraCalibration
} from './calibrationStorage'
import { CALIBRATION_AVERAGING_WINDOW_MS } from './config'
import type {
  CalibrationFrame,
  CalibrationPoseKind,
  CameraCalibration,
  CameraCalibrationStep
} from './types'
import type { RigBodyPartGroup } from './bodyPartGroups'

const MILLISECONDS_PER_SECOND = 1000

type AssignableGroup = Exclude<RigBodyPartGroup, 'spineHead'>

interface CalibrationSettings {
  countdownSeconds: number
  toleranceDegrees: number
}

interface HeldFrame {
  frame: CalibrationFrame
  time: number
}

/**
 * Owns the camera calibration flow for the Rig Animator: an optional bone-to-group assignment,
 * then a held front T-pose and a held side T-pose, each captured by a countdown that only runs
 * while the pose matches. The result persists until reset.
 */
export const useCameraCalibration = () => {
  const step = ref<CameraCalibrationStep>(null)
  const calibration = ref<CameraCalibration>(
    loadCameraCalibration() ?? createEmptyCameraCalibration()
  )
  /** Which group is waiting for its root bone to be clicked on the model, read by the canvas's
   * own bone-pick handler. */
  const armedGroup = ref<AssignableGroup | null>(null)
  const isMatched = ref(false)
  const remainingMs = ref<number | null>(null)
  let countdown = createCalibrationCountdown()
  let heldFrames: HeldFrame[] = []

  const isActive = computed(() => step.value !== null)
  const isCalibrated = computed(() => calibration.value.front !== null)

  const persist = (next: CameraCalibration): void => {
    calibration.value = next
    saveCameraCalibration(next)
  }

  const clearProgress = (): void => {
    countdown = createCalibrationCountdown()
    heldFrames = []
    isMatched.value = false
    remainingMs.value = null
  }

  const goToStep = (next: CameraCalibrationStep): void => {
    clearProgress()
    step.value = next
    armedGroup.value = null
  }

  const start = (): void => goToStep('assignParts')
  const finish = (): void => goToStep(null)

  const armGroupAssignment = (group: AssignableGroup): void => {
    armedGroup.value = group
  }

  /** The canvas's own bone-pick handler calls this when a group is armed, instead of the normal
   * select-and-drag behaviour; see `RigAnimator.vue`'s `onCanvasPointerDown`. */
  const assignRootBone = (group: AssignableGroup, boneName: string): void => {
    persist({
      ...calibration.value,
      rootBoneNames: { ...calibration.value.rootBoneNames, [group]: boneName }
    })
    armedGroup.value = null
  }

  /** A new front calibration invalidates the side one, which was measured against it. */
  const completeCapture = (
    kind: CalibrationPoseKind,
    frame: CalibrationFrame,
    handAngles: Partial<Record<HandSide, number>>
  ): boolean => {
    if (kind === 'front') {
      const front = measureFrontCalibration(frame, handAngles)
      if (front) persist({ ...calibration.value, front, side: null })
      return front !== null
    }
    const side = calibration.value.front
      ? measureSideCalibration(frame, calibration.value.front)
      : null
    if (side) persist({ ...calibration.value, side })
    return side !== null
  }

  /**
   * Feed one detected frame while a T-pose step is active.
   * @param frame The live frame
   * @param handAngles Each detected hand's scene-space angle this frame
   * @param now This frame's timestamp, in milliseconds
   * @param settings The Config panel's countdown and tolerance
   * @returns The step that just completed, or null
   */
  const feedFrame = (
    frame: CalibrationFrame,
    handAngles: Partial<Record<HandSide, number>>,
    now: number,
    settings: CalibrationSettings
  ): CalibrationPoseKind | null => {
    const kind = step.value
    if (kind !== 'front' && kind !== 'side') return null
    const matched = detectCalibrationTPose(
      frame,
      kind,
      settings.toleranceDegrees,
      calibration.value.front
    )
    isMatched.value = matched
    heldFrames = matched
      ? [...heldFrames, { frame, time: now }].filter(
          (held) => now - held.time <= CALIBRATION_AVERAGING_WINDOW_MS
        )
      : []
    const advance = advanceCalibrationCountdown(
      countdown,
      matched,
      now,
      settings.countdownSeconds * MILLISECONDS_PER_SECOND
    )
    countdown = advance.state
    remainingMs.value = advance.remainingMs
    if (!advance.complete) return null

    const captured = completeCapture(
      kind,
      averageCalibrationFrames(heldFrames.map((held) => held.frame)),
      handAngles
    )
    if (!captured) {
      clearProgress()
      return null
    }
    goToStep(kind === 'front' ? 'side' : null)
    return kind
  }

  const reset = (): void => {
    clearCameraCalibration()
    calibration.value = createEmptyCameraCalibration()
    goToStep(null)
  }

  return {
    step,
    calibration,
    armedGroup,
    isActive,
    isCalibrated,
    isMatched,
    remainingMs,
    start,
    finish,
    goToStep,
    armGroupAssignment,
    assignRootBone,
    feedFrame,
    reset
  }
}
