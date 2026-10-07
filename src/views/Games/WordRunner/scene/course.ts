import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { createTrackPath } from '@/views/Games/RockRunner/trackPath'
import { createTrackChunkManager } from '@/views/Games/RockRunner/trackChunks'
import { createLateralFogUniforms } from '@/views/Games/RockRunner/lateralFog'
import { createScatterAreaManager } from '@/views/Games/RockRunner/scatter/scatterAreas'
import { SCATTER_AREAS } from '@/views/Games/RockRunner/scatter/illustrations'
import {
  buildScatterPanelConfig,
  toScatterAreaConfig
} from '@/views/Games/RockRunner/scatter/scatterPanel'
import { texturesAt } from '@/views/Games/RockRunner/scatter/textureStages'
import {
  FOG_COLOR,
  FOG_SIDE_FAR,
  FOG_SIDE_NEAR,
  SCATTER_CHUNK_LENGTH,
  WALL_HEIGHT,
  WALL_THICKNESS
} from '@/views/Games/RockRunner/config'
import { SCATTER_LANE_CLEARANCE } from '../config'
import type { Course } from '../types'

/**
 * Rock Runner's world for one level: its seeded track, the terrain and drawn edges either
 * side, and the scattered illustrations, all in its fog. A level is longer than one build
 * reaches, so it streams like Rock Runner's own track: built ahead of the leading ball one
 * chunk a frame, and taken down behind the trailing one.
 */
export const createCourse = (scene: THREE.Scene, world: RAPIER.World, seed: number): Course => {
  const path = createTrackPath(seed)
  const lateralFog = createLateralFogUniforms(FOG_COLOR, FOG_SIDE_NEAR, FOG_SIDE_FAR)
  const track = createTrackChunkManager({
    scene,
    world,
    path,
    wall: { height: WALL_HEIGHT, thickness: WALL_THICKNESS },
    lateralFog
  })
  const scatter = SCATTER_AREAS.map((definition, index) => {
    const base = toScatterAreaConfig(buildScatterPanelConfig(definition))
    // Grass is scattered everywhere, deck included; here it would stand in the lanes.
    const config = { ...base, distanceMin: Math.max(base.distanceMin, SCATTER_LANE_CLEARANCE) }
    return createScatterAreaManager({
      scene,
      path,
      definition,
      lateralFog,
      getConfig: () => config,
      getTextures: (distance: number) => texturesAt(definition, distance, definition.textures),
      chunkPhase: (index * SCATTER_CHUNK_LENGTH) / SCATTER_AREAS.length
    })
  })
  track.ensureAhead(0)
  scatter.forEach((area) => area.ensureAhead(0))

  const advance = (leadingDistance: number, trailingDistance: number): void => {
    track.pump(leadingDistance)
    scatter.forEach((area) => area.pump(leadingDistance))
    track.prune(trailingDistance)
    scatter.forEach((area) => area.prune(trailingDistance))
  }
  const restart = (): void => {
    track.rebuild(0)
    scatter.forEach((area) => area.rebuild(0))
  }
  const dispose = (): void => {
    scatter.forEach((area) => area.teardown())
    track.teardown()
  }
  return { path, advance, restart, dispose }
}
