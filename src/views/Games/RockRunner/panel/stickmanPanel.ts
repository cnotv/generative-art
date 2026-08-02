import { reactive } from 'vue'
import { useDebugSceneStore } from '@/stores/debugScene'
import type { StickmanConfig } from '../types'
import { STICKMAN_ELEMENT_NAME, STICKMAN_GROUND_OFFSET, STICKMAN_SCALE } from '../config'

/**
 * The stickman's tunables. There is no physics preset here the way the rock
 * has one: the stickman rides the rock's own sphere collider and never
 * simulates anything of its own, so every property here is purely how it
 * looks riding that sphere.
 */
export const RR_STICKMAN_CONTROLS = {
  scale: { min: 1, max: 10, step: 0.1, label: 'Size' },
  groundOffset: { min: -6, max: 0, step: 0.1, label: 'Ground offset' }
}

export type StickmanPanel = {
  config: StickmanConfig
  teardown: () => void
}

/**
 * Registers the stickman in the elements panel with its cosmetic tunables.
 *
 * Read directly by the run loop every frame (`createDriveAction`), the same
 * way the rock's drive/steering figures are — a slider change is felt on the
 * very next frame with nothing to push it onto, since there is no physics
 * body of its own to update.
 *
 * @returns The shared config and a teardown hook
 */
export const registerStickmanElements = (): StickmanPanel => {
  const debugSceneStore = useDebugSceneStore()
  const config = reactive<StickmanConfig>({
    scale: STICKMAN_SCALE,
    groundOffset: STICKMAN_GROUND_OFFSET
  })

  debugSceneStore.addSceneElement(
    { name: STICKMAN_ELEMENT_NAME, type: 'Mesh', label: 'Player stickman', hidden: false },
    {
      title: 'Player stickman',
      type: 'Mesh',
      schema: RR_STICKMAN_CONTROLS,
      getValue: (path: string) => config[path as keyof StickmanConfig],
      updateValue: (path: string, value: unknown) => {
        config[path as keyof StickmanConfig] = value as number
      }
    }
  )

  return {
    config,
    teardown: () => debugSceneStore.removeSceneElement(STICKMAN_ELEMENT_NAME)
  }
}
