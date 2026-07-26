import * as THREE from 'three'
import { seededRandomValues } from '@webgamekit/threejs'
import type { SweepStation } from '@/types/sweptGeometry'
import type { PathTerm, TrackPath, TrackSample } from './types'
import { CURVE_TERMS, HILL_TERMS, STATION_SPACING } from './config'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const TWO_PI = Math.PI * 2

/**
 * Evaluates a sine sum at a distance. Each term contributes
 * `amplitude * sin(2*pi*distance/wavelength + phase)`, so the wavelength is a
 * real world-space distance rather than an opaque frequency.
 *
 * @param terms - Sine terms to sum
 * @param phases - One phase offset per term, drawn from the track seed
 * @param distance - Distance along the path
 * @returns The summed value at that distance
 */
export const evaluateTerms = (terms: PathTerm[], phases: number[], distance: number): number =>
  terms.reduce(
    (total, term, index) =>
      total + term.amplitude * Math.sin((TWO_PI * distance) / term.wavelength + phases[index]),
    0
  )

/**
 * Unit forward vector for a heading. Yaw 0 points down -Z, matching the
 * convention the track pieces and cameras already use.
 *
 * @param yaw - Heading in radians
 * @returns A new unit vector pointing along the heading
 */
export const forwardFromYaw = (yaw: number): THREE.Vector3 =>
  new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))

/**
 * Unit right vector for a heading, perpendicular to `forwardFromYaw`.
 *
 * @param yaw - Heading in radians
 * @returns A new unit vector pointing to the heading's right
 */
export const rightFromYaw = (yaw: number): THREE.Vector3 =>
  new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))

/**
 * Creates a seeded, endless centerline that curves and rises gently.
 *
 * Heading and height are independent sine sums of the travelled distance, so
 * the path is a pure function of the seed: every peer generating from the same
 * seed walks an identical track without exchanging any geometry. Stations are
 * integrated once and cached, growing on demand as the rock advances.
 *
 * `distance` is measured horizontally along the path rather than as true arc
 * length. The hills are shallow enough that the difference is under a percent,
 * and keeping the parameter horizontal makes station lookup exact division
 * instead of a search.
 *
 * @param seed - Seed for the heading and height phase offsets
 * @returns A path that can be sampled and swept at any distance
 */
export const createTrackPath = (seed: number): TrackPath => {
  const phaseCount = CURVE_TERMS.length + HILL_TERMS.length
  const phases = seededRandomValues(seed, phaseCount).map((value) => value * TWO_PI)
  const curvePhases = phases.slice(0, CURVE_TERMS.length)
  const hillPhases = phases.slice(CURVE_TERMS.length)

  const yawAt = (distance: number): number => evaluateTerms(CURVE_TERMS, curvePhases, distance)
  const heightAt = (distance: number): number => evaluateTerms(HILL_TERMS, hillPhases, distance)

  // Stations are integrated outward from the origin, so each one depends on its
  // neighbour towards zero. The cache is grown in both directions and never
  // rebuilt, which keeps the path stable for the whole run.
  //
  // It reaches behind the origin as well as ahead: the rock starts at distance
  // zero, and without ground behind it half the ball overhangs the very first
  // edge and it rolls backwards off the track before the countdown ends.
  const origins: THREE.Vector3[] = [new THREE.Vector3(0, heightAt(0), 0)]
  let baseIndex = 0

  const stepBetween = (fromIndex: number, direction: 1 | -1): THREE.Vector3 => {
    const midDistance = (fromIndex + direction * 0.5) * STATION_SPACING
    return forwardFromYaw(yawAt(midDistance)).multiplyScalar(direction * STATION_SPACING)
  }

  const growForward = (index: number): void => {
    Array.from({ length: Math.max(0, index - (baseIndex + origins.length - 1)) }).forEach(() => {
      const lastIndex = baseIndex + origins.length - 1
      const previous = origins[origins.length - 1]
      const step = stepBetween(lastIndex, 1)
      origins.push(
        new THREE.Vector3(
          previous.x + step.x,
          heightAt((lastIndex + 1) * STATION_SPACING),
          previous.z + step.z
        )
      )
    })
  }

  const growBackward = (index: number): void => {
    Array.from({ length: Math.max(0, baseIndex - index) }).forEach(() => {
      const next = origins[0]
      const step = stepBetween(baseIndex, -1)
      origins.unshift(
        new THREE.Vector3(
          next.x + step.x,
          heightAt((baseIndex - 1) * STATION_SPACING),
          next.z + step.z
        )
      )
      baseIndex -= 1
    })
  }

  const originAt = (index: number): THREE.Vector3 => {
    growForward(index)
    growBackward(index)
    return origins[index - baseIndex]
  }

  // The cross-section is pitched to match the local slope so the deck stays
  // tangent to the hills instead of stepping between flat plates.
  const orientationAt = (index: number): THREE.Quaternion => {
    const distance = index * STATION_SPACING
    const rise = originAt(index + 1).y - originAt(index).y
    const pitch = Math.atan2(rise, STATION_SPACING)
    return new THREE.Quaternion()
      .setFromAxisAngle(Y_AXIS, yawAt(distance))
      .multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, pitch))
  }

  const stationAt = (index: number): SweepStation => ({
    origin: originAt(index).clone(),
    orientation: orientationAt(index)
  })

  const stationsBetween = (fromIndex: number, toIndex: number): SweepStation[] =>
    Array.from({ length: Math.max(0, toIndex - fromIndex + 1) }, (_, offset) =>
      stationAt(fromIndex + offset)
    )

  const indexAt = (distance: number): number => Math.floor(distance / STATION_SPACING)

  const sampleAt = (distance: number): TrackSample => {
    const index = indexAt(distance)
    const fraction = distance / STATION_SPACING - index
    const yaw = yawAt(distance)
    const position = originAt(index)
      .clone()
      .lerp(originAt(index + 1), fraction)
    position.y = heightAt(distance)
    return { position, forward: forwardFromYaw(yaw), right: rightFromYaw(yaw), yaw }
  }

  return { seed, spacing: STATION_SPACING, stationAt, stationsBetween, sampleAt, indexAt }
}
