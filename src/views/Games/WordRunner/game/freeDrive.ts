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

const WALL_STANDOFF = wallStandoff(TRACK_WIDTH, BALL.radius)

/**
 * A soft cushion along each wall. Inside it, the ball's drift towards the wall is taken away and
 * it is pushed back out, harder the deeper it is, so it never rolls against a wall and catches
 * on a joint between two of its pieces at a bend.
 */
export const cushionImpulse = (
  lateral: number,
  lateralSpeed: number,
  mass: number,
  deltaSeconds: number
): number => {
  const depth = Math.abs(lateral) - (WALL_STANDOFF - FREE_BALL.wallCushion)
  if (depth <= 0) return 0
  const outwards = Math.sign(lateral)
  const drift = lateralSpeed * outwards > 0 ? lateralSpeed : 0
  return -drift * mass - outwards * depth * FREE_BALL.cushionStiffness * mass * deltaSeconds
}

type RescueCheck = {
  heightAboveDeck: number
  forwardSpeed: number
  braking: boolean
  stalledSeconds: number
}

/**
 * Whether the ball has to be put back on the track: it was knocked through the deck by a wall
 * it hit too fast, or it has sat stalled against something without the player braking.
 */
export const needsRescue = ({ heightAboveDeck, braking, stalledSeconds }: RescueCheck): boolean =>
  heightAboveDeck < -FREE_BALL.fallDepth || (!braking && stalledSeconds > FREE_BALL.stallSeconds)

/** How long the ball has been stalled, counting on from the last frame. */
export const stalledFor = (
  { forwardSpeed, braking }: Pick<RescueCheck, 'forwardSpeed' | 'braking'>,
  stalledSeconds: number,
  deltaSeconds: number
): number => (!braking && forwardSpeed < FREE_BALL.stallSpeed ? stalledSeconds + deltaSeconds : 0)

/** Where across the track a rescued ball goes back: where it was, clear of the wall cushion. */
export const rescueLateral = (lateral: number): number => {
  const limit = WALL_STANDOFF - FREE_BALL.wallCushion
  return Math.max(-limit, Math.min(limit, lateral))
}

/**
 * The player's ball under physics, driven much as Rock Runner drives its rock: pushed along the
 * track up to a speed cap, hard enough to climb its hills, steered sideways with a capped push,
 * and otherwise left to gravity, so it gathers some speed downhill and loses it climbing. Its
 * distance along the track is found by projecting its position back onto the path.
 */
export const createFreeDrive = (body: RAPIER.RigidBody, mesh: THREE.Object3D) => {
  let distance = 0
  let lateral = 0
  let stalledSeconds = 0
  const impulse = { x: 0, y: 0, z: 0 }
  const still = { x: 0, y: 0, z: 0 }
  const spot = { x: 0, y: 0, z: 0 }

  const syncMesh = (): void => {
    const position = body.translation()
    const rotation = body.rotation()
    mesh.position.set(position.x, position.y, position.z)
    mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  /** Sets the ball down on the deck at a place on the track, rolling straight on at a speed. */
  const placeAt = (path: TrackPath, atDistance: number, atLateral: number, speed: number) => {
    const sample = path.sampleAt(atDistance)
    spot.x = sample.position.x + sample.right.x * atLateral
    spot.y = sample.position.y + BALL.radius + FREE_BALL.spawnLift
    spot.z = sample.position.z + sample.right.z * atLateral
    body.setTranslation(spot, true)
    impulse.x = sample.forward.x * speed
    impulse.y = 0
    impulse.z = sample.forward.z * speed
    body.setLinvel(impulse, true)
    body.setAngvel(still, true)
    distance = atDistance
    lateral = atLateral
    stalledSeconds = 0
    syncMesh()
  }

  /** Puts the ball on the start line at rest, where it waits until the race begins. */
  const holdAtStart = (path: TrackPath): void => placeAt(path, 0, 0, 0)

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
    const forwardSpeed = speedAlong(velocity, sample.forward)
    stalledSeconds = stalledFor({ forwardSpeed, braking }, stalledSeconds, deltaSeconds)
    const heightAboveDeck = position.y - BALL.radius - sample.position.y
    if (needsRescue({ heightAboveDeck, forwardSpeed, braking, stalledSeconds })) {
      placeAt(path, distance, rescueLateral(lateral), speedCap)
      return { distance, lateral }
    }
    const forward = forwardImpulse({
      forwardSpeed,
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
              standoff: WALL_STANDOFF
            }),
            deltaSeconds
          )
    const cushion = cushionImpulse(lateral, lateralSpeed, body.mass(), deltaSeconds)
    impulse.x = sample.forward.x * forward + sample.right.x * (sideways + cushion)
    impulse.y = 0
    impulse.z = sample.forward.z * forward + sample.right.z * (sideways + cushion)
    body.applyImpulse(impulse, true)
    // Two projections: the first lands close, the second removes what the curve left over.
    distance = advanceDistance(path, distance, position)
    distance = advanceDistance(path, distance, position)
    syncMesh()
    return { distance, lateral }
  }

  const knockUp = (strength: number): void => {
    impulse.x = 0
    impulse.y = strength
    impulse.z = 0
    body.applyImpulse(impulse, true)
  }

  /**
   * What a lane does to a real ball: a ramp throws it up, a slowing lane bleeds its speed, and
   * a rock does both, knocking it off the deck as it stops it.
   */
  const react = (outcome: LaneOutcome): void => {
    if (outcome === 'none') return
    if (outcome === 'boost') {
      knockUp(FREE_BALL.hopImpulse)
      return
    }
    const velocity = body.linvel()
    const ratio = ROUTE_EFFECTS[outcome].ratio
    impulse.x = velocity.x * ratio
    impulse.y = velocity.y
    impulse.z = velocity.z * ratio
    body.setLinvel(impulse, true)
    if (outcome === 'stumble') knockUp(FREE_BALL.rockKnockImpulse)
  }

  return { holdAtStart, stop, drive, react, lateral: () => lateral }
}

export type FreeDrive = ReturnType<typeof createFreeDrive>
