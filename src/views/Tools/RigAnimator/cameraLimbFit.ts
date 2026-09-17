import * as THREE from 'three'
import { CAMERA_LIMB_FIT_MAX_SCALE, CAMERA_LIMB_FIT_MIN_SCALE } from './config'
import type { LimbLengths } from './types'

/**
 * How much to scale a pair of rig limbs so they measure what the performer's own limbs do. A
 * rig whose arms are longer than the performer's, relative to the body each hangs off, reaches
 * further for the same joint angles: a hand brought to the chin lands inside the head, and two
 * arms brought together in front of the chest pass through one another. Turning those angles
 * into positions instead would fix the reach at the cost of folding an elbow that the performer
 * holds straight, so the limb itself is resized rather than bent.
 *
 * Both sides go in together and come back as one scale: MediaPipe reports a left and a right
 * limb of measurably different lengths on the same frame, and fitting each side to its own
 * reading leaves the rig lopsided, which is what makes two limbs cross halfway through a turn.
 * Clamped, so one wild reading cannot fold a limb away to nothing.
 * @param limbs Each measurable side's observed and rest length, in their own units
 * @param bodyScale The rig's own body measure over the performer's, making the two comparable
 * @returns The scale both sides' limbs take, or null with nothing measurable in view
 */
export const limbFitScale = (limbs: LimbLengths[], bodyScale: number): number | null => {
  const observed = limbs.reduce((total, limb) => total + limb.observed, 0)
  const rest = limbs.reduce((total, limb) => total + limb.rest, 0)
  return observed > 0 && rest > 0
    ? THREE.MathUtils.clamp(
        (observed * bodyScale) / rest,
        CAMERA_LIMB_FIT_MIN_SCALE,
        CAMERA_LIMB_FIT_MAX_SCALE
      )
    : null
}
