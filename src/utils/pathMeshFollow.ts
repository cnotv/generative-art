import * as THREE from 'three'
import { logicAdvanceAlongPath } from '@webgamekit/logic'
import type { PathFollowState, PathFollowResult } from '@webgamekit/logic'

/**
 * Advances a Three.js mesh along a path by speed × delta world-units and
 * updates the mesh's position and Y rotation to match.
 * Purely functional — returns a new PathFollowResult without mutating the state.
 * @param mesh - The Three.js object to reposition
 * @param state - Current path-follow state (waypoints, index, progress)
 * @param speed - World units per second
 * @param delta - Seconds elapsed this frame
 * @returns Updated follow result including new state and completion flag
 */
export const pathAdvanceMesh = (
  mesh: THREE.Object3D,
  state: PathFollowState,
  speed: number,
  delta: number
): PathFollowResult => {
  const result = logicAdvanceAlongPath(state, speed, delta)
  mesh.position.set(result.position.x, result.position.y, result.position.z)
  mesh.rotation.y = result.rotation
  return result
}
