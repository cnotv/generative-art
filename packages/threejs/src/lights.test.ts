import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import {
  getLights,
  getEnvironmentLight,
  updateLights,
  lightPresets,
  blendLightPresets
} from './lights'
import type { LightPreset } from './types'

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  const PMREMGenerator = function () {
    return {
      fromScene: () => ({ texture: new actual.Texture() }),
      dispose: () => {}
    }
  } as unknown as typeof actual.PMREMGenerator
  return { ...actual, PMREMGenerator }
})

describe('getLights', () => {
  it('adds ambient and directional lights with default names and intensities', () => {
    const scene = new THREE.Scene()

    const { ambientLight, directionalLight } = getLights(scene)

    expect(scene.getObjectByName('ambient-light')).toBe(ambientLight)
    expect(scene.getObjectByName('directional-light')).toBe(directionalLight)
    expect(ambientLight!.intensity).toBe(2)
    expect(directionalLight!.intensity).toBe(4)
    expect(directionalLight!.castShadow).toBe(true)
  })

  it('applies the large shadow frustum even when the shadow key is omitted', () => {
    const scene = new THREE.Scene()

    const { directionalLight } = getLights(scene, { directional: { intensity: 1 } })

    expect(directionalLight!.shadow.mapSize.width).toBe(4096)
    expect(directionalLight!.shadow.camera.left).toBe(-150)
    expect(directionalLight!.shadow.camera.far).toBe(500)
  })

  it('adds a hemisphere light only when its colors are configured', () => {
    const bareScene = new THREE.Scene()
    const configuredScene = new THREE.Scene()

    getLights(bareScene)
    getLights(configuredScene, { hemisphere: { colors: [0xffffff, 0x444444], intensity: 0.5 } })

    expect(bareScene.getObjectByName('hemisphere-light')).toBeUndefined()
    const hemisphereLight = configuredScene.getObjectByName(
      'hemisphere-light'
    ) as THREE.HemisphereLight
    expect(hemisphereLight).toBeDefined()
    expect(hemisphereLight.intensity).toBe(0.5)
  })

  it.each([
    ['ambient intensity', { ambient: { intensity: 0.3 } }, 'ambient-light', 0.3],
    ['directional intensity', { directional: { intensity: 1.7 } }, 'directional-light', 1.7]
  ])('overrides the %s from config', (_, config, lightName, expectedIntensity) => {
    const scene = new THREE.Scene()

    getLights(scene, config)

    expect((scene.getObjectByName(lightName) as THREE.Light).intensity).toBe(expectedIntensity)
  })
})

describe('updateLights and lightPresets', () => {
  const presetEntries = Object.entries(lightPresets) as [
    LightPreset,
    (typeof lightPresets)[LightPreset]
  ][]

  it.each(presetEntries)(
    'applies the whole %s rig onto the existing lights, environment and sky',
    (_, preset) => {
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0xbfd1e5)
      const { ambientLight, directionalLight } = getLights(scene, {
        hemisphere: { colors: [0xffffff, 0x444444] }
      })

      updateLights(scene, preset)

      expect(ambientLight!.color.getHex()).toBe(preset.ambient.color)
      expect(ambientLight!.intensity).toBe(preset.ambient.intensity)
      expect(directionalLight!.color.getHex()).toBe(preset.directional.color)
      expect(directionalLight!.intensity).toBe(preset.directional.intensity)
      expect(directionalLight!.position.toArray()).toEqual(preset.directional.position)
      const hemisphereLight = scene.getObjectByName('hemisphere-light') as THREE.HemisphereLight
      expect(hemisphereLight.color.getHex()).toBe(preset.hemisphere.colors[0])
      expect(hemisphereLight.groundColor.getHex()).toBe(preset.hemisphere.colors[1])
      expect(hemisphereLight.intensity).toBe(preset.hemisphere.intensity)
      expect(scene.environmentIntensity).toBe(preset.environment.intensity)
      expect((scene.background as THREE.Color).getHex()).toBe(preset.sky.color)
    }
  )

  it('creates the lights a rig names when the scene has none', () => {
    const scene = new THREE.Scene()

    updateLights(scene, lightPresets.night)

    expect(scene.getObjectByName('ambient-light')).toBeInstanceOf(THREE.AmbientLight)
    expect(scene.getObjectByName('directional-light')).toBeInstanceOf(THREE.DirectionalLight)
    expect(scene.getObjectByName('hemisphere-light')).toBeInstanceOf(THREE.HemisphereLight)
    const sun = scene.getObjectByName('directional-light') as THREE.DirectionalLight
    expect(sun.castShadow).toBe(true)
    expect(sun.shadow.camera.left).toBe(-150)
  })

  it('does not duplicate a light that already exists', () => {
    const scene = new THREE.Scene()
    getLights(scene)

    updateLights(scene, lightPresets.noon)
    updateLights(scene, lightPresets.dusk)

    const ambientLights = scene.children.filter((child) => child.name === 'ambient-light')
    const hemisphereLights = scene.children.filter((child) => child.name === 'hemisphere-light')
    expect(ambientLights).toHaveLength(1)
    expect(hemisphereLights).toHaveLength(1)
  })

  it('recolors the sky mesh when the scene has one', () => {
    const scene = new THREE.Scene()
    const skyMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaff })
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1), skyMaterial)
    skyMesh.name = 'sky'
    scene.add(skyMesh)

    updateLights(scene, { sky: { color: 0x1f2740 } })

    expect(skyMaterial.color.getHex()).toBe(0x1f2740)
  })

  it('updates a hemisphere light in place when the config names it', () => {
    const scene = new THREE.Scene()
    getLights(scene, { hemisphere: { colors: [0xffffff, 0x444444] } })

    updateLights(scene, { hemisphere: { colors: [0xf0e0d0, 0x304050], intensity: 0.8 } })

    const hemisphereLight = scene.getObjectByName('hemisphere-light') as THREE.HemisphereLight
    expect(hemisphereLight.color.getHex()).toBe(0xf0e0d0)
    expect(hemisphereLight.groundColor.getHex()).toBe(0x304050)
    expect(hemisphereLight.intensity).toBe(0.8)
  })
})

describe('getLights with the remaining light types', () => {
  it.each([
    ['point', 'point-light', THREE.PointLight],
    ['spot', 'spot-light', THREE.SpotLight],
    ['rectArea', 'rect-area-light', THREE.RectAreaLight]
  ] as const)('creates the %s light only when configured', (key, name, constructor) => {
    const bareScene = new THREE.Scene()
    const configuredScene = new THREE.Scene()

    getLights(bareScene)
    getLights(configuredScene, { [key]: { intensity: 2 } })

    expect(bareScene.getObjectByName(name)).toBeUndefined()
    const light = configuredScene.getObjectByName(name) as THREE.Light
    expect(light).toBeInstanceOf(constructor)
    expect(light.intensity).toBe(2)
  })

  it('gives the point and spot lights a shadow map rather than leaving them flat', () => {
    const scene = new THREE.Scene()

    getLights(scene, { point: {}, spot: {} })

    const point = scene.getObjectByName('point-light') as THREE.PointLight
    const spot = scene.getObjectByName('spot-light') as THREE.SpotLight
    expect(point.castShadow).toBe(true)
    expect(point.shadow.mapSize.width).toBe(2048)
    expect(spot.castShadow).toBe(true)
    expect(spot.shadow.camera.far).toBe(50)
  })

  it('sizes and aims the rect area light', () => {
    const scene = new THREE.Scene()

    getLights(scene, {
      rectArea: { width: 8, height: 3, position: [5, 5, 5], lookAt: [0, 0, 0] }
    })

    const rectArea = scene.getObjectByName('rect-area-light') as THREE.RectAreaLight
    expect(rectArea.width).toBe(8)
    expect(rectArea.height).toBe(3)
    expect(rectArea.position.toArray()).toEqual([5, 5, 5])
  })

  it.each([
    ['directional', 'directional-light-helper'],
    ['hemisphere', 'hemisphere-light-helper'],
    ['point', 'point-light-helper'],
    ['spot', 'spot-light-helper'],
    ['rectArea', 'rect-area-light-helper']
  ] as const)('adds the %s helper only when asked for', (key, helperName) => {
    const withoutHelper = new THREE.Scene()
    const withHelper = new THREE.Scene()
    const config = { colors: [0xffffff, 0x444444] as [number, number] }

    getLights(withoutHelper, { [key]: { ...config } })
    getLights(withHelper, { [key]: { ...config, helper: true } })

    expect(withoutHelper.getObjectByName(helperName)).toBeUndefined()
    expect(withHelper.getObjectByName(helperName)).toBeDefined()
  })

  it('returns every light it created so a caller can drive them', () => {
    const scene = new THREE.Scene()

    const lights = getLights(scene, {
      hemisphere: { colors: [0xffffff, 0x444444] },
      point: {},
      spot: {},
      rectArea: {}
    })

    expect(lights.pointLight).toBeInstanceOf(THREE.PointLight)
    expect(lights.spotLight).toBeInstanceOf(THREE.SpotLight)
    expect(lights.rectAreaLight).toBeInstanceOf(THREE.RectAreaLight)
    expect(lights.hemisphereLight).toBeInstanceOf(THREE.HemisphereLight)
  })
})

describe('blendLightPresets', () => {
  it.each([
    ['start', 0, lightPresets.dawn],
    ['end', 1, lightPresets.noon]
  ])('returns the %s rig at alpha %d', (_, alpha, expected) => {
    const blended = blendLightPresets(lightPresets.dawn, lightPresets.noon, alpha)

    expect(blended).toEqual(expected)
  })

  it('interpolates intensities and the sun position at the midpoint', () => {
    const blended = blendLightPresets(lightPresets.dawn, lightPresets.noon, 0.5)

    expect(blended.ambient.intensity).toBeCloseTo(
      (lightPresets.dawn.ambient.intensity + lightPresets.noon.ambient.intensity) / 2
    )
    expect(blended.directional.position[1]).toBeCloseTo(
      (lightPresets.dawn.directional.position[1] + lightPresets.noon.directional.position[1]) / 2
    )
    expect(blended.environment.intensity).toBeCloseTo(
      (lightPresets.dawn.environment.intensity + lightPresets.noon.environment.intensity) / 2
    )
  })
})

describe('getEnvironmentLight', () => {
  const fakeRenderer = {} as unknown as THREE.WebGLRenderer

  it('bakes the room environment and assigns it to scene.environment by default', () => {
    const scene = new THREE.Scene()

    const environmentTexture = getEnvironmentLight(fakeRenderer, scene)

    expect(scene.environment).toBe(environmentTexture)
    expect(environmentTexture).toBeInstanceOf(THREE.Texture)
  })

  it('loads an equirectangular texture when a url is configured', () => {
    const scene = new THREE.Scene()

    const environmentTexture = getEnvironmentLight(fakeRenderer, scene, {
      texture: 'environment.jpg'
    })

    expect(scene.environment).toBe(environmentTexture)
    expect(environmentTexture.mapping).toBe(THREE.EquirectangularReflectionMapping)
  })

  it('maps intensity onto scene.environmentIntensity and leaves it alone otherwise', () => {
    const dimmedScene = new THREE.Scene()
    const untouchedScene = new THREE.Scene()

    getEnvironmentLight(fakeRenderer, dimmedScene, { intensity: 0.4 })
    getEnvironmentLight(fakeRenderer, untouchedScene)

    expect(dimmedScene.environmentIntensity).toBe(0.4)
    expect(untouchedScene.environmentIntensity).toBe(1)
  })
})
