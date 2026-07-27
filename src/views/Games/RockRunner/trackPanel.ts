import { reactive } from 'vue'
import * as THREE from 'three'
import { useDebugSceneStore } from '@/stores/debugScene'
import type {
  FogConfig,
  LateralFogUniforms,
  TrackChunkManager,
  TrackDimensions,
  WallConfig
} from './types'
import {
  FOG_COLOR,
  FOG_ELEMENT_NAME,
  FOG_FAR,
  FOG_NEAR,
  FOG_SIDE_FAR,
  FOG_SIDE_NEAR,
  MIN_TURN_RADIUS,
  TERRAIN_WIDTH,
  TRACK_ELEMENT_NAME,
  TRACK_WIDTH,
  WALL_ELEMENT_NAME,
  WALL_HEIGHT,
  WALL_THICKNESS
} from './config'

export const RR_WALL_CONTROLS = {
  height: { min: 0.5, max: 60, step: 0.5, label: 'Height' },
  thickness: { min: 0.2, max: 6, step: 0.2, label: 'Thickness' }
}

// The countryside is a ribbon swept along a curving path, so it folds through
// itself once its half-width passes the path's tightest turn radius. The slider
// stops just short of that, which is the widest the ground can physically be.
export const MAX_TERRAIN_WIDTH = Math.floor(MIN_TURN_RADIUS * 2) - 2

export const RR_TRACK_CONTROLS = {
  trackWidth: { min: 6, max: 40, step: 1, label: 'Path width' },
  terrainWidth: {
    min: TRACK_WIDTH,
    max: MAX_TERRAIN_WIDTH,
    step: 1,
    label: 'Side ground width'
  }
}

// Fog and sky share one colour: any difference between them shows up as a hard
// band where the faded world meets the backdrop.
export const RR_FOG_CONTROLS = {
  color: { label: 'Colour', color: true },
  near: { min: 0, max: 600, step: 5, label: 'Ahead: starts at' },
  far: { min: 20, max: 2000, step: 10, label: 'Ahead: fully faded at' },
  // Three's fog is measured from the camera, so it only ever hides what is
  // ahead. These two fade by distance from the track centreline instead, which
  // is the only way to soften the strip's long side edges.
  sideNear: { min: 0, max: 300, step: 1, label: 'Sides: starts at', sectionStart: true },
  sideFar: { min: 1, max: 400, step: 1, label: 'Sides: fully faded at' }
}

export type TrackPanelOptions = {
  manager: TrackChunkManager
  getDistance: () => number
  scene: THREE.Scene
  lateralFog: LateralFogUniforms
  /** Receives a setter the run loop calls as the staged palette advances. */
  onStageColor?: (apply: (color: number) => void) => void
}

/**
 * Registers the containment walls in the elements panel.
 *
 * The walls are physical but never rendered, so they start with the panel's
 * hidden state on. Toggling the row reveals them, which is the only way to see
 * where the invisible boundary actually sits while tuning it.
 *
 * @param options - The chunk manager to drive and the rock's current distance
 * @returns A teardown that removes the panel entry
 */
export const registerTrackElements = (options: TrackPanelOptions): (() => void) => {
  const debugSceneStore = useDebugSceneStore()
  const wall = reactive<WallConfig>({ height: WALL_HEIGHT, thickness: WALL_THICKNESS })
  const dimensions = reactive<TrackDimensions>({
    trackWidth: TRACK_WIDTH,
    terrainWidth: TERRAIN_WIDTH
  })

  debugSceneStore.addSceneElement(
    { name: TRACK_ELEMENT_NAME, type: 'Mesh', label: 'Track', hidden: false },
    {
      title: 'Track',
      type: 'Mesh',
      schema: RR_TRACK_CONTROLS,
      getValue: (path: string) => dimensions[path as keyof TrackDimensions],
      updateValue: (path: string, value: unknown) => {
        dimensions[path as keyof TrackDimensions] = value as number
        // The side ground can never be narrower than the path it flanks.
        if (dimensions.terrainWidth < dimensions.trackWidth) {
          dimensions.terrainWidth = dimensions.trackWidth
        }
        options.manager.setDimensions({ ...dimensions }, options.getDistance())
      }
    }
  )

  debugSceneStore.addSceneElement(
    { name: WALL_ELEMENT_NAME, type: 'Mesh', label: 'Edge walls', hidden: true },
    {
      title: 'Edge walls',
      type: 'Mesh',
      schema: RR_WALL_CONTROLS,
      getValue: (path: string) => wall[path as keyof WallConfig],
      updateValue: (path: string, value: unknown) => {
        wall[path as keyof WallConfig] = value as number
        options.manager.setWall({ ...wall }, options.getDistance())
      }
    }
  )

  const fog = reactive<FogConfig>({
    color: FOG_COLOR,
    near: FOG_NEAR,
    far: FOG_FAR,
    sideNear: FOG_SIDE_NEAR,
    sideFar: FOG_SIDE_FAR
  })

  // Editing the colour by hand takes it off the staged palette: touching a
  // control should hand control over, not have the next milestone undo it.
  let colorIsManual = false

  const applyFog = (): void => {
    const scene = options.scene
    scene.fog = new THREE.Fog(fog.color, fog.near, Math.max(fog.near + 1, fog.far))
    if (scene.background instanceof THREE.Color) scene.background.setHex(fog.color)
    options.lateralFog.lateralFogColor.value.setHex(fog.color)
    options.lateralFog.lateralFogNear.value = fog.sideNear
    options.lateralFog.lateralFogFar.value = Math.max(fog.sideNear + 1, fog.sideFar)
  }

  debugSceneStore.addSceneElement(
    { name: FOG_ELEMENT_NAME, type: 'Fog', label: 'Fog', hidden: false },
    {
      title: 'Fog',
      type: 'Fog',
      schema: RR_FOG_CONTROLS,
      getValue: (path: string) => fog[path as keyof FogConfig],
      updateValue: (path: string, value: unknown) => {
        if (path === 'color') colorIsManual = true
        fog[path as keyof FogConfig] = value as number
        applyFog()
      }
    }
  )

  options.onStageColor?.((color: number) => {
    if (colorIsManual || fog.color === color) return
    fog.color = color
    applyFog()
  })

  return () => {
    debugSceneStore.removeSceneElement(WALL_ELEMENT_NAME)
    debugSceneStore.removeSceneElement(TRACK_ELEMENT_NAME)
    debugSceneStore.removeSceneElement(FOG_ELEMENT_NAME)
  }
}

/**
 * Builds the single visibility dispatcher the debug scene store calls for plain
 * scene elements, routing each name to whatever owns it.
 *
 * @param toggles - Visibility setters keyed by element name
 * @returns The handlers to hand to `setSceneElements`
 */
export const createElementVisibilityHandlers = (
  toggles: Record<string, (hidden: boolean) => void>
) => {
  const debugSceneStore = useDebugSceneStore()
  return {
    onToggleVisibility: (name: string) => {
      const element = debugSceneStore.sceneElements.find((entry) => entry.name === name)
      toggles[name]?.(element?.hidden ?? false)
    },
    onRemove: () => {}
  }
}
