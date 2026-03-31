import type { Ref } from 'vue'
import * as THREE from 'three'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects'

interface TextureAreaLayer {
  name: string
  texture: string
  baseSize: [number, number, number]
  center: [number, number, number]
  size: [number, number, number]
  density: number
  seed: number
  speed: number
  opacity: number
}

interface RegisterTextureAreaOptions {
  areaName: string
  layers: TextureAreaLayer[]
  schema: Record<string, unknown>
  areaConfigs: Ref<Record<string, Record<string, unknown>>>
  scene?: THREE.Scene
  onUpdate?: (areaName: string, path: string, value: unknown) => void
}

/**
 * Builds initial config state for a texture area from its layers.
 * Extracts area center/size, texture baseSize, instance density/seed, and rendering opacity/speed
 * from the first layer in the group.
 */
export const buildTextureAreaConfig = (layers: TextureAreaLayer[]): Record<string, unknown> => {
  if (layers.length === 0) return {}
  const firstLayer = layers[0]
  return {
    area: {
      center: { x: firstLayer.center[0], y: firstLayer.center[1], z: firstLayer.center[2] },
      size: { x: firstLayer.size[0], y: firstLayer.size[1], z: firstLayer.size[2] }
    },
    textures: {
      baseSize: { x: firstLayer.baseSize[0], y: firstLayer.baseSize[1], z: firstLayer.baseSize[2] }
    },
    instances: {
      density: firstLayer.density,
      seed: firstLayer.seed
    },
    rendering: {
      opacity: firstLayer.opacity,
      speed: firstLayer.speed
    }
  }
}

/**
 * Registers texture area element properties for the properties panel.
 * Manages nested config state and syncs changes via onUpdate callback.
 *
 * @param options.areaName - Unique area identifier (e.g., 'cloud', 'hill')
 * @param options.layers - Config layers for this area (used to build initial state)
 * @param options.schema - Schema defining the property controls (e.g., textureAreaControls)
 * @param options.areaConfigs - Ref holding all area configs (shared across multiple areas)
 * @param options.onUpdate - Optional callback when a value changes (receives areaName, path, value)
 */
export const registerTextureAreaProperties = ({
  areaName,
  layers,
  schema,
  areaConfigs,
  onUpdate
}: RegisterTextureAreaOptions): void => {
  const elementPropertiesStore = useElementPropertiesStore()

  // Initialize config for this area if not already present
  if (!areaConfigs.value[areaName]) {
    areaConfigs.value = {
      ...areaConfigs.value,
      [areaName]: buildTextureAreaConfig(layers)
    }
  }

  elementPropertiesStore.registerElementProperties(areaName, {
    title: areaName.charAt(0).toUpperCase() + areaName.slice(1),
    type: 'TextureArea',
    schema,
    getValue: (path: string) => getNestedValue(areaConfigs.value[areaName], path),
    updateValue: (path: string, value: unknown) => {
      areaConfigs.value = {
        ...areaConfigs.value,
        [areaName]: setNestedValueImmutable(areaConfigs.value[areaName], path, value)
      }
      onUpdate?.(areaName, path, value)
    }
  })
}
