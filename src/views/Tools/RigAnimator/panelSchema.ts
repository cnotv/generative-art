import type { ConfigControlsSchema } from '@/stores/viewConfig'
import {
  POSITION_STEP_FRACTION,
  ROTATION_CONTROL,
  CAMERA_SMOOTHING_FACTOR_RANGE,
  CAMERA_REACH_MULTIPLIER_RANGE,
  CAMERA_MAX_JUMP_RANGE,
  CALIBRATION_COUNTDOWN_RANGE,
  CALIBRATION_TOLERANCE_RANGE,
  CALIBRATION_FIELD_OF_VIEW_RANGE,
  CALIBRATED_MOVEMENT_SCALE_RANGE,
  MARBLE_SPAWN_INTERVAL_RANGE,
  ENCLOSURE_OPACITY_RANGE,
  ENCLOSURE_SIZE_RANGE
} from './config'

/** Rebuilt whenever the bone list or the auto-rig availability changes, since those decide
 * which rows even make sense to show. Playback, keyframes and import/export live on the
 * dedicated rig timeline instead of in this panel. */
export const buildRigAnimatorSchema = (
  boneNames: string[],
  needsAutoRig: boolean,
  positionRange: number,
  canCaptureFromCamera: boolean,
  physicsEnabled: boolean
): ConfigControlsSchema => ({
  ...(needsAutoRig ? { autoRig: { callback: 'autoRig', label: 'Auto-rig as Humanoid' } } : {}),
  ...(boneNames.length > 0
    ? {
        selectedBone: { options: boneNames, label: 'Bone', sectionStart: true },
        boneRotation: ROTATION_CONTROL,
        bonePosition: {
          label: 'Bone Position',
          component: 'CoordinateInput',
          min: { x: -positionRange, y: -positionRange, z: -positionRange },
          max: { x: positionRange, y: positionRange, z: positionRange },
          step: {
            x: positionRange * POSITION_STEP_FRACTION,
            y: positionRange * POSITION_STEP_FRACTION,
            z: positionRange * POSITION_STEP_FRACTION
          }
        },
        resetBone: { callback: 'resetBone', label: 'Reset Bone to Rest Pose' },
        showBoneMarkers: { checkbox: true, label: 'Show Bone Markers' }
      }
    : {}),
  ...(canCaptureFromCamera
    ? {
        cameraUseElbows: {
          checkbox: true,
          label: 'Camera Pose: Bend Elbows to Photo',
          sectionStart: true
        },
        cameraUseKnees: { checkbox: true, label: 'Camera Pose: Bend Knees to Photo' },
        cameraUseNeck: { checkbox: true, label: 'Camera Pose: Bend Neck to Photo' },
        cameraUseDepth: { checkbox: true, label: 'Camera Pose: Use Depth (Z Axis)' },
        cameraUseViewpoint: { checkbox: true, label: 'Camera Pose: Match Camera Angle to Photo' },
        cameraReachMultiplier: {
          ...CAMERA_REACH_MULTIPLIER_RANGE,
          label: 'Camera Pose: Reach Multiplier'
        },
        cameraSmoothingFactor: {
          ...CAMERA_SMOOTHING_FACTOR_RANGE,
          label: 'Camera Pose: Smoothing (Live Feed)'
        },
        cameraMaxJump: {
          ...CAMERA_MAX_JUMP_RANGE,
          label: 'Camera Pose: Max Jump (Live Feed)'
        },
        cameraShowPreview: { checkbox: true, label: 'Camera Pose: Show Camera Preview' },
        calibrationCountdownSeconds: {
          ...CALIBRATION_COUNTDOWN_RANGE,
          label: 'Calibration: Countdown (s)',
          sectionStart: true
        },
        calibrationToleranceDegrees: {
          ...CALIBRATION_TOLERANCE_RANGE,
          label: 'Calibration: T-Pose Tolerance (°)'
        },
        calibrationFieldOfViewDegrees: {
          ...CALIBRATION_FIELD_OF_VIEW_RANGE,
          label: 'Calibration: Webcam Field of View (°)'
        },
        calibratedFollowRotation: { checkbox: true, label: 'Calibrated: Follow Rotation' },
        calibratedFollowSideToSide: { checkbox: true, label: 'Calibrated: Follow Side-to-Side' },
        calibratedFollowDistance: { checkbox: true, label: 'Calibrated: Follow Distance' },
        calibratedFollowHandRotation: {
          checkbox: true,
          label: 'Calibrated: Follow Hand Rotation'
        },
        calibratedMovementScale: {
          ...CALIBRATED_MOVEMENT_SCALE_RANGE,
          label: 'Calibrated: Movement Scale'
        }
      }
    : {}),
  physicsEnabled: { checkbox: true, label: 'Physics: Simulate', sectionStart: true },
  ...(physicsEnabled
    ? {
        marbleFlowEnabled: { checkbox: true, label: 'Physics: Spawn Marbles' },
        marbleSpawnInterval: {
          ...MARBLE_SPAWN_INTERVAL_RANGE,
          label: 'Physics: Marble Flow (Frames)'
        },
        marbleTextures: { checkbox: true, label: 'Physics: Marble Textures' },
        respawnMarbles: { callback: 'respawnMarbles', label: 'Physics: Reset Marbles' },
        enclosureSize: { ...ENCLOSURE_SIZE_RANGE, label: 'Physics: Wall Size' },
        enclosureOpacity: { ...ENCLOSURE_OPACITY_RANGE, label: 'Physics: Wall Opacity' }
      }
    : {}),
  fps: { min: 1, max: 60, step: 1, label: 'FPS', sectionStart: true }
})
