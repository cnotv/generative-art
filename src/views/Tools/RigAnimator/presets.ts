import * as THREE from 'three'
import { fbxLoader } from '@webgamekit/threejs'
import type { PoseKeyframe, Pose } from '@webgamekit/rig'

/** A bundled example animation, picked from the rig timeline to evaluate it with real motion. */
export interface RigPreset {
  name: string
  url: string
}

export const RIG_PRESETS: RigPreset[] = [
  { name: 'Idle', url: '/animations/idle.fbx' },
  { name: 'Jump', url: '/animations/jump.fbx' },
  { name: 'Kick', url: '/animations/kick.fbx' },
  { name: 'Punch', url: '/animations/punch.fbx' },
  { name: 'Roll', url: '/animations/roll.fbx' },
  { name: 'Running', url: '/animations/running.fbx' },
  { name: 'Walk', url: '/animations/walk2.fbx' }
]

const QUATERNION_TRACK_SUFFIX = '.quaternion'
const PRESET_SAMPLE_COUNT = 12

/**
 * Sample an animation clip's quaternion tracks into a sparse set of pose keyframes: a mocap
 * clip carries far more keyframes than this tool's sparse pose-keyframe model is meant to show,
 * so this reads a fixed number of evenly-spaced instants instead of every original frame.
 * @param clip The clip to sample, however many frames it originally carried
 * @param fps Frames per second used to convert the clip's own time into this tool's frame numbers
 * @returns The sampled keyframes, ordered by frame
 */
export const sampleClipAsPoseKeyframes = (
  clip: THREE.AnimationClip,
  fps: number
): PoseKeyframe[] => {
  const interpolants = clip.tracks
    .filter((track) => track.name.endsWith(QUATERNION_TRACK_SUFFIX))
    .map((track) => ({
      boneName: track.name.slice(0, -QUATERNION_TRACK_SUFFIX.length),
      interpolant: track.createInterpolant()
    }))
  return Array.from({ length: PRESET_SAMPLE_COUNT }, (_, index) => {
    const time = (clip.duration * index) / Math.max(1, PRESET_SAMPLE_COUNT - 1)
    const pose = interpolants.reduce<Pose>((accumulated, { boneName, interpolant }) => {
      const [x, y, z, w] = interpolant.evaluate(time)
      return { ...accumulated, [boneName]: { x, y, z, w } }
    }, {})
    return { frame: Math.round(time * fps), pose }
  })
}

/**
 * Load a bundled example animation FBX and sample it into pose keyframes for this rig.
 * @param url The preset's public URL
 * @param fps Frames per second to convert the clip's own time into this tool's frame numbers
 * @returns The sampled keyframes, or an empty array when the file carries no animation clip
 */
export const loadRigPreset = async (url: string, fps: number): Promise<PoseKeyframe[]> => {
  const fbx = await fbxLoader.loadAsync(url)
  const clip = fbx.animations[0]
  return clip ? sampleClipAsPoseKeyframes(clip, fps) : []
}
