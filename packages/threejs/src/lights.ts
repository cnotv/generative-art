import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CoordinateTuple } from '@webgamekit/animation'
import { EnvironmentLightConfig, LightPreset, LightsConfig } from './types'
import { SCENE_DEFAULTS } from './defaults'
import { textureLoader } from './loaders'

type DirectionalConfig = NonNullable<LightsConfig['directional']>
type ShadowConfig = NonNullable<DirectionalConfig['shadow']>

const applyDirectionalShadow = (light: THREE.DirectionalLight, shadow: ShadowConfig) => {
  const shadowCam = shadow.camera ?? {}
  const mapSize = shadow.mapSize
  light.shadow.mapSize.width = mapSize?.width ?? 4096
  light.shadow.mapSize.height = mapSize?.height ?? 4096
  light.shadow.camera.near = shadowCam.near ?? 0.5
  light.shadow.camera.far = shadowCam.far ?? 500
  light.shadow.camera.left = shadowCam.left ?? -150
  light.shadow.camera.right = shadowCam.right ?? 150
  light.shadow.camera.top = shadowCam.top ?? 150
  light.shadow.camera.bottom = shadowCam.bottom ?? -150
  if (shadow.bias !== undefined) light.shadow.bias = shadow.bias
  if (shadow.radius !== undefined) light.shadow.radius = shadow.radius
  light.shadow.camera.updateProjectionMatrix()
}

/**
 * Create and return default lights
 * @param scene
 * @param config
 * @returns The created directional and ambient lights
 */
export const getLights = (scene: THREE.Scene, config: LightsConfig = {}) => {
  const {
    ambient = SCENE_DEFAULTS.lights.ambient,
    directional = {
      ...SCENE_DEFAULTS.lights.directional,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        camera: { near: 0.5, far: 500, left: -150, right: 150, top: 150, bottom: -150 },
        bias: -0.0001,
        radius: 1
      }
    },
    hemisphere
  } = config

  if (hemisphere?.colors) {
    const hemisphereLight = new THREE.HemisphereLight(...hemisphere.colors)
    hemisphereLight.name = 'hemisphere-light'
    if (hemisphere.intensity !== undefined) hemisphereLight.intensity = hemisphere.intensity
    scene.add(hemisphereLight)
  }

  const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity)
  ambientLight.name = 'ambient-light'
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(directional.color, directional.intensity)
  directionalLight.name = 'directional-light'
  if (directional.position)
    directionalLight.position.set(...(directional.position as CoordinateTuple))
  directionalLight.castShadow = directional.castShadow ?? true

  // Always apply shadow camera defaults so scenes that omit the shadow key
  // still get a large-enough frustum (Three.js default is only ~±5 units).
  applyDirectionalShadow(directionalLight, directional.shadow ?? {})
  scene.add(directionalLight)

  return { directionalLight, ambientLight }
}

/**
 * Whole-rig light presets keyed by time of day. Each is a plain LightsConfig,
 * applied to an existing scene with `updateLights`. Soft, desaturated palettes:
 * a low warm sun at the edges of the day, a cool dim wash at night.
 */
export const lightPresets: Record<LightPreset, LightsConfig> = {
  dawn: {
    ambient: { color: 0xf3e2d9, intensity: 1.6 },
    directional: { color: 0xf7c8a8, intensity: 2.2, position: [60, 15, 20] },
    environment: { intensity: 0.5 }
  },
  noon: {
    ambient: { color: 0xffffff, intensity: 2 },
    directional: { color: 0xfff6e5, intensity: 4, position: [20, 60, 20] },
    environment: { intensity: 1 }
  },
  dusk: {
    ambient: { color: 0xe6d4e0, intensity: 1.4 },
    directional: { color: 0xe8a798, intensity: 1.8, position: [-60, 12, -10] },
    environment: { intensity: 0.4 }
  },
  night: {
    ambient: { color: 0xc3cbe8, intensity: 0.9 },
    directional: { color: 0xbfc8e6, intensity: 0.7, position: [-20, 50, -30] },
    environment: { intensity: 0.15 }
  }
}

const updateAmbientLight = (
  light: THREE.AmbientLight,
  config: NonNullable<LightsConfig['ambient']>
) => {
  if (config.color !== undefined) light.color.set(config.color)
  if (config.intensity !== undefined) light.intensity = config.intensity
}

const updateDirectionalLight = (
  light: THREE.DirectionalLight,
  config: NonNullable<LightsConfig['directional']>
) => {
  if (config.color !== undefined) light.color.set(config.color)
  if (config.intensity !== undefined) light.intensity = config.intensity
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
}

const updateHemisphereLight = (
  light: THREE.HemisphereLight,
  config: NonNullable<LightsConfig['hemisphere']>
) => {
  if (config.colors) {
    light.color.set(config.colors[0])
    light.groundColor.set(config.colors[1])
  }
  if (config.intensity !== undefined) light.intensity = config.intensity
}

/**
 * Apply a LightsConfig onto the lights `getLights` created in the scene, found by their
 * names. Missing lights and missing config keys are skipped, and the environment entry
 * only scales `scene.environmentIntensity`; it never creates the environment texture.
 * @param scene
 * @param config
 */
export const updateLights = (scene: THREE.Scene, config: LightsConfig): void => {
  const ambientLight = scene.getObjectByName('ambient-light')
  if (config.ambient && ambientLight instanceof THREE.AmbientLight)
    updateAmbientLight(ambientLight, config.ambient)

  const directionalLight = scene.getObjectByName('directional-light')
  if (config.directional && directionalLight instanceof THREE.DirectionalLight)
    updateDirectionalLight(directionalLight, config.directional)

  const hemisphereLight = scene.getObjectByName('hemisphere-light')
  if (config.hemisphere && hemisphereLight instanceof THREE.HemisphereLight)
    updateHemisphereLight(hemisphereLight, config.hemisphere)

  if (config.environment && config.environment.intensity !== undefined)
    scene.environmentIntensity = config.environment.intensity
}

const bakeRoomEnvironment = (renderer: THREE.WebGLRenderer): THREE.Texture => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const roomEnvironment = new RoomEnvironment()
  const environmentTexture = pmremGenerator.fromScene(roomEnvironment, 0.04).texture
  roomEnvironment.dispose()
  pmremGenerator.dispose()
  return environmentTexture
}

const loadEquirectangularTexture = (url: string): THREE.Texture => {
  const environmentTexture = textureLoader.load(url)
  environmentTexture.mapping = THREE.EquirectangularReflectionMapping
  environmentTexture.colorSpace = THREE.SRGBColorSpace
  return environmentTexture
}

/**
 * Apply an environment light to the scene: indirect, image-based illumination through
 * `scene.environment`, lighting every PBR material from all directions. Bakes the neutral
 * RoomEnvironment by default, or loads an equirectangular texture when a url is configured.
 * @param renderer
 * @param scene
 * @param config
 * @returns The environment texture, reusable as a material envMap
 */
export const getEnvironmentLight = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  { texture, intensity }: EnvironmentLightConfig = {}
): THREE.Texture => {
  const environmentTexture = texture
    ? loadEquirectangularTexture(texture)
    : bakeRoomEnvironment(renderer)
  scene.environment = environmentTexture
  if (intensity !== undefined) scene.environmentIntensity = intensity
  return environmentTexture
}
