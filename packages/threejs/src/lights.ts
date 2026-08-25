import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CoordinateTuple } from '@webgamekit/animation'
import {
  EnvironmentLightConfig,
  LightPreset,
  LightPresetConfig,
  LightRig,
  LightsConfig
} from './types'
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
 * Whole-rig light presets keyed by time of day. Each describes every light working
 * together rather than a single lamp: a hemisphere carrying the sky and ground bounce,
 * a sun (or moon) at the elevation of that hour, a low flat ambient so shadows never go
 * black, the environment intensity, and the sky colour itself. Applied with `updateLights`,
 * which creates whichever of these the scene does not have yet.
 */
export const lightPresets: Record<LightPreset, LightRig> = {
  dawn: {
    sky: { color: 0xf2c4a8 },
    hemisphere: { colors: [0xf7d4b8, 0x6b5d52], intensity: 0.9 },
    ambient: { color: 0xffe8d8, intensity: 0.35 },
    directional: { color: 0xffb37a, intensity: 2.6, position: [80, 12, 30] },
    environment: { intensity: 0.4 }
  },
  noon: {
    sky: { color: 0x87ceeb },
    hemisphere: { colors: [0xbfe3ff, 0x8a8f7a], intensity: 1 },
    ambient: { color: 0xffffff, intensity: 0.4 },
    directional: { color: 0xfff4e0, intensity: 2.3, position: [25, 80, 15] },
    environment: { intensity: 0.7 }
  },
  dusk: {
    sky: { color: 0xe89b7d },
    hemisphere: { colors: [0xf0b391, 0x4a4458], intensity: 0.85 },
    ambient: { color: 0xe8cabc, intensity: 0.3 },
    directional: { color: 0xff9d6b, intensity: 2.2, position: [-80, 10, -20] },
    environment: { intensity: 0.35 }
  },
  night: {
    sky: { color: 0x1f2740 },
    hemisphere: { colors: [0x2e3d66, 0x10121c], intensity: 0.22 },
    ambient: { color: 0xbcc7e8, intensity: 0.05 },
    directional: { color: 0xa9b8e0, intensity: 0.25, position: [-30, 60, -40] },
    environment: { intensity: 0.05 }
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

const ensureAmbientLight = (scene: THREE.Scene): THREE.AmbientLight => {
  const existing = scene.getObjectByName('ambient-light')
  if (existing instanceof THREE.AmbientLight) return existing
  const light = new THREE.AmbientLight()
  light.name = 'ambient-light'
  scene.add(light)
  return light
}

const ensureDirectionalLight = (scene: THREE.Scene): THREE.DirectionalLight => {
  const existing = scene.getObjectByName('directional-light')
  if (existing instanceof THREE.DirectionalLight) return existing
  const light = new THREE.DirectionalLight()
  light.name = 'directional-light'
  light.castShadow = true
  applyDirectionalShadow(light, {})
  scene.add(light)
  return light
}

const ensureHemisphereLight = (scene: THREE.Scene): THREE.HemisphereLight => {
  const existing = scene.getObjectByName('hemisphere-light')
  if (existing instanceof THREE.HemisphereLight) return existing
  const light = new THREE.HemisphereLight()
  light.name = 'hemisphere-light'
  scene.add(light)
  return light
}

const updateSkyColor = (scene: THREE.Scene, color: number) => {
  const skyMesh = scene.getObjectByName('sky')
  if (skyMesh instanceof THREE.Mesh && skyMesh.material instanceof THREE.MeshBasicMaterial)
    skyMesh.material.color.set(color)
  if (scene.background instanceof THREE.Color) scene.background.set(color)
}

/**
 * Apply a whole light rig onto the scene: each light group the config names is updated in
 * place, or created with the standard names when the scene lacks it, so a preset can rely
 * on its full setup of lights. The environment entry only scales
 * `scene.environmentIntensity` (never creating the environment texture), and a sky entry
 * recolours the `sky` mesh and the scene background.
 * @param scene
 * @param config
 */
export const updateLights = (scene: THREE.Scene, config: LightPresetConfig): void => {
  if (config.ambient) updateAmbientLight(ensureAmbientLight(scene), config.ambient)
  if (config.directional) updateDirectionalLight(ensureDirectionalLight(scene), config.directional)
  if (config.hemisphere) updateHemisphereLight(ensureHemisphereLight(scene), config.hemisphere)

  if (config.environment && config.environment.intensity !== undefined)
    scene.environmentIntensity = config.environment.intensity

  if (config.sky?.color !== undefined) updateSkyColor(scene, config.sky.color)
}

const blendFromColor = new THREE.Color()
const blendToColor = new THREE.Color()

const blendHexColors = (from: number, to: number, alpha: number): number =>
  blendFromColor.setHex(from).lerp(blendToColor.setHex(to), alpha).getHex()

const blendNumbers = (from: number, to: number, alpha: number): number => from + (to - from) * alpha

/**
 * Interpolate between two complete light rigs, for animating a day cycle. Colours lerp
 * through THREE.Color, intensities and the sun position linearly. Apply the result with
 * `updateLights`.
 * @param from The rig at alpha 0
 * @param to The rig at alpha 1
 * @param alpha Blend position between the two, 0 to 1
 * @returns The blended rig
 */
export const blendLightPresets = (from: LightRig, to: LightRig, alpha: number): LightRig => ({
  sky: { color: blendHexColors(from.sky.color, to.sky.color, alpha) },
  hemisphere: {
    colors: [
      blendHexColors(from.hemisphere.colors[0], to.hemisphere.colors[0], alpha),
      blendHexColors(from.hemisphere.colors[1], to.hemisphere.colors[1], alpha)
    ],
    intensity: blendNumbers(from.hemisphere.intensity, to.hemisphere.intensity, alpha)
  },
  ambient: {
    color: blendHexColors(from.ambient.color, to.ambient.color, alpha),
    intensity: blendNumbers(from.ambient.intensity, to.ambient.intensity, alpha)
  },
  directional: {
    color: blendHexColors(from.directional.color, to.directional.color, alpha),
    intensity: blendNumbers(from.directional.intensity, to.directional.intensity, alpha),
    position: [
      blendNumbers(from.directional.position[0], to.directional.position[0], alpha),
      blendNumbers(from.directional.position[1], to.directional.position[1], alpha),
      blendNumbers(from.directional.position[2], to.directional.position[2], alpha)
    ]
  },
  environment: {
    intensity: blendNumbers(from.environment.intensity, to.environment.intensity, alpha)
  }
})

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
