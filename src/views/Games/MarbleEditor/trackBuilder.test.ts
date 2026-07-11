import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  buildTrack,
  computeSpawnPositions,
  isInFinishZone,
  finishZoneCenter,
  isOnBoostZone,
  nearestCheckpointIndex
} from './trackBuilder'
import { LANE_WIDTH, SPAWN_HEIGHT, FINISH_LENGTH, FINISH_CHECK_RADIUS } from './config'
import type { CoordinateTuple } from '@webgamekit/animation'
import type { MarbleMap, PlacedPiece, TrackPieceType, PieceTransform } from './types'

const makeMap = (types: TrackPieceType[]): MarbleMap => ({
  version: 1,
  name: 'test',
  updatedAt: 0,
  pieces: types.map(
    (type, index): PlacedPiece => ({ id: `${type}-${index}`, type, color: 0x808080 })
  )
})

describe('computeSpawnPositions', () => {
  const startTransform: PieceTransform = { position: [0, 0, 0], yaw: 0 }

  it('centers a single spawn in the lane', () => {
    const [spawn] = computeSpawnPositions(startTransform, 1)
    expect(spawn[0]).toBeCloseTo(0)
    expect(spawn[1]).toBeCloseTo(SPAWN_HEIGHT)
  })

  it.each([2, 4, 8])('keeps %i spawns inside the lane width', (count) => {
    const spawns = computeSpawnPositions(startTransform, count)
    expect(spawns).toHaveLength(count)
    spawns.forEach((spawn) => {
      expect(Math.abs(spawn[0])).toBeLessThan(LANE_WIDTH / 2)
    })
  })

  it('applies the start transform yaw to gate offsets', () => {
    const rotated: PieceTransform = { position: [10, 0, -5], yaw: Math.PI / 2 }
    const spawns = computeSpawnPositions(rotated, 2)
    spawns.forEach((spawn) => {
      expect(spawn[2]).not.toBeCloseTo(-5 - 2)
      expect(spawn[1]).toBeCloseTo(SPAWN_HEIGHT)
    })
  })

  it('falls back to the origin without a start transform', () => {
    const [spawn] = computeSpawnPositions(null, 1)
    expect(spawn[1]).toBeCloseTo(SPAWN_HEIGHT)
  })
})

describe('isInFinishZone', () => {
  const finishTransform: PieceTransform = { position: [0, 0, -100], yaw: 0 }

  it('detects a position at the finish zone center', () => {
    const [centerX, , centerZ] = finishZoneCenter(finishTransform)
    expect(centerZ).toBeCloseTo(-100 - FINISH_LENGTH / 2)
    expect(isInFinishZone({ x: centerX, z: centerZ }, finishTransform)).toBe(true)
  })

  it('rejects a position outside the check radius', () => {
    const [centerX, , centerZ] = finishZoneCenter(finishTransform)
    expect(
      isInFinishZone({ x: centerX + FINISH_CHECK_RADIUS + 1, z: centerZ }, finishTransform)
    ).toBe(false)
  })

  it('returns false without a finish transform', () => {
    expect(isInFinishZone({ x: 0, z: 0 }, null)).toBe(false)
  })
})

describe('isOnBoostZone', () => {
  const zone = { position: [0, 0, -5] as CoordinateTuple, yaw: 0, length: 10, width: 8 }

  it.each([
    [{ x: 0, y: 0.8, z: -5 }, true],
    [{ x: 3.5, y: 0.8, z: -1 }, true],
    [{ x: 4.5, y: 0.8, z: -5 }, false],
    [{ x: 0, y: 0.8, z: -11 }, false],
    [{ x: 0, y: 4, z: -5 }, false]
  ])('detects %o as %s', (position, expected) => {
    expect(isOnBoostZone(position, zone)).toBe(expected)
  })

  it('respects the zone yaw', () => {
    const rotated = {
      position: [0, 0, 0] as CoordinateTuple,
      yaw: Math.PI / 2,
      length: 10,
      width: 8
    }
    expect(isOnBoostZone({ x: -4, y: 0.8, z: 0 }, rotated)).toBe(true)
    expect(isOnBoostZone({ x: 0, y: 0.8, z: -5 }, rotated)).toBe(false)
  })
})

describe('nearestCheckpointIndex', () => {
  const transforms: PieceTransform[] = [
    { position: [0, 0, 0], yaw: 0 },
    { position: [0, 0, -20], yaw: 0 },
    { position: [0, 0, -40], yaw: 0 }
  ]

  it('advances to the closest reached piece', () => {
    expect(nearestCheckpointIndex({ x: 0, z: -21 }, transforms, 0)).toBe(1)
  })

  it('never goes backwards', () => {
    expect(nearestCheckpointIndex({ x: 0, z: -1 }, transforms, 2)).toBe(2)
  })

  it('ignores pieces beyond the checkpoint radius', () => {
    expect(nearestCheckpointIndex({ x: 0, z: -55 }, transforms, 0)).toBe(0)
  })
})

describe('buildTrack', () => {
  let scene: THREE.Scene
  let world: RAPIER.World

  beforeEach(async () => {
    await RAPIER.init()
    scene = new THREE.Scene()
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  })

  it('builds models and bodies for every piece type', () => {
    const map = makeMap([
      'start',
      'straight-short',
      'curve-left',
      'banked-right',
      'ramp-up',
      'funnel',
      'loop',
      'gap-jump',
      'boost-pad',
      'bumper-field',
      'finish'
    ])
    const track = buildTrack(scene, world, map)

    expect(track.models.length).toBeGreaterThan(0)
    expect(world.bodies.len()).toBe(track.models.length)
    expect(track.startTransform).not.toBeNull()
    expect(track.finishTransform).not.toBeNull()
    expect(track.boostZones).toHaveLength(1)
    expect(track.transforms).toHaveLength(map.pieces.length)
  })

  it('tags every model with its piece id', () => {
    const track = buildTrack(scene, world, makeMap(['start', 'finish']))
    track.models.forEach((model) => {
      expect(String(model.userData.pieceId)).toMatch(/^(start|finish)-\d+$/)
    })
  })

  it('dispose removes all bodies and meshes', () => {
    const track = buildTrack(scene, world, makeMap(['start', 'funnel', 'loop', 'finish']))
    const sceneCountBefore = scene.children.length

    track.dispose()

    expect(world.bodies.len()).toBe(0)
    expect(scene.children.length).toBe(sceneCountBefore - track.models.length)
  })

  it('a marble dropped on the start piece settles on the deck', () => {
    buildTrack(scene, world, makeMap(['start', 'finish']))
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, SPAWN_HEIGHT, -4)
    const body = world.createRigidBody(bodyDesc)
    world.createCollider(RAPIER.ColliderDesc.ball(0.8).setFriction(1), body)

    Array.from({ length: 240 }).forEach(() => world.step())

    expect(body.translation().y).toBeGreaterThan(0.5)
    expect(body.translation().y).toBeLessThan(1.2)
  })
})
