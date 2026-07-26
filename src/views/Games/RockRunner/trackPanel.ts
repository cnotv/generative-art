import { reactive } from 'vue'
import { useDebugSceneStore } from '@/stores/debugScene'
import type { TrackChunkManager, WallConfig } from './types'
import { WALL_ELEMENT_NAME, WALL_HEIGHT, WALL_THICKNESS } from './config'

export const RR_WALL_CONTROLS = {
  height: { min: 0.5, max: 20, step: 0.5, label: 'Height' },
  thickness: { min: 0.2, max: 6, step: 0.2, label: 'Thickness' }
}

export type TrackPanelOptions = {
  manager: TrackChunkManager
  getDistance: () => number
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

  return () => debugSceneStore.removeSceneElement(WALL_ELEMENT_NAME)
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
