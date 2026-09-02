import type { ConfigControlsSchema } from '@/stores/viewConfig'
import {
  DEFAULT_FRAME_MAX,
  MODEL_FILE_ACCEPT,
  POSES_FILE_ACCEPT,
  POSITION_STEP_FRACTION,
  ROTATION_CONTROL
} from './config'

/**
 * Build the config panel schema for the rig animator. Rebuilt whenever the bone list, the
 * keyframe list or the auto-rig availability changes, since those decide which rows even
 * make sense to show. Playback itself lives on the shared Timeline panel, which also draws
 * every pose keyframe as a bar over the frame axis; this schema only authors them.
 * @param boneNames Every bone in the loaded rig, empty when nothing is rigged yet
 * @param keyframeFrames Every frame a pose keyframe already exists at
 * @param needsAutoRig Whether the loaded model has meshes but no skeleton
 * @param positionRange The +/- range the Bone Position field offers, scaled to the loaded rig
 * @returns The schema to hand to registerViewConfig/updateViewSchema
 */
export const buildRigAnimatorSchema = (
  boneNames: string[],
  keyframeFrames: number[],
  needsAutoRig: boolean,
  positionRange: number
): ConfigControlsSchema => ({
  model: { file: MODEL_FILE_ACCEPT, label: 'Upload Model' },
  ...(needsAutoRig
    ? { autoRig: { callback: 'autoRig', label: 'Auto-rig as Humanoid', sectionStart: true } }
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
        resetBone: { callback: 'resetBone', label: 'Reset Bone to Rest Pose' }
      }
    : {}),
  frame: {
    min: 0,
    max: Math.max(DEFAULT_FRAME_MAX, ...keyframeFrames, 0),
    step: 1,
    label: 'Frame',
    sectionStart: true
  },
  fps: { min: 1, max: 60, step: 1, label: 'FPS' },
  addKeyframe: { callback: 'addKeyframe', label: 'Add Keyframe at Frame' },
  ...(keyframeFrames.length > 0
    ? { deleteKeyframe: { callback: 'deleteKeyframe', label: 'Delete Keyframe at Frame' } }
    : {}),
  poses: { file: POSES_FILE_ACCEPT, label: 'Import Poses (JSON)', sectionStart: true },
  exportGlb: { callback: 'exportGlb', label: 'Export GLB' },
  exportJson: { callback: 'exportJson', label: 'Export JSON' }
})
