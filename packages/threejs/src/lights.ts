import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js'
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

type DirectionalConfig = NonNullable<Exclude<LightsConfig['directional'], false>>
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

/** Local shadow map settings for the lights that light their own surroundings. */
const applyLocalShadow = (light: THREE.PointLight | THREE.SpotLight) => {
  light.shadow.mapSize.width = 2048
  light.shadow.mapSize.height = 2048
  light.shadow.camera.near = 0.5
  light.shadow.camera.far = 50
  light.shadow.bias = -0.0001
}

const addHelper = (scene: THREE.Scene, helper: THREE.Object3D, name: string) => {
  helper.name = name
  scene.add(helper)
}

const HELPER_SIZE = 5

const createPointLight = (
  scene: THREE.Scene,
  config: NonNullable<LightsConfig['point']>
): THREE.PointLight => {
  const light = new THREE.PointLight(config.color ?? 0xffffff, config.intensity ?? 1)
  light.name = 'point-light'
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
  if (config.distance !== undefined) light.distance = config.distance
  if (config.decay !== undefined) light.decay = config.decay
  light.castShadow = config.castShadow ?? true
  applyLocalShadow(light)
  scene.add(light)
  if (config.helper)
    addHelper(scene, new THREE.PointLightHelper(light, HELPER_SIZE), 'point-light-helper')
  return light
}

const createSpotLight = (
  scene: THREE.Scene,
  config: NonNullable<LightsConfig['spot']>
): THREE.SpotLight => {
  const light = new THREE.SpotLight(config.color ?? 0xffffff, config.intensity ?? 1)
  light.name = 'spot-light'
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
  if (config.angle !== undefined) light.angle = config.angle
  if (config.penumbra !== undefined) light.penumbra = config.penumbra
  if (config.distance !== undefined) light.distance = config.distance
  if (config.decay !== undefined) light.decay = config.decay
  light.castShadow = config.castShadow ?? true
  applyLocalShadow(light)
  scene.add(light)
  if (config.helper) addHelper(scene, new THREE.SpotLightHelper(light), 'spot-light-helper')
  return light
}

const createRectAreaLight = (
  scene: THREE.Scene,
  config: NonNullable<LightsConfig['rectArea']>
): THREE.RectAreaLight => {
  // Without this the light contributes nothing: the shader it needs is not in the core build.
  RectAreaLightUniformsLib.init()
  const light = new THREE.RectAreaLight(
    config.color ?? 0xffffff,
    config.intensity ?? 1,
    config.width ?? 10,
    config.height ?? 10
  )
  light.name = 'rect-area-light'
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
  light.lookAt(...((config.lookAt ?? [0, 0, 0]) as CoordinateTuple))
  scene.add(light)
  if (config.helper) addHelper(scene, new RectAreaLightHelper(light), 'rect-area-light-helper')
  return light
}

const DEFAULT_DIRECTIONAL = {
  ...SCENE_DEFAULTS.lights.directional,
  shadow: {
    mapSize: { width: 4096, height: 4096 },
    camera: { near: 0.5, far: 500, left: -150, right: 150, top: 150, bottom: -150 },
    bias: -0.0001,
    radius: 1
  }
}

const createAmbientLight = (
  scene: THREE.Scene,
  config: NonNullable<Exclude<LightsConfig['ambient'], false>>
): THREE.AmbientLight => {
  const light = new THREE.AmbientLight(config.color, config.intensity)
  light.name = 'ambient-light'
  scene.add(light)
  return light
}

const createDirectionalLight = (
  scene: THREE.Scene,
  config: NonNullable<Exclude<LightsConfig['directional'], false>>
): THREE.DirectionalLight => {
  const light = new THREE.DirectionalLight(config.color, config.intensity)
  light.name = 'directional-light'
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
  light.castShadow = config.castShadow ?? true

  // Always apply shadow camera defaults so scenes that omit the shadow key
  // still get a large-enough frustum (Three.js default is only ~±5 units).
  applyDirectionalShadow(light, config.shadow ?? {})
  scene.add(light)
  if (config.helper)
    addHelper(
      scene,
      new THREE.DirectionalLightHelper(light, HELPER_SIZE),
      'directional-light-helper'
    )
  return light
}

const createHemisphereLight = (
  scene: THREE.Scene,
  config: NonNullable<LightsConfig['hemisphere']>
): THREE.HemisphereLight | undefined => {
  if (!config.colors) return undefined
  const light = new THREE.HemisphereLight(...config.colors)
  light.name = 'hemisphere-light'
  if (config.intensity !== undefined) light.intensity = config.intensity
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
  scene.add(light)
  if (config.helper)
    addHelper(scene, new THREE.HemisphereLightHelper(light, HELPER_SIZE), 'hemisphere-light-helper')
  return light
}

/**
 * Create the lights a scene declares. Ambient and directional are made unless the config
 * turns them off with `false`; hemisphere, point, spot and rect area are made only when the
 * config names them, each with an optional helper.
 * @param scene
 * @param config
 * @returns Every light created, so a caller can drive them afterwards
 */
export const getLights = (scene: THREE.Scene, config: LightsConfig = {}) => {
  const ambient =
    config.ambient === false ? undefined : (config.ambient ?? SCENE_DEFAULTS.lights.ambient)
  const directional =
    config.directional === false ? undefined : (config.directional ?? DEFAULT_DIRECTIONAL)

  return {
    ambientLight: ambient ? createAmbientLight(scene, ambient) : undefined,
    directionalLight: directional ? createDirectionalLight(scene, directional) : undefined,
    hemisphereLight: config.hemisphere
      ? createHemisphereLight(scene, config.hemisphere)
      : undefined,
    pointLight: config.point ? createPointLight(scene, config.point) : undefined,
    spotLight: config.spot ? createSpotLight(scene, config.spot) : undefined,
    rectAreaLight: config.rectArea ? createRectAreaLight(scene, config.rectArea) : undefined
  }
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
  config: NonNullable<Exclude<LightsConfig['ambient'], false>>
) => {
  if (config.color !== undefined) light.color.set(config.color)
  if (config.intensity !== undefined) light.intensity = config.intensity
}

const updateDirectionalLight = (
  light: THREE.DirectionalLight,
  config: NonNullable<Exclude<LightsConfig['directional'], false>>
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
const updatePointLight = (light: THREE.PointLight, config: NonNullable<LightsConfig['point']>) => {
  if (config.color !== undefined) light.color.set(config.color)
  if (config.intensity !== undefined) light.intensity = config.intensity
  if (config.position) light.position.set(...(config.position as CoordinateTuple))
}

const updateSpotLight = (light: THREE.SpotLight, config: NonNullable<LightsConfig['spot']>) => {
  if (config.color !== undefined) light.color.set(config.color)
  if (config.intensity !== undefined) light.intensity = config.intensity
  if (config.angle !== undefined) light.angle = config.angle
  if (config.penumbra !== undefined) light.penumbra = config.penumbra
}

const updateRectAreaLight = (
  light: THREE.RectAreaLight,
  config: NonNullable<LightsConfig['rectArea']>
) => {
  if (config.color !== undefined) light.color.set(config.color)
  if (config.intensity !== undefined) light.intensity = config.intensity
  if (config.width !== undefined) light.width = config.width
  if (config.height !== undefined) light.height = config.height
}

/**
 * Update the lights that only a scene declaring them can have, so a panel can drive them.
 * Unlike the rig lights these are never created here: a scene without a spotlight did not
 * ask for one.
 * @param scene
 * @param config
 */
const updateOptionalLights = (scene: THREE.Scene, config: LightsConfig): void => {
  const point = scene.getObjectByName('point-light')
  if (config.point && point instanceof THREE.PointLight) updatePointLight(point, config.point)

  const spot = scene.getObjectByName('spot-light')
  if (config.spot && spot instanceof THREE.SpotLight) updateSpotLight(spot, config.spot)

  const rectArea = scene.getObjectByName('rect-area-light')
  if (config.rectArea && rectArea instanceof THREE.RectAreaLight)
    updateRectAreaLight(rectArea, config.rectArea)
}

export const updateLights = (scene: THREE.Scene, config: LightPresetConfig): void => {
  if (config.ambient) updateAmbientLight(ensureAmbientLight(scene), config.ambient)
  if (config.directional) updateDirectionalLight(ensureDirectionalLight(scene), config.directional)
  if (config.hemisphere) updateHemisphereLight(ensureHemisphereLight(scene), config.hemisphere)

  if (config.environment && config.environment.intensity !== undefined)
    scene.environmentIntensity = config.environment.intensity

  if (config.sky?.color !== undefined) updateSkyColor(scene, config.sky.color)

  updateOptionalLights(scene, config)
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
