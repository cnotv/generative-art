import RAPIER from '@dimforge/rapier3d-compat'
import { TRACK_CONTACT_SKIN } from './config'
import type { TrackColliderSpec } from './types'

export type MergedColliders = {
  bodies: RAPIER.RigidBody[]
  dispose: () => void
}

type ColliderGroup = { friction: number; restitution: number; vertices: number[] }

// Colliders that share the same friction and restitution can be one body:
// their triangles are welded into a single mesh so there are no seams between
// pieces of the same surface class (deck, wall, loop ring, ...).
const groupKey = (spec: TrackColliderSpec): string => `${spec.friction}:${spec.restitution}`

const groupSpecs = (specs: TrackColliderSpec[]): ColliderGroup[] => {
  const groups = new Map<string, ColliderGroup>()
  specs.forEach((spec) => {
    const key = groupKey(spec)
    const group = groups.get(key) ?? {
      friction: spec.friction,
      restitution: spec.restitution,
      vertices: []
    }
    group.vertices.push(...spec.triangles)
    groups.set(key, group)
  })
  return [...groups.values()]
}

const createGroupBody = (world: RAPIER.World, group: ColliderGroup): RAPIER.RigidBody => {
  const vertices = new Float32Array(group.vertices)
  const indices = Uint32Array.from({ length: vertices.length / 3 }, (_, index) => index)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  // FIX_INTERNAL_EDGES merges duplicate vertices (welding flush junctions into
  // one continuous surface) and corrects contact normals across every internal
  // edge, so the marble rolls over piece seams without catching.
  const colliderDesc = RAPIER.ColliderDesc.trimesh(
    vertices,
    indices,
    RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES
  )
    .setFriction(group.friction)
    .setRestitution(group.restitution)
    .setContactSkin(TRACK_CONTACT_SKIN)
  world.createCollider(colliderDesc, body)
  return body
}

/**
 * Builds the track's physics as a handful of merged trimesh colliders, one per
 * distinct (friction, restitution) surface class, instead of one collider per
 * piece. Welding removes the piece-to-piece seams that made a marble catch or
 * snag at track-part edges.
 *
 * @param world The Rapier world
 * @param specs World-space collider triangles collected from every piece
 * @returns The created bodies and a dispose that removes them
 */
export const buildMergedTrackColliders = (
  world: RAPIER.World,
  specs: TrackColliderSpec[]
): MergedColliders => {
  const bodies = groupSpecs(specs)
    .filter((group) => group.vertices.length > 0)
    .map((group) => createGroupBody(world, group))
  return {
    bodies,
    dispose: () => bodies.forEach((body) => world.removeRigidBody(body))
  }
}
