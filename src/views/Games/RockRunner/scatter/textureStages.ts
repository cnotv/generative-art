import type { ScatterAreaDefinition, ScatterTexture } from '../types'
import { SCATTER_STAGE_LENGTH } from '../config'

const CHANNEL_MASK = 0xff
const RED_SHIFT = 16
const GREEN_SHIFT = 8

/**
 * Which stage of the run a distance falls in.
 *
 * The sequence loops: past the last stage it returns to the first, so a long
 * run keeps changing character instead of settling into one look forever.
 *
 * @param distance - Distance along the track
 * @param stageCount - How many stages the area defines
 * @returns The stage index, wrapping back to the first past the last
 */
export const stageIndexAt = (distance: number, stageCount: number): number => {
  if (stageCount <= 0) return 0
  const raw = Math.floor(Math.max(0, distance) / SCATTER_STAGE_LENGTH)
  return raw % stageCount
}

/**
 * The textures an area draws from at a given distance.
 *
 * Areas without stages keep whatever list they were given, which is what lets
 * the Textures panel add variants to them at runtime.
 *
 * @param definition - The area's catalog entry
 * @param distance - Distance the chunk being built sits at
 * @param fallback - The area's live texture list, used when it has no stages
 * @returns The textures to draw from
 */
export const texturesAt = (
  definition: ScatterAreaDefinition,
  distance: number,
  fallback: ScatterTexture[]
): ScatterTexture[] => {
  const stages = definition.textureStages
  if (!stages || stages.length === 0) return fallback
  return stages[stageIndexAt(distance, stages.length)]
}

/**
 * The colour a staged palette shows at a distance.
 *
 * Blended rather than stepped: the scenery may swap in an instant but the haze
 * around it changing in one frame reads as a glitch. Each colour is still hit
 * exactly at its own milestone, so a stage boundary looks deliberate.
 *
 * The palette loops with the stages, blending from the last colour back to the
 * first rather than settling on the last for the rest of the run.
 *
 * @param distance - Distance along the track
 * @param colors - One colour per stage
 * @returns The blended colour, wrapping back to the first past the last
 */
export const stageColorAt = (distance: number, colors: number[]): number => {
  if (colors.length === 0) return 0
  const position = Math.max(0, distance) / SCATTER_STAGE_LENGTH
  const index = Math.floor(position) % colors.length
  const next = (index + 1) % colors.length
  const blend = colors.length === 1 ? 0 : position - Math.floor(position)
  const channel = (shift: number): number => {
    const from = (colors[index] >> shift) & CHANNEL_MASK
    const to = (colors[next] >> shift) & CHANNEL_MASK
    return Math.round(from + (to - from) * blend)
  }
  return (channel(RED_SHIFT) << RED_SHIFT) | (channel(GREEN_SHIFT) << GREEN_SHIFT) | channel(0)
}
