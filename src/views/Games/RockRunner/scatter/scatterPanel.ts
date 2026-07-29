import { reactive, toRaw } from 'vue'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useTextureGroupsStore } from '@/stores/textureGroups'
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects'
import { SCATTER_AREAS, SCATTER_ROTATION_VARIATION, SCATTER_SIZE_VARIATION } from './illustrations'
import { MAX_SCATTER_DISTANCE } from '../config'
import { texturesAt } from './textureStages'
import type {
  ScatterAreaConfig,
  ScatterAreaDefinition,
  ScatterAreaManager,
  ScatterTexture
} from '../types'

const DEGREES_PER_RADIAN = 180 / Math.PI

/**
 * The property tree one scatter area exposes, keyed the way the texture-area
 * panel nests its controls.
 */
export type ScatterAreaPanelConfig = {
  area: {
    center: { x: number; y: number; z: number }
    size: { x: number; y: number; z: number }
  }
  textures: {
    baseSize: { x: number; y: number; z: number }
    sizeVariation: number
    rotationVariation: number
  }
  scatter: {
    frequency: number
    distanceMin: number
    distanceMax: number
    heightOffset: number
  }
  instances: { seed: number }
  rendering: { opacity: number }
}

/**
 * Controls for a scatter area: the standard texture-area sections, plus the
 * `scatter` section that places instances relative to the track rather than
 * inside a fixed box.
 *
 * `area.size` is the per-axis random spread — X is lateral, Y is vertical and Z
 * runs along the track — and `area.center` shifts every instance by a fixed
 * amount. Together they replace the fixed bounding box a static texture area
 * would use, since this area follows the rock instead of standing still.
 */
export const RR_SCATTER_CONTROLS = {
  scatter: {
    frequency: { min: 0, max: 120, step: 1, label: 'Frequency (per 100m)' },
    // Capped at the fold limit: a slider reaching past it only produces a band
    // the inside of every bend turns inside out.
    distanceMin: {
      min: 0,
      max: MAX_SCATTER_DISTANCE,
      step: 1,
      label: 'Distance from track (near)'
    },
    distanceMax: {
      min: 0,
      max: MAX_SCATTER_DISTANCE,
      step: 1,
      label: 'Distance from track (far)'
    },
    heightOffset: { min: -20, max: 200, step: 0.5, label: 'Height above ground' }
  },
  textures: {
    baseSize: {
      label: 'Size',
      component: 'CoordinateInput',
      min: { x: 0.2, y: 0.2, z: 1 },
      max: { x: 500, y: 400, z: 1 },
      step: { x: 0.2, y: 0.2, z: 1 },
      sectionStart: true
    },
    sizeVariation: { min: 0, max: 1, step: 0.01, label: 'Size variation' },
    rotationVariation: { min: 0, max: 45, step: 0.5, label: 'Rotation variation (deg)' }
  },
  area: {
    center: {
      label: 'Offset',
      component: 'CoordinateInput',
      min: { x: -200, y: -100, z: -500 },
      max: { x: 200, y: 300, z: 500 },
      step: { x: 1, y: 1, z: 5 },
      sectionStart: true
    },
    size: {
      label: 'Position variation',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 200, y: 200, z: 600 },
      step: { x: 1, y: 1, z: 5 }
    }
  },
  instances: {
    seed: { min: 0, max: 9999, step: 1, label: 'Seed', sectionStart: true }
  },
  rendering: {
    opacity: { min: 0, max: 1, step: 0.05, label: 'Opacity', sectionStart: true }
  }
}

/**
 * Initial panel state for an area, derived from its catalog entry.
 *
 * @param definition - The area's catalog entry
 * @returns The nested config the panel reads and writes
 */
export const buildScatterPanelConfig = (
  definition: ScatterAreaDefinition
): ScatterAreaPanelConfig => ({
  area: {
    center: { x: 0, y: 0, z: 0 },
    size: {
      x: definition.variation[0],
      y: definition.variation[1],
      z: definition.variation[2]
    }
  },
  textures: {
    baseSize: {
      x: definition.baseSize[0],
      y: definition.baseSize[1],
      z: definition.baseSize[2]
    },
    sizeVariation: definition.sizeVariation ?? SCATTER_SIZE_VARIATION,
    rotationVariation:
      definition.rotationVariation ?? SCATTER_ROTATION_VARIATION * DEGREES_PER_RADIAN
  },
  scatter: {
    frequency: definition.frequency,
    distanceMin: definition.distanceMin,
    distanceMax: definition.distanceMax,
    heightOffset: definition.heightOffset
  },
  instances: { seed: definition.seed },
  rendering: { opacity: 1 }
})

/**
 * Flattens the panel's nested state into the shape the placement maths takes.
 *
 * @param panelConfig - Nested config as edited in the panel
 * @returns The area config used to place instances
 */
export const toScatterAreaConfig = (panelConfig: ScatterAreaPanelConfig): ScatterAreaConfig => ({
  center: [panelConfig.area.center.x, panelConfig.area.center.y, panelConfig.area.center.z],
  variation: [panelConfig.area.size.x, panelConfig.area.size.y, panelConfig.area.size.z],
  baseSize: [
    panelConfig.textures.baseSize.x,
    panelConfig.textures.baseSize.y,
    panelConfig.textures.baseSize.z
  ],
  sizeVariation: panelConfig.textures.sizeVariation,
  rotationVariation: panelConfig.textures.rotationVariation / DEGREES_PER_RADIAN,
  frequency: panelConfig.scatter.frequency,
  distanceMin: panelConfig.scatter.distanceMin,
  distanceMax: panelConfig.scatter.distanceMax,
  heightOffset: panelConfig.scatter.heightOffset,
  seed: panelConfig.instances.seed,
  opacity: panelConfig.rendering.opacity
})

export type ScatterPanelState = {
  configs: Record<string, ScatterAreaPanelConfig>
  areaConfig: (name: string) => ScatterAreaConfig
  areaTextures: (name: string, distance: number) => ScatterTexture[]
  register: (managers: ScatterAreaManager[], getDistance: () => number) => void
  teardown: () => void
}

/**
 * Holds the panel state for every scatter area and wires it to the elements and
 * textures panels.
 *
 * Created before the managers exist so the placement maths can read live config
 * from the first chunk onward; `register` then connects the managers so edits
 * rebuild what is already on screen.
 *
 * @returns The panel state, its accessors and a teardown
 */
export const createScatterPanel = (): ScatterPanelState => {
  const debugSceneStore = useDebugSceneStore()
  const textureStore = useTextureGroupsStore()
  const elementPropertiesStore = useElementPropertiesStore()

  const configs = reactive(
    SCATTER_AREAS.reduce<Record<string, ScatterAreaPanelConfig>>(
      (all, definition) => ({ ...all, [definition.name]: buildScatterPanelConfig(definition) }),
      {}
    )
  )

  const areaConfig = (name: string): ScatterAreaConfig => toScatterAreaConfig(toRaw(configs)[name])

  const areaTextures = (name: string, distance: number): ScatterTexture[] => {
    const definition = SCATTER_AREAS.find((area) => area.name === name)
    const live = textureStore.groups.find((group) => group.id === name)?.textures
    if (!definition) return live ?? []
    return texturesAt(definition, distance, live ?? definition.textures)
  }

  const register = (managers: ScatterAreaManager[], getDistance: () => number): void => {
    const managerByName = new Map(managers.map((manager) => [manager.name, manager]))

    textureStore.$patch({
      groups: [
        ...textureStore.groups.filter(
          (group) => !SCATTER_AREAS.some((definition) => definition.name === group.id)
        ),
        ...SCATTER_AREAS.map((definition) => ({
          id: definition.name,
          name: definition.label,
          textures: definition.textures,
          instanceCount: managerByName.get(definition.name)?.instanceCount() ?? 0
        }))
      ]
    })

    debugSceneStore.$patch({
      sceneGroups: {
        ...debugSceneStore.sceneGroups,
        ...SCATTER_AREAS.reduce<Record<string, string>>(
          (all, definition) => ({ ...all, [definition.name]: definition.label }),
          {}
        )
      }
    })

    SCATTER_AREAS.forEach((definition) => {
      debugSceneStore.addSceneElement(
        {
          name: definition.name,
          type: 'TextureArea',
          hidden: false,
          groupId: definition.name
        },
        {
          title: definition.label,
          type: 'TextureArea',
          schema: RR_SCATTER_CONTROLS,
          // Read and write through the reactive proxy, never through toRaw: a
          // raw read is not tracked, so the panel would keep showing the old
          // number while the scene rebuilt with the new one.
          getValue: (path: string) => getNestedValue(configs[definition.name], path),
          updateValue: (path: string, value: unknown) => {
            configs[definition.name] = setNestedValueImmutable(
              configs[definition.name],
              path,
              value
            ) as ScatterAreaPanelConfig
            if (textureStore.autoUpdate) managerByName.get(definition.name)?.rebuild(getDistance())
          }
        }
      )
    })

    const rebuildAll = (): void => managers.forEach((manager) => manager.rebuild(getDistance()))

    textureStore.registerHandlers({
      onSelectGroup: (id) => {
        if (managerByName.has(id)) elementPropertiesStore.openElementProperties(id)
      },
      onToggleVisibility: (id) => {
        const manager = managerByName.get(id)
        if (!manager) return
        const group = textureStore.groups.find((entry) => entry.id === id)
        const isNowHidden = !group?.hidden
        textureStore.$patch({
          groups: textureStore.groups.map((entry) =>
            entry.id === id ? { ...entry, hidden: isNowHidden } : entry
          )
        })
        manager.setHidden(isNowHidden)
      },
      onToggleWireframe: () => {},
      onRemoveGroup: (id) => managerByName.get(id)?.teardown(),
      onRemoveTexture: () => rebuildAll(),
      onAddTextureToGroup: () => {},
      onAddNewGroup: () => {},
      onManualUpdate: rebuildAll,
      onAddElement: () => {}
    })
  }

  const teardown = (): void => {
    SCATTER_AREAS.forEach((definition) => debugSceneStore.removeSceneElement(definition.name))
    textureStore.$patch({
      groups: textureStore.groups.filter(
        (group) => !SCATTER_AREAS.some((definition) => definition.name === group.id)
      )
    })
  }

  return { configs, areaConfig, areaTextures, register, teardown }
}
