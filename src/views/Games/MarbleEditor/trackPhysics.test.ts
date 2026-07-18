import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getBall, moveDynamic } from '@webgamekit/threejs'
import type { ComplexModel } from '@webgamekit/animation'
import {
  buildTrack,
  computeSpawnPositions,
  isInFinishZone,
  finishZoneCenter,
  nearestCheckpointIndex
} from './trackBuilder'
import type { PieceTransform } from './types'
import { MARBLE_WEIGHT, MARBLE_RESTITUTION, MARBLE_MOVE_FORCE, FALL_MARGIN } from './config'
import {
  MARBLE_RADIUS,
  MARBLE_FRICTION,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING,
  MAX_LINEAR_SPEED
} from '../MarbleMadness/config'
import type { MarbleMap, TrackPieceType } from './types'

const DOWNHILL_PIECES: TrackPieceType[] = [
  'start',
  'ramp-down',
  'straight-short',
  'curve-left',
  'ramp-down',
  'banked-right',
  'boost-pad',
  'ramp-down',
  'funnel',
  'straight-short',
  'gap-jump',
  'ramp-down',
  'finish'
]

const DOWNHILL_MAP: MarbleMap = {
  version: 1,
  name: 'Downhill gauntlet',
  updatedAt: 0,
  pieces: DOWNHILL_PIECES.map((type, index) => ({
    id: `${type}-${index}`,
    type,
    color: 0x808080
  }))
}

const SIMULATION_TIMEOUT_SECONDS = 60
const STEPS_PER_SECOND = 60

type SimulationOutcome = 'finished' | 'fell-through' | 'timeout'

const spawnTestMarble = (
  scene: THREE.Scene,
  world: RAPIER.World,
  position: [number, number, number]
): ComplexModel => {
  const marble = getBall(scene, world, {
    size: MARBLE_RADIUS,
    position,
    restitution: MARBLE_RESTITUTION,
    friction: MARBLE_FRICTION,
    weight: MARBLE_WEIGHT,
    segments: 8,
    type: 'dynamic'
  }) as unknown as ComplexModel
  marble.userData.body.setLinearDamping(MARBLE_LINEAR_DAMPING)
  marble.userData.body.setAngularDamping(MARBLE_ANGULAR_DAMPING)
  marble.userData.body.enableCcd(true)
  return marble
}

// Emulates a competent player: steer toward the next piece origin along the
// chain, so the marble follows the track like a human holding forward would.
type SteeringState = { checkpointIndex: number }

const applySteeringInput = (
  marble: ComplexModel,
  transforms: PieceTransform[],
  finishTransform: PieceTransform | null,
  steering: SteeringState
): void => {
  const position = marble.userData.body.translation()
  steering.checkpointIndex = nearestCheckpointIndex(position, transforms, steering.checkpointIndex)
  const nextIndex = steering.checkpointIndex + 1
  const target =
    nextIndex < transforms.length || !finishTransform
      ? transforms[Math.min(nextIndex, transforms.length - 1)].position
      : finishZoneCenter(finishTransform)
  const deltaX = target[0] - position.x
  const deltaZ = target[2] - position.z
  const distance = Math.hypot(deltaX, deltaZ) || 1
  moveDynamic(
    marble,
    {
      x: (deltaX / distance) * MARBLE_MOVE_FORCE,
      y: 0,
      z: (deltaZ / distance) * MARBLE_MOVE_FORCE
    },
    MAX_LINEAR_SPEED
  )
}

const runDownhillSimulation = (scene: THREE.Scene, world: RAPIER.World): SimulationOutcome => {
  const track = buildTrack(scene, world, DOWNHILL_MAP)
  const lowestTrackY = track.transforms.reduce(
    (lowest, transform) => Math.min(lowest, transform.position[1]),
    0
  )
  const fallThresholdY = lowestTrackY - FALL_MARGIN
  const [spawn] = computeSpawnPositions(track.startTransform, 1)
  const marble = spawnTestMarble(scene, world, spawn)
  const steering: SteeringState = { checkpointIndex: 0 }
  const totalSteps = SIMULATION_TIMEOUT_SECONDS * STEPS_PER_SECOND
  const outcome = Array.from({ length: totalSteps }).reduce<SimulationOutcome | null>((result) => {
    if (result) return result
    applySteeringInput(marble, track.transforms, track.finishTransform, steering)
    world.step()
    const position = marble.userData.body.translation()
    if (isInFinishZone(position, track.finishTransform)) return 'finished'
    if (position.y < fallThresholdY) return 'fell-through'
    return null
  }, null)
  return outcome ?? 'timeout'
}

describe('downhill track physics', () => {
  let scene: THREE.Scene
  let world: RAPIER.World

  beforeEach(async () => {
    await RAPIER.init()
    scene = new THREE.Scene()
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  })

  it('rolls the marble through every downhill piece to the finish', () => {
    expect(runDownhillSimulation(scene, world)).toBe('finished')
  })
})
