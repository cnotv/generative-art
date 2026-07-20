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
import {
  MARBLE_WEIGHT,
  MARBLE_RESTITUTION,
  MARBLE_FRICTION,
  MARBLE_MOVE_FORCE,
  MARBLE_MAX_SPEED,
  FALL_MARGIN
} from './config'
import {
  MARBLE_RADIUS,
  MARBLE_LINEAR_DAMPING,
  MARBLE_ANGULAR_DAMPING
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

// Flat straight run: isolates piece-to-piece junctions on level ground with no
// gravity assist, so a seam that catches the marble shows up as a stall.
const FLAT_PIECES: TrackPieceType[] = [
  'start',
  'straight-short',
  'straight-short',
  'straight-short',
  'straight-long',
  'finish'
]

const flatMap = (): MarbleMap => ({
  version: 1,
  name: 'Flat junctions',
  updatedAt: 0,
  pieces: FLAT_PIECES.map((type, index) => ({ id: `${type}-${index}`, type, color: 0x808080 }))
})

const SIMULATION_TIMEOUT_SECONDS = 60
const STEPS_PER_SECOND = 60
// A wedged marble sits near-motionless; genuine slow spots (ramp lips, curve
// apexes) recover within a second, so a stall this long means a stuck seam.
const STALL_SPEED = 0.75
const MAX_STALL_STEPS = 90
const START_GRACE_STEPS = 30
// Gentle drive for the flat-junction test: enough to keep a marble rolling on
// level friction, not enough to bulldoze through a genuinely wedging seam.
const FLAT_MOVE_FORCE = 5

type SimulationOutcome = 'finished' | 'fell-through' | 'timeout'

type SimulationResult = {
  outcome: SimulationOutcome
  steps: number
  longestStallSteps: number
}

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
  steering: SteeringState,
  moveForce: number
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
    { x: (deltaX / distance) * moveForce, y: 0, z: (deltaZ / distance) * moveForce },
    MARBLE_MAX_SPEED
  )
}

const horizontalSpeed = (marble: ComplexModel): number => {
  const velocity = marble.userData.body.linvel()
  return Math.hypot(velocity.x, velocity.z)
}

const simulate = (
  scene: THREE.Scene,
  world: RAPIER.World,
  map: MarbleMap,
  moveForce: number = MARBLE_MOVE_FORCE
): SimulationResult => {
  const track = buildTrack(scene, world, map)
  const lowestTrackY = track.transforms.reduce(
    (lowest, transform) => Math.min(lowest, transform.position[1]),
    0
  )
  const fallThresholdY = lowestTrackY - FALL_MARGIN
  const [spawn] = computeSpawnPositions(track.startTransform, 1)
  const marble = spawnTestMarble(scene, world, spawn)
  const steering: SteeringState = { checkpointIndex: 0 }
  const totalSteps = SIMULATION_TIMEOUT_SECONDS * STEPS_PER_SECOND

  const state = { outcome: null as SimulationOutcome | null, steps: 0, stall: 0, longestStall: 0 }
  Array.from({ length: totalSteps }).forEach((_, step) => {
    if (state.outcome) return
    applySteeringInput(marble, track.transforms, track.finishTransform, steering, moveForce)
    world.step()
    state.steps = step + 1
    if (step >= START_GRACE_STEPS && horizontalSpeed(marble) < STALL_SPEED) {
      state.stall += 1
      state.longestStall = Math.max(state.longestStall, state.stall)
    } else {
      state.stall = 0
    }
    const position = marble.userData.body.translation()
    if (isInFinishZone(position, track.finishTransform)) state.outcome = 'finished'
    else if (position.y < fallThresholdY) state.outcome = 'fell-through'
  })

  return {
    outcome: state.outcome ?? 'timeout',
    steps: state.steps,
    longestStallSteps: state.longestStall
  }
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
    expect(simulate(scene, world, DOWNHILL_MAP).outcome).toBe('finished')
  })

  it('rolls a curve-heavy track at full speed without falling through', () => {
    const types: TrackPieceType[] = [
      'start',
      'straight-long',
      'curve-left',
      'curve-left',
      'curve-right',
      'curve-right',
      'finish'
    ]
    const map: MarbleMap = {
      version: 1,
      name: 'curves',
      updatedAt: 0,
      pieces: types.map((type, i) => ({ id: `${type}-${i}`, type, color: 0x808080 }))
    }
    expect(simulate(scene, world, map).outcome).toBe('finished')
  })

  it('rolls the marble across flush piece junctions without stalling', () => {
    // Regression guard for junction geometry: a gentle push (barely above
    // rolling friction) makes any seam catch consequential, so a marble that
    // reaches the finish without a long stall proves the flush junctions stay
    // continuous. (A fixed-step sim cannot reproduce the real-time contact
    // jitter the contact skin defends against; that needs in-game testing.)
    const result = simulate(scene, world, flatMap(), FLAT_MOVE_FORCE)
    expect(result.outcome).toBe('finished')
    expect(result.longestStallSteps).toBeLessThan(MAX_STALL_STEPS)
  })
})
