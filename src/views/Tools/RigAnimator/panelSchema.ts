import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { POSITION_STEP_FRACTION, ROTATION_CONTROL } from './config'

/**
 * Build the config panel schema for the rig animator. Rebuilt whenever the bone list or the
 * auto-rig availability changes, since those decide which rows even make sense to show. Frame
 * scheduling and import/export (playback, keyframes, the frame axis, poses in and GLB/JSON out)
 * live on the dedicated rig timeline instead of in this panel. Uploading a model and capturing a
 * pose from the camera are both triggered from buttons docked on the canvas itself instead of a
 * panel row, since both are about what is happening in the 3D view rather than a setting.
 * @param boneNames Every bone in the loaded rig, empty when nothing is rigged yet
 * @param needsAutoRig Whether the loaded model has meshes but no skeleton
 * @param positionRange The +/- range the Bone Position field offers, scaled to the loaded rig
 * @param canCaptureFromCamera Whether the loaded rig has the bones camera pose capture needs
 * @returns The schema to hand to registerViewConfig/updateViewSchema
 */
export const buildRigAnimatorSchema = (
  boneNames: string[],
  needsAutoRig: boolean,
  positionRange: number,
  canCaptureFromCamera: boolean
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
        cameraUseHips: { checkbox: true, label: 'Camera Pose: Move Hips to Photo' },
        cameraUseDepth: { checkbox: true, label: 'Camera Pose: Use Depth (Z Axis)' }
      }
    : {}),
  fps: { min: 1, max: 60, step: 1, label: 'FPS', sectionStart: true }
})
