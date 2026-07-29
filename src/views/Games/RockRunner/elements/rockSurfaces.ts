import scannedColorUrl from '@/assets/images/textures/rock/Rock016_1K-JPG_Color.webp'
import crackedEarthUrl from '@/assets/images/textures/rock/surface-cracked-earth.webp'
import redStoneUrl from '@/assets/images/textures/rock/surface-red-stone.webp'
import mossyStoneUrl from '@/assets/images/textures/rock/surface-mossy-stone.webp'
import type { RockSurface } from '../types'
import { ROCK_TINT } from '../config'

/**
 * The surfaces a rock can be dressed in, chosen in the lobby before a run.
 *
 * Only the first carries relief. Its normal, roughness, occlusion and
 * displacement maps were scanned from the same stone as its colour, so they
 * describe the same surface and agree with it. The rest are painted tiles, and
 * lighting them with another rock's relief would emboss one stone's cracks onto
 * a different one's picture — so they are drawn flat, which is also how every
 * illustration in the world around them is drawn.
 *
 * The tints differ for the same reason. The scanned stone is very dark and is
 * lifted by a warm multiplier; the painted ones arrive at the colour their
 * artist chose, and multiplying them by anything only muddies it.
 */
export const ROCK_SURFACES: RockSurface[] = [
  {
    id: 'stone',
    label: 'Stone',
    colorUrl: scannedColorUrl,
    relief: true,
    tint: ROCK_TINT
  },
  {
    id: 'cracked-earth',
    label: 'Cracked earth',
    colorUrl: crackedEarthUrl,
    relief: false,
    tint: 0xffffff
  },
  {
    id: 'red-stone',
    label: 'Red stone',
    colorUrl: redStoneUrl,
    relief: false,
    tint: 0xffffff
  },
  {
    id: 'mossy-stone',
    label: 'Mossy stone',
    colorUrl: mossyStoneUrl,
    relief: false,
    tint: 0xffffff
  }
]

export const DEFAULT_ROCK_SURFACE = 'red-stone'

const defaultSurface = (): RockSurface =>
  ROCK_SURFACES.find((surface) => surface.id === DEFAULT_ROCK_SURFACE) ?? ROCK_SURFACES[0]

/**
 * Looks a surface up by id, falling back to the default.
 *
 * A saved or shared id can outlive the surface it named, and a rock with no
 * material at all is a black hole in the middle of the screen.
 *
 * @param id - Surface id, from the lobby or a peer
 * @returns The matching surface, or the default one
 */
export const rockSurfaceById = (id: string): RockSurface =>
  ROCK_SURFACES.find((surface) => surface.id === id) ?? defaultSurface()

/**
 * The surfaces as the lobby's select field wants them.
 *
 * @returns One option per surface, in catalogue order
 */
export const rockSurfaceOptions = (): { value: string; label: string }[] =>
  ROCK_SURFACES.map((surface) => ({ value: surface.id, label: surface.label }))
