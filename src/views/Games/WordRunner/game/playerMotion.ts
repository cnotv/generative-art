import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { BRAKE, LANE_COUNT, LANE_WIDTH } from '../config'
import { followRacer, stepRacer } from '../runner/racer'
import { effectSpeedRatio } from '../runner/routeAdvantage'
import { laneAtOffset, laneOffset } from '../runner/runMotion'
import { createFreeDrive, type FreeDrive } from './freeDrive'
import type { LaneOutcome, Racer, RunSettings, TrackPath } from '../types'

type MotionStep = {
  baseSpeed: number
  deltaSeconds: number
  elapsedSeconds: number
  finishDistance: number
}

/**
 * How the player's ball moves: stepped between the lanes at the race's speed, or rolled
 * under physics and steered freely. Either way it reports the same things, so the race reads
 * one ball whichever it is: how far along it is, which lane it is in, and how far off centre.
 */
export const createPlayerMotion = (
  settings: Pick<RunSettings, 'steering' | 'steerInput' | 'brakeInput'>
) => {
  let drive: FreeDrive | null = null
  const physical = (): FreeDrive | null => (settings.steering === 'free' ? drive : null)

  const attach = (body: RAPIER.RigidBody | null, mesh: THREE.Object3D): void => {
    drive = body ? createFreeDrive(body, mesh) : null
  }

  /** Moves the ball on one frame: at the race's speed, or under physics up to that speed. */
  const step = (racer: Racer, path: TrackPath, racing: MotionStep): Racer => {
    const ball = physical()
    const braking = settings.brakeInput()
    if (!ball) {
      const brakeRatio = braking ? BRAKE.laneSpeedRatio : 1
      return stepRacer(racer, { ...racing, baseSpeed: racing.baseSpeed * brakeRatio })
    }
    const moved = ball.drive(path, {
      steer: settings.steerInput(),
      braking,
      speedCap: racing.baseSpeed * effectSpeedRatio(racer.effect),
      deltaSeconds: racing.deltaSeconds
    })
    return followRacer(racer, moved.distance, racing)
  }

  const lateral = (targetLane: number): number =>
    physical()?.lateral() ?? laneOffset(targetLane, LANE_COUNT, LANE_WIDTH)

  return {
    attach,
    step,
    lateral,
    /** The lane the ball is in: the one steered to, or the one it has rolled into. */
    lane: (targetLane: number): number => {
      const ball = physical()
      return ball ? laneAtOffset(ball.lateral(), LANE_COUNT, LANE_WIDTH) : targetLane
    },
    onPhysics: (): boolean => physical() !== null,
    holdAtStart: (path: TrackPath): void => physical()?.holdAtStart(path),
    stop: (): void => physical()?.stop(),
    react: (outcome: LaneOutcome): void => physical()?.react(outcome)
  }
}
