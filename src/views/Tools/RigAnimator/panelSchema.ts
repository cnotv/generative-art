import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { MODEL_FILE_ACCEPT, POSITION_STEP_FRACTION, ROTATION_CONTROL } from './config'

/**
 * Build the config panel schema for the rig animator. Rebuilt whenever the bone list or the
 * auto-rig availability changes, since those decide which rows even make sense to show. Frame
 * scheduling and import/export (playback, keyframes, the frame axis, poses in and GLB/JSON out)
 * live on the dedicated rig timeline instead of in this panel.
 * @param boneNames Every bone in the loaded rig, empty when nothing is rigged yet
 * @param needsAutoRig Whether the loaded model has meshes but no skeleton
 * @param canCaptureFromCamera Whether the loaded rig has every bone camera pose capture needs
 * @param positionRange The +/- range the Bone Position field offers, scaled to the loaded rig
 * @returns The schema to hand to registerViewConfig/updateViewSchema
 */
export const buildRigAnimatorSchema = (
  boneNames: string[],
  needsAutoRig: boolean,
  canCaptureFromCamera: boolean,
  positionRange: number
): ConfigControlsSchema => ({
  model: { file: MODEL_FILE_ACCEPT, label: 'Upload Model' },
  ...(needsAutoRig
    ? { autoRig: { callback: 'autoRig', label: 'Auto-rig as Humanoid', sectionStart: true } }
    : {}),
  ...(canCaptureFromCamera
    ? {
        captureFromCamera: {
          callback: 'captureFromCamera',
          label: 'Capture Pose from Camera',
          sectionStart: true
        }
      }
    : {}),
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
  fps: { min: 1, max: 60, step: 1, label: 'FPS', sectionStart: true }
})
