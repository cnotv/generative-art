import * as THREE from 'three'
import type { FollowCameraConfig, FollowCameraMode, FollowCameraPlacement } from './types'

const scratchLookTarget = new THREE.Vector3()
const scratchGoal = new THREE.Vector3()

export const FOLLOW_CAMERA_MODES: FollowCameraMode[] = ['third', 'first', 'free']

export const DEFAULT_FOLLOW_CAMERA: FollowCameraConfig = {
  thirdPersonHeight: 14,
  thirdPersonBack: 12,
  firstPersonHeight: 3.3,
  firstPersonForward: 2.8,
  firstPersonLookAhead: 20,
  freeCamHeight: 40,
  freeCamBack: 50,
  transitionSeconds: 0.6
}

/**
 * Eases a mode change so it glides in fast and settles, landing exactly on the
 * goal rather than snapping the last fraction.
 *
 * @param alpha - Progress through the change, clamped for callers passing a raw ratio
 * @returns The eased progress
 */
export const followCameraEase = (alpha: number): number => {
  const clamped = Math.min(1, Math.max(0, alpha))
  return 1 - (1 - clamped) ** 3
}

const placeThird = (
  target: THREE.Vector3,
  direction: THREE.Vector3,
  config: FollowCameraConfig
): void => {
  scratchGoal.set(
    target.x - direction.x * config.thirdPersonBack,
    target.y + config.thirdPersonHeight,
    target.z - direction.z * config.thirdPersonBack
  )
  scratchLookTarget.copy(target)
}

const placeFirst = (
  target: THREE.Vector3,
  direction: THREE.Vector3,
  config: FollowCameraConfig
): void => {
  scratchGoal.set(
    target.x + direction.x * config.firstPersonForward,
    target.y + config.firstPersonHeight,
    target.z + direction.z * config.firstPersonForward
  )
  // The look target sits at the eye's own height, so the view is level rather
  // than angled down: eye height alone decides how much of the way ahead shows.
  scratchLookTarget.copy(scratchGoal).addScaledVector(direction, config.firstPersonLookAhead)
}

const placeFree = (
  target: THREE.Vector3,
  direction: THREE.Vector3,
  config: FollowCameraConfig
): void => {
  scratchGoal.set(
    target.x - direction.x * config.freeCamBack,
    target.y + config.freeCamHeight,
    target.z - direction.z * config.freeCamBack
  )
  scratchLookTarget.copy(target)
}

/**
 * Where a following camera should sit and look for one mode.
 *
 * Returns the placement rather than moving anything, so a caller can ease into
 * it, hand it to orbit controls, or ignore it — the three modes differ only in
 * arithmetic, and none of them needs to know what is being followed.
 *
 * @param mode - Which of the three cameras to place
 * @param target - World position of the thing being followed
 * @param direction - Unit heading it is travelling in, on the horizontal plane
 * @param config - Offsets for all three modes
 * @returns The camera position and the point it should look at
 */
export const followCameraPlacement = (
  mode: FollowCameraMode,
  target: THREE.Vector3,
  direction: THREE.Vector3,
  config: FollowCameraConfig
): FollowCameraPlacement => {
  if (mode === 'first') placeFirst(target, direction, config)
  else if (mode === 'free') placeFree(target, direction, config)
  else placeThird(target, direction, config)
  return { position: scratchGoal, lookAt: scratchLookTarget }
}

const MODE_CONTROLS: Record<FollowCameraMode, Record<string, unknown>> = {
  third: {
    thirdPersonHeight: { min: 1, max: 80, step: 0.5, label: 'Height' },
    thirdPersonBack: { min: 1, max: 120, step: 0.5, label: 'Distance behind' }
  },
  first: {
    firstPersonHeight: { min: 0, max: 20, step: 0.1, label: 'Eye height' },
    firstPersonForward: { min: 0, max: 20, step: 0.1, label: 'Eye forward' },
    firstPersonLookAhead: { min: 1, max: 200, step: 1, label: 'Looks ahead' }
  },
  free: {
    freeCamHeight: { min: 1, max: 300, step: 1, label: 'Height' },
    freeCamBack: { min: 1, max: 300, step: 1, label: 'Distance behind' }
  }
}

const SHARED_CONTROLS = {
  transitionSeconds: { min: 0, max: 3, step: 0.05, label: 'Mode change time', sectionStart: true }
}

/**
 * Panel controls for one mode: a tab strip, that mode's own offsets, and the
 * settings every mode shares.
 *
 * Plain data rather than components, so the package stays free of any UI
 * framework and a host can render it however its own panels work.
 *
 * @param mode - The mode whose offsets should be shown
 * @param modeLabels - Display names for the three tabs
 * @returns A schema describing the controls for that mode
 */
export const followCameraSchema = (
  mode: FollowCameraMode,
  modeLabels: Record<FollowCameraMode, string> = { third: 'Chase', first: 'First', free: 'Free' }
): Record<string, unknown> => ({
  mode: {
    component: 'ButtonSelector',
    label: 'Camera',
    options: FOLLOW_CAMERA_MODES.map((value) => ({ value, label: modeLabels[value] }))
  },
  ...MODE_CONTROLS[mode],
  ...SHARED_CONTROLS
})

/**
 * Every control across every mode, which is what a config object must cover.
 *
 * @returns The union of all three modes' controls and the shared ones
 */
export const followCameraAllControls = (): Record<string, unknown> => ({
  ...MODE_CONTROLS.third,
  ...MODE_CONTROLS.first,
  ...MODE_CONTROLS.free,
  ...SHARED_CONTROLS
})
