import * as THREE from 'three'
import type { Pose, PoseKeyframe } from './types'

/**
 * Snapshot every bone's current local rotation into a plain pose object.
 * @param bones The rig's bones, in any order
 * @returns A pose keyed by bone name, safe to serialize
 */
export const poseCapture = (bones: THREE.Bone[]): Pose =>
  bones.reduce<Pose>((pose, bone) => {
    const { x, y, z, w } = bone.quaternion
    return { ...pose, [bone.name]: { x, y, z, w } }
  }, {})

/**
 * Rotate every bone in a rig to match a captured pose. Bones missing from the pose are left
 * untouched, so a partial pose only moves the bones it names.
 * @param bones The rig's bones to rotate
 * @param pose The pose to apply
 */
export const poseApply = (bones: THREE.Bone[], pose: Pose): void => {
  bones.forEach((bone) => {
    const rotation = pose[bone.name]
    if (rotation) bone.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  })
}

/** Keyframes ordered earliest first, required for a valid Three.js keyframe track */
const sortKeyframesByFrame = (keyframes: PoseKeyframe[]): PoseKeyframe[] =>
  [...keyframes].sort((a, b) => a.frame - b.frame)

/** Build one bone's rotation track from every keyframe that posed it */
const buildBoneTrack = (
  boneName: string,
  sortedKeyframes: PoseKeyframe[],
  fps: number
): THREE.QuaternionKeyframeTrack | null => {
  const posedKeyframes = sortedKeyframes.filter((keyframe) => keyframe.pose[boneName])
  if (posedKeyframes.length === 0) return null

  const times = posedKeyframes.map((keyframe) => keyframe.frame / fps)
  const values = posedKeyframes.flatMap((keyframe) => {
    const { x, y, z, w } = keyframe.pose[boneName]
    return [x, y, z, w]
  })
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values)
}

/**
 * Build a playable clip from an ordered set of pose keyframes. Three.js interpolates between
 * consecutive poses on its own, so no custom tweening is needed here.
 * @param keyframes The poses to connect, in any order (sorted internally by frame)
 * @param boneNames Every bone the clip should carry a track for
 * @param fps Frames per second used to convert keyframe frames into clip time
 * @param clipName Name the resulting clip is stored under
 * @returns An AnimationClip ready for an AnimationMixer or a GLTFExporter
 */
export const poseBuildClip = (
  keyframes: PoseKeyframe[],
  boneNames: string[],
  fps: number,
  clipName = 'GeneratedClip'
): THREE.AnimationClip => {
  const sortedKeyframes = sortKeyframesByFrame(keyframes)
  const tracks = boneNames
    .map((boneName) => buildBoneTrack(boneName, sortedKeyframes, fps))
    .filter((track): track is THREE.QuaternionKeyframeTrack => track !== null)
  return new THREE.AnimationClip(clipName, -1, tracks)
}
