import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import {
  advanceDistance,
  frameScaledImpulse,
  lateralOffset,
  speedAlong,
  steerImpulseMagnitude,
  wallStandoff
} from '@/views/Games/RockRunner/game/rockMotion'
import { MAX_LATERAL_SPEED, STEER_IMPULSE, TRACK_WIDTH } from '@/views/Games/RockRunner/config'
import { BALL, BRAKE, FREE_BALL, ROUTE_EFFECTS } from '../config'
import type { LaneOutcome, TrackPath } from '../types'

type DriveStep = {
  steer: number
  braking: boolean
  speedCap: number
  deltaSeconds: number
}

type ForwardPush = {
  forwardSpeed: number
  speedCap: number
  mass: number
  deltaSeconds: number
  braking: boolean
}

/**
 * The push along the track for one frame. Under the cap, the drive, never more than the cap
 * still allows, so one long frame cannot throw the ball past it. Over the cap, a pull back
 * towards it. Braking, a steady slowing down to a stop, holding the ball there rather than
 * letting a slope roll it back.
 */
export const forwardImpulse = ({
  forwardSpeed,
  speedCap,
  mass,
  deltaSeconds,
  braking
}: ForwardPush): number => {
  if (braking) {
    return (
      -Math.sign(forwardSpeed) *
      Math.min(Math.abs(forwardSpeed), BRAKE.deceleration * deltaSeconds) *
      mass
    )
  }
  if (forwardSpeed > speedCap) {
    return -(forwardSpeed - speedCap) * mass * Math.min(1, FREE_BALL.overspeedDrag * deltaSeconds)
  }
  return Math.min(FREE_BALL.driveForce * deltaSeconds, (speedCap - forwardSpeed) * mass)
}

/**
 * Sideways grip while the player is not steering: the ball keeps the line it was put on rather
 * than drifting out on every bend until it rubs the wall to a stop.
 */
export const gripImpulse = (lateralSpeed: number, mass: number, deltaSeconds: number): number =>
  -lateralSpeed * mass * Math.min(1, FREE_BALL.lateralGrip * deltaSeconds)

/**
 * The player's ball under physics, driven much as Rock Runner drives its rock: pushed along the
 * track up to a speed cap, hard enough to climb its hills, steered sideways with a capped push,
 * and otherwise left to gravity, so it gathers some speed downhill and loses it climbing. Its
 * distance along the track is found by projecting its position back onto the path.
 */
export const createFreeDrive = (body: RAPIER.RigidBody, mesh: THREE.Object3D) => {
  let distance = 0
  let lateral = 0
  const impulse = { x: 0, y: 0, z: 0 }
  const still = { x: 0, y: 0, z: 0 }
  const spot = { x: 0, y: 0, z: 0 }

  const syncMesh = (): void => {
    const position = body.translation()
    const rotation = body.rotation()
    mesh.position.set(position.x, position.y, position.z)
    mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  /** Puts the ball on the start line at rest, where it waits until the race begins. */
  const holdAtStart = (path: TrackPath): void => {
    const start = path.sampleAt(0)
    spot.x = start.position.x
    spot.y = start.position.y + BALL.radius + FREE_BALL.spawnLift
    spot.z = start.position.z
    body.setTranslation(spot, true)
    body.setLinvel(still, true)
    body.setAngvel(still, true)
    distance = 0
    lateral = 0
    syncMesh()
  }

  /** Stops the ball where it is, once it has crossed the line. */
  const stop = (): void => {
    body.setLinvel(still, true)
    body.setAngvel(still, true)
    syncMesh()
  }

  const drive = (path: TrackPath, { steer, braking, speedCap, deltaSeconds }: DriveStep) => {
    const sample = path.sampleAt(distance)
    const velocity = body.linvel()
    const position = body.translation()
    lateral = lateralOffset(position, sample.position, sample.right)
    const forward = forwardImpulse({
      forwardSpeed: speedAlong(velocity, sample.forward),
      speedCap,
      mass: body.mass(),
      deltaSeconds,
      braking
    })
    const lateralSpeed = speedAlong(velocity, sample.right)
    const sideways =
      steer === 0
        ? gripImpulse(lateralSpeed, body.mass(), deltaSeconds)
        : frameScaledImpulse(
            steerImpulseMagnitude(steer, STEER_IMPULSE, {
              lateralSpeed,
              speedCap: MAX_LATERAL_SPEED,
              offset: lateral,
              standoff: wallStandoff(TRACK_WIDTH, BALL.radius)
            }),
            deltaSeconds
          )
    impulse.x = sample.forward.x * forward + sample.right.x * sideways
    impulse.y = 0
    impulse.z = sample.forward.z * forward + sample.right.z * sideways
    body.applyImpulse(impulse, true)
    // Two projections: the first lands close, the second removes what the curve left over.
    distance = advanceDistance(path, distance, position)
    distance = advanceDistance(path, distance, position)
    syncMesh()
    return { distance, lateral }
  }

  /** What a lane does to a real ball: a ramp throws it up, a slowing lane bleeds its speed. */
  const react = (outcome: LaneOutcome): void => {
    if (outcome === 'none') return
    if (outcome === 'boost') {
      impulse.x = 0
      impulse.y = FREE_BALL.hopImpulse
      impulse.z = 0
      body.applyImpulse(impulse, true)
      return
    }
    const velocity = body.linvel()
    const ratio = ROUTE_EFFECTS[outcome].ratio
    impulse.x = velocity.x * ratio
    impulse.y = velocity.y
    impulse.z = velocity.z * ratio
    body.setLinvel(impulse, true)
  }

  return { holdAtStart, stop, drive, react, lateral: () => lateral }
}

export type FreeDrive = ReturnType<typeof createFreeDrive>
