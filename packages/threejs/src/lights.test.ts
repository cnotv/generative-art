import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { getLights, getEnvironmentLight, updateLights, lightPresets } from './lights'
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
    expect(ambientLight.intensity).toBe(2)
    expect(directionalLight.intensity).toBe(4)
    expect(directionalLight.castShadow).toBe(true)
  })

  it('applies the large shadow frustum even when the shadow key is omitted', () => {
    const scene = new THREE.Scene()

    const { directionalLight } = getLights(scene, { directional: { intensity: 1 } })

    expect(directionalLight.shadow.mapSize.width).toBe(4096)
    expect(directionalLight.shadow.camera.left).toBe(-150)
    expect(directionalLight.shadow.camera.far).toBe(500)
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

      expect(ambientLight.color.getHex()).toBe(preset.ambient?.color)
      expect(ambientLight.intensity).toBe(preset.ambient?.intensity)
      expect(directionalLight.color.getHex()).toBe(preset.directional?.color)
      expect(directionalLight.intensity).toBe(preset.directional?.intensity)
      expect(directionalLight.position.toArray()).toEqual(preset.directional?.position)
      const hemisphereLight = scene.getObjectByName('hemisphere-light') as THREE.HemisphereLight
      expect(hemisphereLight.color.getHex()).toBe(preset.hemisphere?.colors?.[0])
      expect(hemisphereLight.groundColor.getHex()).toBe(preset.hemisphere?.colors?.[1])
      expect(hemisphereLight.intensity).toBe(preset.hemisphere?.intensity)
      expect(scene.environmentIntensity).toBe(
        preset.environment !== false ? preset.environment?.intensity : undefined
      )
      expect((scene.background as THREE.Color).getHex()).toBe(preset.sky?.color)
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
