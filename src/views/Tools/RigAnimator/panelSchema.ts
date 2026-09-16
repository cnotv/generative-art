import type { ConfigControlsSchema } from '@/stores/viewConfig'
import {
  POSITION_STEP_FRACTION,
  ROTATION_CONTROL,
  CAMERA_SMOOTHING_MILLISECONDS_RANGE,
  CAMERA_MAX_JUMP_RANGE,
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
        cameraGroundFeet: {
          checkbox: true,
          label: 'Camera Pose: Keep Feet on Ground',
          sectionStart: true
        },
        cameraUseDepth: { checkbox: true, label: 'Camera Pose: Use Depth (Z Axis)' },
        cameraUseViewpoint: { checkbox: true, label: 'Camera Pose: Match Camera Angle to Photo' },
        cameraSmoothingMilliseconds: {
          ...CAMERA_SMOOTHING_MILLISECONDS_RANGE,
          label: 'Camera Pose: Smoothing in ms (Live Feed)'
        },
        cameraMaxJump: {
          ...CAMERA_MAX_JUMP_RANGE,
          label: 'Camera Pose: Max Jump (Live Feed)'
        },
        cameraShowPreview: { checkbox: true, label: 'Camera Pose: Show Camera Preview' },
        cameraTrackFace: {
          checkbox: true,
          label: 'Camera Detect: Face Tracker for Head',
          sectionStart: true
        },
        cameraSearchFaceAroundBody: {
          checkbox: true,
          label: 'Camera Detect: Face Search Around Nose'
        },
        cameraTrackHands: { checkbox: true, label: 'Camera Detect: Hand Tracker for Fingers' },
        cameraSearchHandsAroundWrists: {
          checkbox: true,
          label: 'Camera Detect: Hand Search Around Wrists'
        },
        cameraSideHandsByWrist: {
          checkbox: true,
          label: 'Camera Detect: Hand Side by Nearest Wrist'
        },
        cameraIgnoreOutsideImage: {
          checkbox: true,
          label: 'Camera Detect: Ignore Body Outside Image'
        },
        cameraMirrorLive: { checkbox: true, label: 'Camera Detect: Mirror Live Camera' },
        cameraDetectOnlyWhilePlaying: {
          checkbox: true,
          label: 'Camera Detect: Only While Video Plays'
        },
        cameraTurnHips: { checkbox: true, label: 'Camera Bones: Turn Hips', sectionStart: true },
        cameraBendSpine: { checkbox: true, label: 'Camera Bones: Bend Spine' },
        cameraTurnHead: { checkbox: true, label: 'Camera Bones: Turn Neck and Head' },
        cameraCorrectHeadPitch: {
          checkbox: true,
          label: 'Camera Bones: Correct Ear and Nose Head Pitch'
        },
        cameraLimitHeadTurn: {
          checkbox: true,
          label: 'Camera Bones: Ignore Impossible Head Turns'
        },
        cameraAimArms: { checkbox: true, label: 'Camera Bones: Aim Arms' },
        cameraRollUpperArms: { checkbox: true, label: 'Camera Bones: Roll Upper Arms from Elbows' },
        cameraRollForearms: {
          checkbox: true,
          label: 'Camera Bones: Roll Forearms and Hands to Palms'
        },
        cameraAimLegs: { checkbox: true, label: 'Camera Bones: Aim Legs' },
        cameraRollThighs: {
          checkbox: true,
          label: 'Camera Bones: Roll Thighs from Knees and Feet'
        },
        cameraAimFeet: { checkbox: true, label: 'Camera Bones: Aim Feet' }
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
