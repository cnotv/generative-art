import * as THREE from 'three'
import type { ComplexModel } from './types'

/**
 * Copy a rigid body's transform onto the mesh that represents it.
 *
 * Rapier and Three.js keep separate transforms: stepping the world moves the body, and nothing
 * moves the mesh until someone copies it across. Without this every dynamic object simulates
 * correctly and renders frozen, which looks like broken input rather than a missing sync.
 * @param mesh A model carrying a rigid body on its userData
 * @param verticalOffset Added to the y position, for meshes whose origin is not their centre
 */
export const syncMeshWithBody = (mesh: ComplexModel, verticalOffset = 0): void => {
  const body = mesh.userData?.body
  if (!body) return

  const position = body.translation()
  mesh.position.set(position.x, position.y + verticalOffset, position.z)

  const rotation = body.rotation()
  mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
}

/**
 * Copy every listed body's transform onto its mesh. Call once per frame, before rendering.
 * @param meshes The models to sync
 * @param verticalOffset Added to each y position
 */
export const syncMeshesWithBodies = (meshes: readonly ComplexModel[], verticalOffset = 0): void => {
  meshes.forEach((mesh) => syncMeshWithBody(mesh, verticalOffset))
}

/**
 * Whether a mesh has a rigid body to sync from.
 * @param mesh The model to check
 * @returns True when a body is attached
 */
export const hasPhysicsBody = (mesh: THREE.Object3D): boolean =>
  Boolean((mesh as ComplexModel).userData?.body)
