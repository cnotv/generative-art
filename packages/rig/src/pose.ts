import * as THREE from 'three'
import type { Pose, PoseKeyframe, Vector3Data } from './types'

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
 * Snapshot the skeleton root's local position. The root is the only bone whose translation
 * belongs to the animation: every other bone's position is part of the rig's proportions.
 * @param bones The rig's bones, in any order
 * @returns The root's position keyed by its name, or an empty object for an empty rig
 */
export const poseCaptureRootPosition = (bones: THREE.Bone[]): Record<string, Vector3Data> =>
  bones
    .filter((bone) => !(bone.parent instanceof THREE.Bone))
    .reduce<Record<string, Vector3Data>>((positions, bone) => {
      const { x, y, z } = bone.position
      return { ...positions, [bone.name]: { x, y, z } }
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

/**
 * Move every bone named in `positions` to its captured local position; other bones stay put.
 * @param bones The rig's bones to move
 * @param positions Local positions keyed by bone name
 */
export const poseApplyPositions = (
  bones: THREE.Bone[],
  positions: Record<string, Vector3Data>
): void => {
  bones.forEach((bone) => {
    const position = positions[bone.name]
    if (position) bone.position.set(position.x, position.y, position.z)
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

/** Build one bone's position track from every keyframe that carries a position for it */
const buildBonePositionTrack = (
  boneName: string,
  sortedKeyframes: PoseKeyframe[],
  fps: number
): THREE.VectorKeyframeTrack | null => {
  const positionedKeyframes = sortedKeyframes.filter((keyframe) => keyframe.positions?.[boneName])
  if (positionedKeyframes.length === 0) return null

  const times = positionedKeyframes.map((keyframe) => keyframe.frame / fps)
  const values = positionedKeyframes.flatMap((keyframe) => {
    const position = keyframe.positions?.[boneName]
    return position ? [position.x, position.y, position.z] : []
  })
  return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values)
}

/**
 * Build a playable clip from an ordered set of pose keyframes. Three.js interpolates between
 * consecutive poses on its own, so no custom tweening is needed here.
 * @param keyframes The poses to connect, in any order (sorted internally by frame)
 * @param boneNames Every bone the clip should carry a track for
 * @param fps Frames per second used to convert keyframe frames into clip time
 * @param clipName Name the resulting clip is stored under
 * @returns An AnimationClip with every rotation track, then a position track for each bone whose
 *   keyframes carry one, ready for an AnimationMixer or a GLTFExporter
 */
export const poseBuildClip = (
  keyframes: PoseKeyframe[],
  boneNames: string[],
  fps: number,
  clipName = 'GeneratedClip'
): THREE.AnimationClip => {
  const sortedKeyframes = sortKeyframesByFrame(keyframes)
  const rotationTracks = boneNames
    .map((boneName) => buildBoneTrack(boneName, sortedKeyframes, fps))
    .filter((track): track is THREE.QuaternionKeyframeTrack => track !== null)
  const positionTracks = boneNames
    .map((boneName) => buildBonePositionTrack(boneName, sortedKeyframes, fps))
    .filter((track): track is THREE.VectorKeyframeTrack => track !== null)
  return new THREE.AnimationClip(clipName, -1, [...rotationTracks, ...positionTracks])
}
