import treeUrl from '@/assets/images/illustrations/Tree1-1.webp'
import treeTwoUrl from '@/assets/images/illustrations/Tree1-2.webp'
// Later stages. The files keep their names because ForestGame imports the same
// set; the staging lives here rather than in the filenames.
import treeMidUrl from '@/assets/images/illustrations/Tree1-6.webp'
import treeLateUrl from '@/assets/images/illustrations/Tree1-8.webp'
import treeTwoMidUrl from '@/assets/images/illustrations/Tree1-4.webp'
import treeTwoLateUrl from '@/assets/images/illustrations/Tree1-7.webp'
import bushLateUrl from '@/assets/images/illustrations/Bush1-2.webp'
import bushUrl from '@/assets/images/illustrations/Bush1-1.webp'
import flowerUrl from '@/assets/images/illustrations/flowers1.webp'
import grassUrl from '@/assets/images/illustrations/Grass1-1.webp'
import rockUrl from '@/assets/images/illustrations/Rock.webp'
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
 */
export const SCATTER_AREAS: ScatterAreaDefinition[] = [
  {
    name: 'tree',
    label: 'Tree',
    textures: [texture('Tree1-1.webp', treeUrl)],
    textureStages: [
      [texture('Tree1-1.webp', treeUrl)],
      [texture('Tree1-6.webp', treeMidUrl)],
      [texture('Tree1-8.webp', treeLateUrl)]
    ],
    placement: 'sides',
    frequency: 100,
    distanceMin: 14,
    distanceMax: 45,
    heightOffset: -1,
    baseSize: [47.8, 53.4, 1],
    variation: [0, 0, 50],
    sizeVariation: 0.18,
    rotationVariation: 10.5,
    seed: 8200
  },
  {
    name: 'tree-2',
    label: 'Tree 2',
    textures: [texture('Tree1-2.webp', treeTwoUrl)],
    textureStages: [
      [texture('Tree1-2.webp', treeTwoUrl)],
      [texture('Tree1-4.webp', treeTwoMidUrl)],
      [texture('Tree1-7.webp', treeTwoLateUrl)]
    ],
    placement: 'sides',
    frequency: 100,
    distanceMin: 14,
    distanceMax: 45,
    heightOffset: -1,
    // 70% of Tree, so the two variants read as different specimens of the same
    // species rather than as one tree repeated.
    baseSize: [33.46, 37.38, 1],
    variation: [0, 0, 50],
    sizeVariation: 0.18,
    rotationVariation: 10.5,
    seed: 8250
  },
  {
    name: 'bush',
    label: 'Bush',
    textures: [texture('Bush1-2.webp', bushLateUrl)],
    // Only two illustrations across three stages, so one is held for a stage.
    // It is the second that repeats, which leaves the wrap back to the first a
    // real change rather than a boundary where nothing happens.
    textureStages: [
      [texture('Bush1-2.webp', bushLateUrl)],
      [texture('Bush1-1.webp', bushUrl)],
      [texture('Bush1-1.webp', bushUrl)]
    ],
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
    textures: [texture('flowers1.webp', flowerUrl)],
    placement: 'sides',
    frequency: 70,
    distanceMin: 11,
    distanceMax: 24,
    heightOffset: -0.3,
    baseSize: [3, 2.6, 1],
    variation: [0, 0, 50],
    seed: 8400
  },
  {
    name: 'grass',
    label: 'Grass',
    textures: [texture('Grass1-1.webp', grassUrl)],
    placement: 'everywhere',
    frequency: 120,
    distanceMin: 0,
    distanceMax: 12,
    heightOffset: -0.2,
    baseSize: [3.6, 1, 1],
    variation: [0, 0, 50],
    seed: 8500
  },
  {
    name: 'rock',
    label: 'Rock',
    textures: [texture('Rock.webp', rockUrl)],
    placement: 'sides',
    frequency: 50,
    distanceMin: 12,
    distanceMax: 26,
    heightOffset: -0.15,
    baseSize: [6.5, 2, 1],
    variation: [0, 0, 50],
    seed: 8600
  }
]

export const SCATTER_SIZE_VARIATION = 0.05
export const SCATTER_ROTATION_VARIATION = (2 * Math.PI) / 180
