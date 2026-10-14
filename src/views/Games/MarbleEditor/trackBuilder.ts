import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { disposeObject } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import { computeChainTransforms, applyPieceTransform } from './chainTransforms'
import { buildPieceModels, collectPieceColliderSpecs } from './pieceGeometry'
import { buildMergedTrackColliders } from './trackColliders'
import type { MarbleMap, PieceTransform, BuiltTrack, BoostZone } from './types'
import {
  LANE_WIDTH,
  DECK_THICKNESS,
  SPAWN_HEIGHT,
  SPAWN_Z_INSET,
  SPAWN_LANE_MARGIN,
  FINISH_LENGTH,
  FINISH_CHECK_RADIUS,
  FINISH_CHECK_HEIGHT,
  BOOST_PAD_LENGTH,
  BOOST_ZONE_MAX_HEIGHT,
  CHECKPOINT_RADIUS
} from './config'

const ORIGIN: PieceTransform = { position: [0, 0, 0], yaw: 0 }

/**
 * Spreads the marbles' spawn points evenly across the start piece's lane.
 * @param startTransform The start piece's position and turn, or null for the origin.
 * @param count How many marbles.
 * @returns One spawn point per marble.
 */
export const computeSpawnPositions = (
  startTransform: PieceTransform | null,
  count: number
): CoordinateTuple[] => {
  const transform = startTransform ?? ORIGIN
  const usableWidth = LANE_WIDTH - 2 * SPAWN_LANE_MARGIN
  return Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? 0.5 : index / (count - 1)
    const localX = -usableWidth / 2 + fraction * usableWidth
    return applyPieceTransform(transform, [localX, SPAWN_HEIGHT, SPAWN_Z_INSET])
  })
}

/**
 * The middle of the finish piece's zone.
 * @param finishTransform The finish piece's position and turn.
 * @returns The zone's centre in world space.
 */
export const finishZoneCenter = (finishTransform: PieceTransform): CoordinateTuple =>
  applyPieceTransform(finishTransform, [0, 0, -FINISH_LENGTH / 2])

/**
 * Says whether a marble is inside the finish zone.
 * @param position The marble's position.
 * @param finishTransform The finish piece's position and turn, or null without one.
 * @returns True inside the zone.
 */
export const isInFinishZone = (
  position: { x: number; y: number; z: number },
  finishTransform: PieceTransform | null
): boolean => {
  if (!finishTransform) return false
  const [centerX, centerY, centerZ] = finishZoneCenter(finishTransform)
  const withinHeight =
    position.y > centerY - DECK_THICKNESS && position.y < centerY + FINISH_CHECK_HEIGHT
  return (
    withinHeight && Math.hypot(position.x - centerX, position.z - centerZ) < FINISH_CHECK_RADIUS
  )
}

/**
 * Says whether a marble is over a boost pad, in the pad's own frame.
 * @param position The marble's position.
 * @param zone The pad's position, turn and size.
 * @returns True over the pad.
 */
export const isOnBoostZone = (
  position: { x: number; y: number; z: number },
  zone: BoostZone
): boolean => {
  const deltaX = position.x - zone.position[0]
  const deltaZ = position.z - zone.position[2]
  const cos = Math.cos(zone.yaw)
  const sin = Math.sin(zone.yaw)
  const localX = deltaX * cos - deltaZ * sin
  const localZ = deltaX * sin + deltaZ * cos
  const withinHeight =
    position.y >= zone.position[1] && position.y <= zone.position[1] + BOOST_ZONE_MAX_HEIGHT
  return Math.abs(localX) <= zone.width / 2 && Math.abs(localZ) <= zone.length / 2 && withinHeight
}

/**
 * The furthest piece ahead of the current checkpoint that the marble is near, so checkpoints only
 * move forward.
 * @param position The marble's position on the ground plane.
 * @param transforms Each piece's position and turn.
 * @param currentIndex The checkpoint reached so far.
 * @returns The new checkpoint index.
 */
export const nearestCheckpointIndex = (
  position: { x: number; z: number },
  transforms: PieceTransform[],
  currentIndex: number
): number =>
  transforms.reduce((best, transform, index) => {
    if (index <= best) return best
    const distance = Math.hypot(
      position.x - transform.position[0],
      position.z - transform.position[2]
    )
    return distance < CHECKPOINT_RADIUS ? index : best
  }, currentIndex)

const boostZoneFromTransform = (transform: PieceTransform): BoostZone => ({
  position: applyPieceTransform(transform, [0, 0, -BOOST_PAD_LENGTH / 2]),
  yaw: transform.yaw,
  length: BOOST_PAD_LENGTH,
  width: LANE_WIDTH
})

/**
 * Builds a map's pieces into the scene with merged colliders, and finds its start, finish and boost
 * pads.
 * @param scene The scene to build in.
 * @param world The physics world for the colliders.
 * @param map The map.
 * @returns The pieces' transforms, the start and finish, the boost zones, and dispose.
 */
export const buildTrack = (scene: THREE.Scene, world: RAPIER.World, map: MarbleMap): BuiltTrack => {
  const transforms = computeChainTransforms(map.pieces)
  const models = map.pieces.flatMap((piece, index) =>
    buildPieceModels(scene, piece, transforms[index])
  )
  const colliderSpecs = map.pieces.flatMap((piece, index) =>
    collectPieceColliderSpecs(piece, transforms[index])
  )
  const colliders = buildMergedTrackColliders(world, colliderSpecs)
  const startIndex = map.pieces.findIndex((piece) => piece.type === 'start')
  const finishIndex = map.pieces.findIndex((piece) => piece.type === 'finish')
  const boostZones = map.pieces.flatMap((piece, index) =>
    piece.type === 'boost-pad' ? [boostZoneFromTransform(transforms[index])] : []
  )
  const dispose = (): void => {
    models.forEach((model) => {
      scene.remove(model)
      disposeObject(model)
    })
    colliders.dispose()
  }
  return {
    models,
    transforms,
    startTransform: startIndex >= 0 ? transforms[startIndex] : null,
    finishTransform: finishIndex >= 0 ? transforms[finishIndex] : null,
    boostZones,
    dispose
  }
}
