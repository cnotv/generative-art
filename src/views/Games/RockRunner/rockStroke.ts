import * as THREE from 'three'
import {
  ROCK_STROKE_NAME,
  ROCK_STROKE_SEGMENTS,
  ROCK_STROKE_WOBBLE_TERMS,
  STROKE_COLOR
} from './config'

/**
 * How far a point on the hull is pushed out beyond the rock's surface.
 *
 * Read from the direction the point sits in rather than from any per-vertex
 * index, which is what keeps the hull whole. A sphere duplicates its vertices
 * down the texture seam and stacks a whole ring of them at each pole, and any
 * displacement that differs between two vertices sharing a position tears the
 * mesh open there — the same failure the rock's own displacement map has to be
 * kept small to avoid. Two vertices in the same place are in the same
 * direction, so this cannot disagree with itself.
 *
 * @param direction - Unit direction of the point from the rock's centre
 * @param thickness - Base thickness of the outline
 * @param wobble - How much the thickness is allowed to vary, as a fraction
 * @returns The distance beyond the surface to place the point
 */
export const strokeThicknessAt = (
  direction: THREE.Vector3,
  thickness: number,
  wobble: number
): number => {
  const variation = ROCK_STROKE_WOBBLE_TERMS.reduce(
    (total, term) =>
      total +
      term.amplitude *
        Math.sin(direction.x * term.frequency + term.phase) *
        Math.cos(direction.y * term.frequency - term.phase) *
        Math.sin(direction.z * term.frequency + term.phase * 2),
    0
  )
  return Math.max(0, thickness * (1 + variation * wobble))
}

/**
 * Builds the inverted hull that outlines the rock.
 *
 * A grown copy of the ball drawn back-faces-only: the rock itself covers the
 * hull's inside, so all that survives is a rim around the silhouette. That is
 * the same trick the debris chips use, and it is preferred to a post-process
 * outline pass because it costs one extra draw call and produces a hard edge
 * rather than a soft halo.
 *
 * The radius is left at one and the mesh scaled by its parent instead, so a rock
 * resized from the panel takes its outline with it without a rebuild.
 *
 * @param thickness - Base thickness of the outline, relative to a unit rock
 * @param wobble - How much that thickness varies around the ball
 * @returns Geometry for the hull, in unit-rock space
 */
export const buildRockStrokeGeometry = (
  thickness: number,
  wobble: number
): THREE.BufferGeometry => {
  const geometry = new THREE.SphereGeometry(1, ROCK_STROKE_SEGMENTS, ROCK_STROKE_SEGMENTS / 2)
  const position = geometry.getAttribute('position')
  const direction = new THREE.Vector3()
  Array.from({ length: position.count }).forEach((_, index) => {
    direction.fromBufferAttribute(position, index).normalize()
    const distance = 1 + strokeThicknessAt(direction, thickness, wobble)
    position.setXYZ(index, direction.x * distance, direction.y * distance, direction.z * distance)
  })
  position.needsUpdate = true
  // No normals: the material is unlit, so nothing reads them, and recomputing
  // them across a wobbled hull is work with no visible result.
  geometry.deleteAttribute('normal')
  return geometry
}

/**
 * Attaches an outline to a rock, replacing any it already carries.
 *
 * Parented to the rock rather than tracked alongside it, so it inherits position,
 * rotation and scale for free and is removed when the rock is.
 *
 * @param rock - The rock mesh to outline
 * @param thickness - Base thickness of the outline
 * @param wobble - How much that thickness varies around the ball
 * @returns The hull mesh now parented to the rock
 */
export const attachRockStroke = (
  rock: THREE.Object3D,
  thickness: number,
  wobble: number
): THREE.Mesh => {
  const existing = rock.getObjectByName(ROCK_STROKE_NAME)
  if (existing instanceof THREE.Mesh) {
    rock.remove(existing)
    existing.geometry.dispose()
    if (existing.material instanceof THREE.Material) existing.material.dispose()
  }
  const hull = new THREE.Mesh(
    buildRockStrokeGeometry(thickness, wobble),
    new THREE.MeshBasicMaterial({ color: STROKE_COLOR, side: THREE.BackSide })
  )
  hull.name = ROCK_STROKE_NAME
  hull.castShadow = false
  hull.receiveShadow = false
  rock.add(hull)
  return hull
}
