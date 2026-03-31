import { ref } from 'vue'
import { SCENE_DEFAULTS } from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/threejs'

export interface SceneGroundConfig {
  enabled: boolean
  color: number
  size: CoordinateTuple
}

export interface SceneLightsConfig {
  ambient: { color: number; intensity: number }
  directional: { color: number; intensity: number; position: CoordinateTuple }
}

export interface SceneSkyConfig {
  enabled: boolean
  color: number
  size: number
}

export interface SceneConfigHandlers {
  onGroundUpdate: (field: string, value: unknown) => void
  onLightsUpdate: (path: string, value: unknown) => void
  onSkyUpdate: (field: string, value: unknown) => void
  onCleanup: () => void
}

const DEFAULT_GROUND_CONFIG: SceneGroundConfig = {
  enabled: true,
  color: SCENE_DEFAULTS.ground.color,
  size: [...SCENE_DEFAULTS.ground.size] as CoordinateTuple
}

const DEFAULT_LIGHTS_CONFIG: SceneLightsConfig = {
  ambient: { ...SCENE_DEFAULTS.lights.ambient },
  directional: {
    color: SCENE_DEFAULTS.lights.directional.color,
    intensity: SCENE_DEFAULTS.lights.directional.intensity,
    position: [...SCENE_DEFAULTS.lights.directional.position] as CoordinateTuple
  }
}

const DEFAULT_SKY_CONFIG: SceneSkyConfig = {
  enabled: true,
  color: SCENE_DEFAULTS.sky.color,
  size: SCENE_DEFAULTS.sky.size
}

// Module-level state — shared across all composable calls
const groundConfig = ref<SceneGroundConfig>({ ...DEFAULT_GROUND_CONFIG })
const lightsConfig = ref<SceneLightsConfig>({
  ambient: { ...DEFAULT_LIGHTS_CONFIG.ambient },
  directional: { ...DEFAULT_LIGHTS_CONFIG.directional }
})
const skyConfig = ref<SceneSkyConfig>({ ...DEFAULT_SKY_CONFIG })
const handlers = ref<SceneConfigHandlers | null>(null)

export const _resetSceneConfig = () => {
  groundConfig.value = { ...DEFAULT_GROUND_CONFIG }
  lightsConfig.value = {
    ambient: { ...DEFAULT_LIGHTS_CONFIG.ambient },
    directional: { ...DEFAULT_LIGHTS_CONFIG.directional }
  }
  skyConfig.value = { ...DEFAULT_SKY_CONFIG }
  handlers.value = null
}

export const useSceneConfig = () => {
  const registerSceneHandlers = (newHandlers: SceneConfigHandlers) => {
    handlers.value = newHandlers
  }

  const unregisterSceneHandlers = () => {
    handlers.value?.onCleanup()
    handlers.value = null
    groundConfig.value = { ...DEFAULT_GROUND_CONFIG }
    lightsConfig.value = {
      ambient: { ...DEFAULT_LIGHTS_CONFIG.ambient },
      directional: { ...DEFAULT_LIGHTS_CONFIG.directional }
    }
    skyConfig.value = { ...DEFAULT_SKY_CONFIG }
  }

  const updateGroundField = (field: keyof SceneGroundConfig, value: unknown) => {
    groundConfig.value = { ...groundConfig.value, [field]: value }
    handlers.value?.onGroundUpdate(field, value)
  }

  const updateLightsField = (path: string, value: unknown) => {
    const parts = path.split('.')
    const group = parts[0] as keyof SceneLightsConfig
    const field = parts[1]
    if (group && field) {
      lightsConfig.value = {
        ...lightsConfig.value,
        [group]: { ...(lightsConfig.value[group] as Record<string, unknown>), [field]: value }
      }
    }
    handlers.value?.onLightsUpdate(path, value)
  }

  const updateSkyField = (field: keyof SceneSkyConfig, value: unknown) => {
    skyConfig.value = { ...skyConfig.value, [field]: value }
    handlers.value?.onSkyUpdate(field, value)
  }

  return {
    groundConfig,
    lightsConfig,
    skyConfig,
    registerSceneHandlers,
    unregisterSceneHandlers,
    updateGroundField,
    updateLightsField,
    updateSkyField
  }
}
