import * as THREE from 'three'
import { seededRandomValues } from '@webgamekit/threejs'
import type { ScatterAreaConfig, ScatterInstance, ScatterPlacement, TrackPath } from '../types'
import { TRACK_HALF_WIDTH } from '../config'

/** Frequency is expressed per this many units of track, so the number reads as a percentage. */
export const SCATTER_FREQUENCY_UNIT = 100

const VALUES_PER_INSTANCE = 8
const HALF = 0.5

/**
 * How many billboards an area places over a stretch of track.
 *
 * @param frequency - Instances per SCATTER_FREQUENCY_UNIT of track
 * @param length - Length of the stretch
 * @returns A non-negative instance count
 */
export const scatterInstanceCount = (frequency: number, length: number): number =>
  Math.max(0, Math.round((Math.max(0, frequency) * Math.max(0, length)) / SCATTER_FREQUENCY_UNIT))

/**
 * Applies a symmetric variation around a base value, matching the convention
 * the cloud area already uses: the result lands in `base +/- variation`.
 *
 * @param base - Value to vary
 * @param variation - Maximum deviation in either direction
 * @param sample - A value in [0, 1)
 * @returns The varied value
 */
export const applyVariation = (base: number, variation: number, sample: number): number =>
  base + (sample - HALF) * 2 * variation

/**
 * Signed lateral offset from the track centre for one instance.
 *
 * Side areas mirror onto both banks and always clear the deck, so a tree never
 * grows through the ground the rock is rolling on. On-track areas stay inside
 * the deck. Background areas sit far out on either side.
 *
 * @param placement - Which band the area scatters into
 * @param config - The area's tunable distance band
 * @param sideSample - A value in [0, 1) choosing the bank
 * @param bandSample - A value in [0, 1) choosing the position within the band
 * @returns The signed offset along the track's right vector
 */
export const lateralOffset = (
  placement: ScatterPlacement,
  config: ScatterAreaConfig,
  sideSample: number,
  bandSample: number
): number => {
  const side = sideSample < HALF ? -1 : 1
  const low = Math.min(config.distanceMin, config.distanceMax)
  const high = Math.max(config.distanceMin, config.distanceMax)
  if (placement === 'track') {
    const limit = Math.min(high, TRACK_HALF_WIDTH)
    return side * (Math.min(low, limit) + bandSample * Math.max(0, limit - Math.min(low, limit)))
  }
  const clearance = Math.max(low, TRACK_HALF_WIDTH)
  return side * (clearance + bandSample * Math.max(0, high - clearance))
}

export type ScatterPlacementOptions = {
  path: TrackPath
  config: ScatterAreaConfig
  placement: ScatterPlacement
  fromDistance: number
  toDistance: number
  seed: number
  textureCount: number
}

/**
 * Places one area's billboards over a stretch of track.
 *
 * Instances are stratified along the stretch and then jittered, so they read as
 * scattered without clumping, and the jitter is clamped to the stretch so a
 * chunk never spills geometry into its neighbour and pops in twice. Every
 * instance faces back along the local heading, which is where the chase camera
 * always is, so the flat illustrations read as upright props with no per-frame
 * billboard work.
 *
 * @param options - Path, area config, stretch bounds, seed and texture count
 * @returns The instances to build, in stable seeded order
 */
export const placeScatterInstances = (options: ScatterPlacementOptions): ScatterInstance[] => {
  const { path, config, placement, fromDistance, toDistance, seed, textureCount } = options
  const length = toDistance - fromDistance
  const count = scatterInstanceCount(config.frequency, length)
  if (count === 0 || textureCount === 0) return []

  const samples = seededRandomValues(seed, count * VALUES_PER_INSTANCE)
  const stride = length / count
  const [offsetX, offsetY, offsetZ] = config.center
  const [varyX, varyY, varyZ] = config.variation

  return Array.from({ length: count }, (_, index) => {
    const base = index * VALUES_PER_INSTANCE
    const stratified = fromDistance + (index + HALF) * stride
    // Jitter along the track is clamped back into the stretch, so a chunk never
    // places geometry its neighbour will also place.
    const distance = Math.min(
      toDistance,
      Math.max(fromDistance, applyVariation(stratified + offsetZ, varyZ, samples[base]))
    )

    const sample = path.sampleAt(distance)
    const banded = lateralOffset(placement, config, samples[base + 1], samples[base + 2])
    const lateral = applyVariation(
      banded + Math.sign(banded || 1) * offsetX,
      varyX,
      samples[base + 6]
    )
    const scale = applyVariation(1, config.sizeVariation, samples[base + 4])
    const width = Math.max(0.1, config.baseSize[0] * scale)
    const height = Math.max(0.1, config.baseSize[1] * scale)
    const vertical = applyVariation(config.heightOffset + offsetY, varyY, samples[base + 7])

    const position = new THREE.Vector3(
      sample.position.x + sample.right.x * lateral,
      sample.position.y + vertical + height / 2,
      sample.position.z + sample.right.z * lateral
    )

    return {
      distance,
      position,
      yaw: applyVariation(sample.yaw, config.rotationVariation, samples[base + 3]),
      width,
      height,
      textureIndex: Math.min(textureCount - 1, Math.floor(samples[base + 5] * textureCount))
    }
  })
}
