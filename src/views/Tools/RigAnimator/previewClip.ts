import * as THREE from 'three'
import { poseBuildClip, type PoseKeyframe } from '@webgamekit/rig'

/**
 * Build the mixer and action that play the authored keyframes on the rig, already started.
 *
 * Every bone's track is rebuilt from the whole keyframe list, so this costs more the longer that
 * list is: a burst of captures batches one call at the end rather than paying it per keyframe.
 * @param skinnedMesh The mesh the clip drives
 * @param keyframes The authored keyframes
 * @param boneNames Every bone name the clip may carry a track for
 * @param fps The rate the keyframes were authored at
 * @returns The mixer and its playing action, or null when there is nothing to play
 */
export const buildPreviewClipMixer = (
  skinnedMesh: THREE.SkinnedMesh | null,
  keyframes: PoseKeyframe[],
  boneNames: string[],
  fps: number
): { mixer: THREE.AnimationMixer; action: THREE.AnimationAction } | null => {
  if (!skinnedMesh || keyframes.length === 0) return null
  const mixer = new THREE.AnimationMixer(skinnedMesh)
  const action = mixer.clipAction(poseBuildClip(keyframes, boneNames, fps))
  action.play()
  return { mixer, action }
}
