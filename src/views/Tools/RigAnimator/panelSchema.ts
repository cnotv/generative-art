import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { DEFAULT_FRAME_MAX, MODEL_FILE_ACCEPT, POSES_FILE_ACCEPT, ROTATION_CONTROL } from './config'

/**
 * Build the config panel schema for the rig animator. Rebuilt whenever the bone list, the
 * keyframe list, the auto-rig availability or the playback state changes, since those decide
 * which rows even make sense to show.
 * @param boneNames Every bone in the loaded rig, empty when nothing is rigged yet
 * @param keyframeFrames Every frame a pose keyframe already exists at
 * @param needsAutoRig Whether the loaded model has meshes but no skeleton
 * @param isPlaying Whether the preview clip is currently playing
 * @returns The schema to hand to registerViewConfig/updateViewSchema
 */
export const buildRigAnimatorSchema = (
  boneNames: string[],
  keyframeFrames: number[],
  needsAutoRig: boolean,
  isPlaying: boolean
): ConfigControlsSchema => ({
  model: { file: MODEL_FILE_ACCEPT, label: 'Upload Model' },
  ...(needsAutoRig
    ? { autoRig: { callback: 'autoRig', label: 'Auto-rig as Humanoid', sectionStart: true } }
    : {}),
  ...(boneNames.length > 0
    ? {
        selectedBone: { options: boneNames, label: 'Bone', sectionStart: true },
        boneRotation: ROTATION_CONTROL
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
  togglePlayback: { callback: 'togglePlayback', label: isPlaying ? 'Pause' : 'Play Preview' },
  poses: { file: POSES_FILE_ACCEPT, label: 'Import Poses (JSON)', sectionStart: true },
  exportGlb: { callback: 'exportGlb', label: 'Export GLB' },
  exportJson: { callback: 'exportJson', label: 'Export JSON' }
})
