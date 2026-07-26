import treeUrl from '@/assets/images/illustrations/Tree1-1.webp'
import bushUrl from '@/assets/images/illustrations/Bush1-1.webp'
import flowerUrl from '@/assets/images/illustrations/Bush1-2.webp'
import grassUrl from '@/assets/images/illustrations/flowers1.webp'
import rockUrl from '@/assets/images/illustrations/Rock.webp'
import mountainUrl from '@/assets/images/illustrations/Mountain1-1.webp'
import type { ScatterAreaDefinition } from '../types'

const texture = (filename: string, url: string) => ({
  id: filename,
  name: filename,
  filename,
  url
})

/**
 * The illustration families dressing the world, one texture area each.
 *
 * Every area starts from a single variant and carries its own texture list, so
 * the Textures panel can add the other numbered variants (Tree1-2, Tree2-1 and
 * friends) to any area without touching this catalog.
 *
 * The illustration set has no grass-only or flower-only art. `flowers1` is a
 * grass clump with flower heads, so it is the Grass area's texture, and the
 * Flower area falls back to the green plant until a flower illustration exists.
 */
export const SCATTER_AREAS: ScatterAreaDefinition[] = [
  {
    name: 'background',
    label: 'Background',
    textures: [texture('Mountain1-1.webp', mountainUrl)],
    placement: 'background',
    frequency: 6,
    distanceMin: 260,
    distanceMax: 620,
    heightOffset: 30,
    baseSize: [340, 190, 1],
    variation: [0, 40, 400],
    seed: 8100
  },
  {
    name: 'tree',
    label: 'Tree',
    textures: [texture('Tree1-1.webp', treeUrl)],
    placement: 'sides',
    frequency: 26,
    distanceMin: 11,
    distanceMax: 28,
    heightOffset: -1,
    baseSize: [14, 22, 1],
    variation: [0, 0, 50],
    seed: 8200
  },
  {
    name: 'bush',
    label: 'Bush',
    textures: [texture('Bush1-1.webp', bushUrl)],
    placement: 'sides',
    frequency: 34,
    distanceMin: 10,
    distanceMax: 26,
    heightOffset: -0.4,
    baseSize: [5, 4, 1],
    variation: [0, 0, 50],
    seed: 8300
  },
  {
    name: 'flower',
    label: 'Flower',
    textures: [texture('Bush1-2.webp', flowerUrl)],
    placement: 'sides',
    frequency: 40,
    distanceMin: 9,
    distanceMax: 24,
    heightOffset: -0.3,
    baseSize: [3, 2.6, 1],
    variation: [0, 0, 50],
    seed: 8400
  },
  {
    name: 'grass',
    label: 'Grass',
    textures: [texture('flowers1.webp', grassUrl)],
    placement: 'track',
    frequency: 22,
    distanceMin: 0,
    distanceMax: 7,
    heightOffset: -0.2,
    baseSize: [1.8, 1.5, 1],
    variation: [0, 0, 50],
    seed: 8500
  },
  {
    name: 'rock',
    label: 'Rock',
    textures: [texture('Rock.webp', rockUrl)],
    placement: 'track',
    frequency: 9,
    distanceMin: 0,
    distanceMax: 7,
    heightOffset: -0.15,
    baseSize: [2.4, 2, 1],
    variation: [0, 0, 50],
    seed: 8600
  }
]

export const SCATTER_SIZE_VARIATION = 0.05
export const SCATTER_ROTATION_VARIATION = (2 * Math.PI) / 180
