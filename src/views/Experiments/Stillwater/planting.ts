import { generateAreaPositions } from '@webgamekit/threejs'
import type { CoordinateTuple, ModelOptions } from '@webgamekit/threejs'
import type { PlantingBand } from './types'

/**
 * A repeatable value in [0, 1) for one slot in a band.
 *
 * `generateAreaPositions` seeds where things stand; this seeds what stands there, and `salt`
 * separates the draws so height, facing and girth do not all move together and leave every
 * tall tree also the widest and the same way round.
 * @param seed The band's seed
 * @param index Which slot in the band
 * @param salt Which property is being drawn
 * @returns A value in [0, 1)
 */
const slotValue = (seed: number, index: number, salt: number): number => {
  const mixed = Math.sin(seed * 127.1 + index * 311.7 + salt * 74.7) * 43758.5453
  return mixed - Math.floor(mixed)
}

/**
 * Place one band's worth of copies of a model.
 *
 * Every copy is turned and sized differently. A stand of identical cones reads as wallpaper
 * however well the one model is made, and the girth varies separately from the height so the
 * silhouettes do not all share a profile.
 *
 * Each one is set down on the ground beneath it, not on the ground's mean level. Over relief
 * that rises and falls a few units, a band planted on the mean stands on stilts in every dip.
 * @param band Where the copies go, how many, and how big
 * @param heightAt The ground's height at a spot, relative to the band's own root level
 * @returns One entry per copy, ready for `instanceMatrixModel`
 */
export const plantBand = (
  band: PlantingBand,
  heightAt: (x: number, z: number) => number
): ModelOptions[] =>
  generateAreaPositions({
    min: band.min,
    max: band.max,
    count: band.count,
    seed: band.seed
  }).map((position, index) => {
    const height = band.minScale + slotValue(band.seed, index, 1) * (band.maxScale - band.minScale)
    const girth = height * (0.75 + slotValue(band.seed, index, 3) * 0.5)
    return {
      name: band.name,
      position: [
        position[0],
        band.rootLevel + heightAt(position[0], position[2]),
        position[2]
      ] as CoordinateTuple,
      rotation: [0, slotValue(band.seed, index, 2) * Math.PI * 2, 0] as CoordinateTuple,
      scale: [girth, height, girth] as CoordinateTuple
    }
  })
