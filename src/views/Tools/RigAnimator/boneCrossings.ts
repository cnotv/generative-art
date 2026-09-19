import type * as THREE from 'three'
import { RIG_BONE_CROSSING_PAIRS } from './config'
import { boneSlotLabel, resolveBoneName } from './boneMapping'
import type { RigBoneMapping } from './types'

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
 * Which watched bone pairs are currently close enough to read as crossed: hands meeting each
 * other or the head, forearms through one another, feet through one another. Two slots mapped to
 * the wrong bones drive the rig into exactly those poses, and they are hard to spot while a
 * capture is running and the whole rig is moving.
 *
 * Read off the world matrices as the last render left them, so a pose applied since then shows
 * on the next frame rather than this one; over a running capture that is invisible.
 * @param bones The rig's bones
 * @param mapping Which bone plays each canonical role
 * @param minimumDistance How close two bones may come before they count as crossed
 * @returns One readable line per crossing found, empty when the rig is clear
 */
export const findBoneCrossings = (
  bones: THREE.Bone[],
  mapping: RigBoneMapping,
  minimumDistance: number
): string[] => {
  const boneByName = new Map(bones.map((bone) => [bone.name, bone]))
  return RIG_BONE_CROSSING_PAIRS.flatMap(([firstCanonical, secondCanonical]) => {
    const first = boneByName.get(resolveBoneName(mapping, firstCanonical))
    const second = boneByName.get(resolveBoneName(mapping, secondCanonical))
    if (!first || !second || worldDistance(first, second) >= minimumDistance) return []
    return [`${boneSlotLabel(firstCanonical)} meets ${boneSlotLabel(secondCanonical)}`]
  })
}
