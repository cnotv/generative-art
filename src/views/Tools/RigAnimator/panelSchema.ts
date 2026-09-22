import type { ConfigControlsSchema } from '@/stores/viewConfig'
import type { RigPanelGroup } from './types'
import {
  POSITION_STEP_FRACTION,
  ROTATION_CONTROL,
  CAMERA_SMOOTHING_MILLISECONDS_RANGE,
  CAMERA_SMOOTHING_SPEED_RESPONSE_RANGE,
  CAMERA_SMOOTHING_SPEED_CUTOFF_RANGE,
  CAMERA_SMOOTHING_TURN_RESPONSE_RANGE,
  CAMERA_BONE_SMOOTHING_MILLISECONDS_RANGE,
  CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND_RANGE,
  CAMERA_HAND_FLIP_DEGREES_RANGE,
  CAMERA_HAND_HOLD_MILLISECONDS_RANGE,
  CAMERA_VISIBILITY_THRESHOLD_RANGE,
  CAMERA_TWIST_BEND_DEGREES_RANGE,
  CAMERA_VIDEO_SLOWDOWN_RATIO_RANGE,
  CAMERA_MAX_JUMP_RANGE,
  MARBLE_SPAWN_INTERVAL_RANGE,
  ENCLOSURE_OPACITY_RANGE,
  ENCLOSURE_SIZE_RANGE
} from './config'

/** Which parts of the rig panel make sense for the rig loaded right now. */
interface RigPanelAvailability {
  boneNames: string[]
  needsAutoRig: boolean
  positionRange: number
  canCaptureFromCamera: boolean
  physicsEnabled: boolean
}

const boneControls = ({
  boneNames,
  needsAutoRig,
  positionRange
}: RigPanelAvailability): ConfigControlsSchema => ({
  ...(needsAutoRig ? { autoRig: { callback: 'autoRig', label: 'Auto-rig as Humanoid' } } : {}),
  ...(boneNames.length > 0
    ? {
        selectedBone: { options: boneNames, label: 'Bone' },
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
    : {})
})

const cameraPoseControls: ConfigControlsSchema = {
  cameraGroundFeet: { checkbox: true, label: 'Keep Feet on Ground' },
  cameraUseDepth: { checkbox: true, label: 'Use Depth (Z Axis)' },
  cameraUseViewpoint: { checkbox: true, label: 'Match Camera Angle to Photo' },
  cameraShowPreview: { checkbox: true, label: 'Show Camera Preview' },
  cameraVideoSlowdownRatio: { ...CAMERA_VIDEO_SLOWDOWN_RATIO_RANGE, label: 'Video Slowdown Ratio' }
}

const cameraSmoothingControls: ConfigControlsSchema = {
  cameraSmoothingMilliseconds: {
    ...CAMERA_SMOOTHING_MILLISECONDS_RANGE,
    label: 'Landmarks Held Still (ms)'
  },
  cameraSpeedResponse: { ...CAMERA_SMOOTHING_SPEED_RESPONSE_RANGE, label: 'Let Go on Fast Moves' },
  cameraSpeedCutoffHertz: {
    ...CAMERA_SMOOTHING_SPEED_CUTOFF_RANGE,
    label: 'Speed Sensitivity (Hz)'
  },
  cameraTurnResponse: {
    ...CAMERA_SMOOTHING_TURN_RESPONSE_RANGE,
    label: 'Let Go on Fast Head Turns'
  },
  cameraMaxJump: { ...CAMERA_MAX_JUMP_RANGE, label: 'Max Jump per Frame (m)' },
  cameraBoneSmoothingMilliseconds: {
    ...CAMERA_BONE_SMOOTHING_MILLISECONDS_RANGE,
    label: 'Bones Settle (ms)'
  },
  cameraBoneMaxTurnSpeed: {
    ...CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND_RANGE,
    label: 'Max Joint Speed (°/s)'
  },
  cameraHandHoldMilliseconds: {
    ...CAMERA_HAND_HOLD_MILLISECONDS_RANGE,
    label: 'Hold a Lost Hand (ms)'
  },
  cameraHandFlipDegrees: { ...CAMERA_HAND_FLIP_DEGREES_RANGE, label: 'Palm Turn to Confirm (°)' },
  cameraVisibilityThreshold: {
    ...CAMERA_VISIBILITY_THRESHOLD_RANGE,
    label: 'Landmark Confidence Needed'
  },
  cameraTwistMinBendDegrees: {
    ...CAMERA_TWIST_BEND_DEGREES_RANGE,
    label: 'Roll Starts at Bend (°)'
  },
  cameraTwistFullBendDegrees: { ...CAMERA_TWIST_BEND_DEGREES_RANGE, label: 'Roll Full at Bend (°)' }
}

const cameraDetectControls: ConfigControlsSchema = {
  cameraTrackFace: { checkbox: true, label: 'Face Tracker for Head' },
  cameraSearchFaceAroundBody: { checkbox: true, label: 'Face Search Around Nose' },
  cameraTrackHands: { checkbox: true, label: 'Hand Tracker for Fingers' },
  cameraSearchHandsAroundWrists: { checkbox: true, label: 'Hand Search Around Wrists' },
  cameraSideHandsByWrist: { checkbox: true, label: 'Hand Side by Nearest Wrist' },
  cameraIgnoreOutsideImage: { checkbox: true, label: 'Ignore Body Outside Image' },
  cameraMirrorLive: { checkbox: true, label: 'Mirror Live Camera' },
  cameraDetectOnlyWhilePlaying: { checkbox: true, label: 'Only While Video Plays' }
}

const cameraBoneControls: ConfigControlsSchema = {
  cameraTurnHips: { checkbox: true, label: 'Turn Hips' },
  cameraBendSpine: { checkbox: true, label: 'Bend Spine' },
  cameraTurnHead: { checkbox: true, label: 'Turn Neck and Head' },
  cameraCorrectHeadPitch: { checkbox: true, label: 'Correct Ear and Nose Head Pitch' },
  cameraLimitHeadTurn: { checkbox: true, label: 'Ignore Impossible Head Turns' },
  cameraAimArms: { checkbox: true, label: 'Aim Arms' },
  cameraRollUpperArms: { checkbox: true, label: 'Roll Upper Arms from Elbows' },
  cameraRollForearms: { checkbox: true, label: 'Roll Forearms and Hands to Palms' },
  cameraPalmsFromBody: { checkbox: true, label: 'Palms from Body When No Hand Found' },
  cameraAimLegs: { checkbox: true, label: 'Aim Legs' },
  cameraRollThighs: { checkbox: true, label: 'Roll Thighs from Knees and Feet' },
  cameraAimFeet: { checkbox: true, label: 'Aim Feet' },
  cameraLimitJoints: { checkbox: true, label: 'Keep Joints in Human Range' },
  cameraFilterRollFlips: { checkbox: true, label: 'Ignore Rolls That Flip Over' }
}

const physicsControls = (physicsEnabled: boolean): ConfigControlsSchema => ({
  physicsEnabled: { checkbox: true, label: 'Simulate' },
  ...(physicsEnabled
    ? {
        marbleFlowEnabled: { checkbox: true, label: 'Spawn Marbles' },
        marbleSpawnInterval: { ...MARBLE_SPAWN_INTERVAL_RANGE, label: 'Marble Flow (Frames)' },
        marbleTextures: { checkbox: true, label: 'Marble Textures' },
        respawnMarbles: { callback: 'respawnMarbles', label: 'Reset Marbles' },
        enclosureSize: { ...ENCLOSURE_SIZE_RANGE, label: 'Wall Size' },
        enclosureOpacity: { ...ENCLOSURE_OPACITY_RANGE, label: 'Wall Opacity' }
      }
    : {})
})

/**
 * The rig panel's settings, one accordion section each, rebuilt whenever the bone list, the
 * auto-rig availability, camera capture readiness or physics changes, since those decide which
 * rows make sense to show. Playback, keyframes and import/export live on the rig timeline instead.
 * @param availability What the loaded rig supports right now
 * @returns The sections, in panel order, leaving out any with nothing to show
 */
export const buildRigPanelGroups = (availability: RigPanelAvailability): RigPanelGroup[] =>
  [
    { key: 'bone', label: 'Bone', schema: boneControls(availability) },
    ...(availability.canCaptureFromCamera
      ? [
          { key: 'cameraPose', label: 'Camera Pose', schema: cameraPoseControls },
          { key: 'cameraSmoothing', label: 'Camera Smoothing', schema: cameraSmoothingControls },
          { key: 'cameraDetect', label: 'Camera Detect', schema: cameraDetectControls },
          { key: 'cameraBones', label: 'Camera Bones', schema: cameraBoneControls }
        ]
      : []),
    { key: 'physics', label: 'Physics', schema: physicsControls(availability.physicsEnabled) },
    {
      key: 'timeline',
      label: 'Timeline',
      schema: { fps: { min: 1, max: 60, step: 1, label: 'FPS' } }
    }
  ].filter((group) => Object.keys(group.schema).length > 0)
