import * as THREE from 'three'
import type { BoneRollFlipSettings, BoneRollReading, BoneRollTrack } from './types'

const FULL_TURN = 2 * Math.PI
/** Every bone of a Mixamo rig runs along its own local +y, so a roll is a turn about that axis. */
export const BONE_LENGTH_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * The same angle, moved by whole turns until it sits as close to `reference` as it can. A roll
 * read off two directions only ever comes back within half a turn of zero, so a limb rolling
 * steadily past that point reads as jumping to the opposite sign; measured against where the
 * roll already was, the reading carries on instead.
 * @param angle The angle as it was read, in radians
 * @param reference The angle to keep it near, in radians
 * @returns The equivalent angle nearest the reference
 */
export const angleNearReference = (angle: number, reference: number): number => {
  const difference = angle - reference
  return reference + difference - FULL_TURN * Math.round(difference / FULL_TURN)
}

const clampMagnitude = (value: number, limit: number): number =>
  Math.max(-limit, Math.min(limit, value))

const startTrack = (angle: number): BoneRollReading => ({
  angle,
  track: { angle, velocity: 0, pendingReadings: 0 }
})

const acceptReading = (
  track: BoneRollTrack,
  angle: number,
  elapsedSeconds: number,
  settings: BoneRollFlipSettings
): BoneRollReading => ({
  angle,
  track: {
    angle,
    velocity:
      elapsedSeconds > 0
        ? clampMagnitude(
            (angle - track.angle) / elapsedSeconds,
            settings.maxVelocityRadiansPerSecond
          )
        : track.velocity,
    pendingReadings: 0
  }
})

/**
 * Judge one bone's roll reading against the direction that bone was already rolling in, and say
 * what to apply.
 *
 * A twist cue is read from two directions a half turn apart at worst, so a limb near the edge of
 * that range flips its sign between one frame and the next. Left alone the bone swings almost a
 * whole turn on a single misread frame and the take is spoiled. Carrying the roll forward from
 * where it was heading catches both halves of that: a reading beyond half a turn is continued
 * rather than mirrored, and one that departs from the movement altogether is held back until
 * enough frames in a row agree it is a real turn, the same way a hand's sharp turn is confirmed.
 * @param track The bone's roll from the previous frame, or undefined the first time
 * @param observedAngle The roll this frame read, in radians, within half a turn of zero
 * @param elapsedSeconds Time since the previous frame was applied
 * @param settings When a reading counts as a flip, see `BoneRollFlipSettings`
 * @returns The roll to apply and the track to carry into the next frame
 */
export const trackBoneRoll = (
  track: BoneRollTrack | undefined,
  observedAngle: number,
  elapsedSeconds: number,
  settings: BoneRollFlipSettings
): BoneRollReading => {
  if (!track || !Number.isFinite(elapsedSeconds) || elapsedSeconds > settings.resetSeconds) {
    return startTrack(observedAngle)
  }
  const predicted = track.angle + track.velocity * elapsedSeconds
  const candidate = angleNearReference(observedAngle, predicted)
  if (Math.abs(candidate - predicted) <= settings.flipRadians) {
    return acceptReading(track, candidate, elapsedSeconds, settings)
  }
  const pendingReadings = track.pendingReadings + 1
  return pendingReadings >= settings.confirmReadings
    ? acceptReading(track, candidate, elapsedSeconds, settings)
    : { angle: track.angle, track: { angle: track.angle, velocity: 0, pendingReadings } }
}

/**
 * Split a rotation into its turn about `unitAxis`, as a signed angle, and the swing left over, so
 * that `swing * twist` rebuilds it.
 * @param rotation The rotation to split
 * @param unitAxis The axis to measure the turn about, normalized
 * @returns The swing, and the turn about the axis in radians
 */
export const splitSwingTwist = (
  rotation: THREE.Quaternion,
  unitAxis: THREE.Vector3
): { swing: THREE.Quaternion; twistAngle: number } => {
  // The same rotation has two quaternions; the one with w >= 0 keeps the angle within half a turn.
  const hemisphere = rotation.w < 0 ? -1 : 1
  const along = new THREE.Vector3(rotation.x, rotation.y, rotation.z).dot(unitAxis) * hemisphere
  const twistAngle = 2 * Math.atan2(along, rotation.w * hemisphere)
  const twist = new THREE.Quaternion().setFromAxisAngle(unitAxis, twistAngle)
  return { swing: rotation.clone().multiply(twist.invert()), twistAngle }
}

/**
 * Whether one rotation reaches another almost entirely by rolling the bone about its own length,
 * far enough that it has turned over. That is what a flipped twist cue leaves behind, and what
 * tells it apart from a limb genuinely swinging hard: a swing turns the bone somewhere else,
 * a flip only spins it in place.
 * @param from The rotation before
 * @param to The rotation after
 * @param flipRadians How far a roll must turn, and a swing must stay under, to count
 * @returns Whether the change is a roll that flipped over
 */
export const isBoneRollFlip = (
  from: THREE.Quaternion,
  to: THREE.Quaternion,
  flipRadians: number
): boolean => {
  const change = to.clone().multiply(from.clone().invert())
  const { swing, twistAngle } = splitSwingTwist(change, BONE_LENGTH_AXIS)
  const swingAngle = 2 * Math.acos(Math.min(1, Math.abs(swing.w)))
  return Math.abs(angleNearReference(twistAngle, 0)) > flipRadians && swingAngle < flipRadians
}
