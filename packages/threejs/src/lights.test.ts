import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { getLights, getEnvironmentLight } from './lights'

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
