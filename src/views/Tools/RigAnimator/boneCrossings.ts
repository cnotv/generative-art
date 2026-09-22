import type * as THREE from 'three'
import { RIG_BONE_CROSSING_PAIRS } from './config'

/**
 * How far apart two bones are in world space, read straight off their world matrices rather than
 * through `getWorldPosition`, which would allocate a vector per bone on every frame of a capture.
 */
const worldDistance = (first: THREE.Object3D, second: THREE.Object3D): number => {
  const from = first.matrixWorld.elements
  const to = second.matrixWorld.elements
  return Math.hypot(from[12] - to[12], from[13] - to[13], from[14] - to[14])
}

/**
 * How far apart each watched pair stands in the rig's own rest pose, which is what every later
 * reading is judged against.
 *
 * A single distance cannot serve every pair: a rig stands with its feet almost touching and its
 * arms out wide, so a threshold loose enough to catch a hand reaching the head calls those feet
 * crossed while the rig is still standing still. Each pair's own rest distance is the only
 * measurement that knows the difference.
 * @param bones The rig's bones, standing at rest with up-to-date world matrices
 * @returns Each watched pair's rest distance, keyed by the pair's label
 */
export const boneCrossingRestDistances = (bones: THREE.Bone[]): Map<string, number> => {
  const boneByName = new Map(bones.map((bone) => [bone.name, bone]))
  return new Map(
    RIG_BONE_CROSSING_PAIRS.flatMap(({ first, second, label }) => {
      const from = boneByName.get(first)
      const to = boneByName.get(second)
      return from && to ? [[label, worldDistance(from, to)] as [string, number]] : []
    })
  )
}

/**
 * Which watched pairs have closed to a fraction of how far apart they stand at rest: hands
 * meeting each other or the head, forearms through one another, feet through one another. A rig
 * whose reach does not match the performer's drives itself into exactly those poses, and they
 * are hard to spot while a capture is running and the whole body is moving.
 *
 * Read off the world matrices as the last render left them, so a pose applied since then shows
 * on the next frame rather than this one; over a running capture that is invisible.
 * @param bones The rig's bones
 * @param restDistances Each pair's rest distance, from `boneCrossingRestDistances`
 * @param closedFraction How far a pair must close, as a share of its rest distance, to report
 * @returns One readable line per crossing found, empty when the rig is clear
 */
export const findBoneCrossings = (
  bones: THREE.Bone[],
  restDistances: Map<string, number>,
  closedFraction: number
): string[] => {
  const boneByName = new Map(bones.map((bone) => [bone.name, bone]))
  return RIG_BONE_CROSSING_PAIRS.flatMap(({ first, second, label }) => {
    const from = boneByName.get(first)
    const to = boneByName.get(second)
    const restDistance = restDistances.get(label)
    if (!from || !to || !restDistance) return []
    return worldDistance(from, to) < restDistance * closedFraction ? [label] : []
  })
}
