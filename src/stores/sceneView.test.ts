import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as THREE from 'three'

// Mock vue-router (required by panels store)
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {}, path: '/test' })
}))

// Mock Three.js scene children
const mockScene = {
  children: [] as Array<{ name: string; type: string; visible: boolean }>,
  environment: null as THREE.Texture | null,
  environmentIntensity: 1,
  getObjectByName: vi.fn((name: string) => {
    if (name === 'ambient-light') return { intensity: 1, color: new THREE.Color(0xffffff) }
    if (name === 'directional-light')
      return {
        intensity: 2,
        color: new THREE.Color(0xffffff),
        position: new THREE.Vector3(50, 100, 50)
      }
    if (name === 'sky')
      return { material: { color: new THREE.Color(0xaaaaff) }, geometry: { dispose: vi.fn() } }
    return null
  }),
  remove: vi.fn(),
  add: vi.fn()
}

const mockCamera = {
  type: 'PerspectiveCamera',
  position: new THREE.Vector3(0, 5, 10),
  fov: 75,
  updateProjectionMatrix: vi.fn()
}

const mockOrbit = {
  target: new THREE.Vector3(0, 0, 0),
  enabled: true,
  update: vi.fn(),
  addEventListener: vi.fn()
}

const mockGround = {
  mesh: {
    material: { color: new THREE.Color(0x888888) },
    geometry: { dispose: vi.fn() }
  }
}

// Mock getTools
const mockSetup = vi.fn(
  async (options?: {
    config?: unknown
    defineSetup?: (context: { ground: unknown }) => Promise<void> | void
  }) => {
    if (options?.defineSetup) {
      await options.defineSetup({ ground: mockGround })
    }
    return { orbit: mockOrbit, ground: mockGround }
  }
)
const mockAnimate = vi.fn()

vi.mock('@webgamekit/threejs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getTools: vi.fn(() =>
      Promise.resolve({
        setup: mockSetup,
        animate: mockAnimate,
        scene: mockScene,
        camera: mockCamera,
        world: {},
        getDelta: vi.fn(() => 0.016)
      })
    )
  }
})

vi.mock('@webgamekit/animation', () => ({
  createTimelineManager: vi.fn(() => ({}))
}))

vi.mock('@/utils/groupMeshes', () => ({
  addGroupMeshes: vi.fn(),
  removeGroupMeshes: vi.fn()
}))

// Import after mocks
import { lightPresets } from '@webgamekit/threejs'
import { useSceneViewStore } from './sceneView'
import { usePanelsStore } from './panels'
import { useViewPanelsStore } from './viewPanels'
import { useDebugSceneStore } from './debugScene'
import { useElementPropertiesStore } from './elementProperties'
import { useTextureGroupsStore } from './textureGroups'

describe('useSceneViewStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScene.children = []
    mockScene.environment = null
    mockScene.environmentIntensity = 1
    setActivePinia(createPinia())
  })

  describe('init', () => {
    it('should set isInitialized after successful init', async () => {
      const store = useSceneViewStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, {
        camera: { position: [0, 5, 10], fov: 75 }
      })

      expect(store.isInitialized).toBe(true)
    })

    it('should call setViewPanels and openPanel', async () => {
      const store = useSceneViewStore()
      const panelsStore = usePanelsStore()
      const viewPanelsStore = useViewPanelsStore()
      const canvas = document.createElement('canvas')

      panelsStore.initRouteSync()
      await store.init(canvas, { camera: { position: [0, 5, 10] } })

      expect(viewPanelsStore.viewPanels).toEqual({ showConfig: false, showElements: true })
      expect(panelsStore.activePanels.has('elements')).toBe(true)
    })

    it('should pass custom viewPanels from options', async () => {
      const store = useSceneViewStore()
      const viewPanelsStore = useViewPanelsStore()
      const canvas = document.createElement('canvas')

      await store.init(
        canvas,
        { camera: { position: [0, 5, 10] } },
        {
          viewPanels: { showConfig: true }
        }
      )

      expect(viewPanelsStore.viewPanels).toEqual({ showConfig: true, showElements: true })
    })

    it('should register element properties for camera when camera config is provided', async () => {
      const store = useSceneViewStore()
      const elementPropertiesStore = useElementPropertiesStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, {
        camera: { position: [0, 5, 10], fov: 75 }
      })

      expect(elementPropertiesStore.selectedElementName).toBe(null)
      elementPropertiesStore.openElementProperties('Camera')
      expect(elementPropertiesStore.activeProperties).not.toBe(null)
      expect(elementPropertiesStore.activeProperties?.title).toBe('Camera')
    })

    it('should register element properties for ground', async () => {
      const store = useSceneViewStore()
      const elementPropertiesStore = useElementPropertiesStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, {
        ground: { color: 0x888888, size: [100, 0.1, 100] as [number, number, number] }
      })

      elementPropertiesStore.openElementProperties('ground')
      expect(elementPropertiesStore.activeProperties?.title).toBe('Ground')
    })

    it('carries the sky config into the panel state', async () => {
      const store = useSceneViewStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, { sky: { color: 0xaaaaff, size: 1000 } })

      expect((store.skyConfig as { color?: number }).color).toBe(0xaaaaff)
    })

    describe('lights', () => {
      const initWithEnvironment = async (store: ReturnType<typeof useSceneViewStore>) => {
        const canvas = document.createElement('canvas')
        await store.init(canvas, { lights: { environment: { intensity: 0.5 } } })
      }

      it('lists one Lights row instead of a row per light', async () => {
        const store = useSceneViewStore()
        const debugSceneStore = useDebugSceneStore()
        mockScene.environment = {} as THREE.Texture
        mockScene.children = [
          { name: 'ambient-light', type: 'AmbientLight', visible: true },
          { name: 'directional-light', type: 'DirectionalLight', visible: true },
          { name: 'sky', type: 'Mesh', visible: true }
        ]

        await initWithEnvironment(store)

        const names = debugSceneStore.sceneElements.map((element) => element.name)
        expect(names).toContain('Lights')
        expect(names).not.toContain('ambient-light')
        expect(names).not.toContain('directional-light')
        expect(names).not.toContain('sky')
      })

      it('lists no Lights row when the scene has neither lights nor an environment', async () => {
        const store = useSceneViewStore()
        const debugSceneStore = useDebugSceneStore()
        const canvas = document.createElement('canvas')

        await store.init(canvas, { lights: false })

        expect(debugSceneStore.sceneElements.some((element) => element.name === 'Lights')).toBe(
          false
        )
      })

      it('carries the environment intensity from the setup config into the panel state', async () => {
        const store = useSceneViewStore()

        await initWithEnvironment(store)

        expect((store.lightsConfig.environment as { intensity: number }).intensity).toBe(0.5)
      })

      it('applies a day time preset to the scene and mirrors the whole rig into the panel', async () => {
        const store = useSceneViewStore()

        await initWithEnvironment(store)
        store.applyLightPreset('dusk')

        expect(store.activeLightPreset).toBe('dusk')
        expect(mockScene.environmentIntensity).toBe(0.35)
        expect((store.lightsConfig.ambient as { color: number }).color).toBe(0xe8cabc)
        expect((store.lightsConfig.directional as { position: { x: number } }).position.x).toBe(-80)
        expect((store.lightsConfig.environment as { intensity: number }).intensity).toBe(0.35)
        const hemisphere = store.lightsConfig.hemisphere as {
          skyColor: number
          groundColor: number
          intensity: number
        }
        expect(hemisphere.skyColor).toBe(0xf0b391)
        expect(hemisphere.groundColor).toBe(0x4a4458)
        expect(hemisphere.intensity).toBe(0.85)
        expect((store.skyConfig as { color?: number }).color).toBe(0xe89b7d)
      })

      it.each([
        ['environment', 'intensity', 1.2],
        ['ambient', 'intensity', 0.8]
      ] as const)(
        'updates the %s light %s and clears the active preset',
        async (group, path, value) => {
          const store = useSceneViewStore()

          await initWithEnvironment(store)
          store.applyLightPreset('noon')
          store.updateLightValue(group, path, value)

          expect(store.activeLightPreset).toBe(null)
          expect((store.lightsConfig[group] as Record<string, number>)[path]).toBe(value)
        }
      )

      it('writes environment intensity through to the scene', async () => {
        const store = useSceneViewStore()

        await initWithEnvironment(store)
        store.updateLightValue('environment', 'intensity', 1.2)

        expect(mockScene.environmentIntensity).toBe(1.2)
      })

      it('stops the transition player and settles the rig into the panel state', async () => {
        const store = useSceneViewStore()

        await initWithEnvironment(store)
        store.setLightTransitionEnabled(true)
        expect(store.lightTransitionEnabled).toBe(true)
        expect(store.activeLightPreset).toBe(null)

        store.setLightTransitionEnabled(false)

        expect(store.lightTransitionEnabled).toBe(false)
        expect((store.lightsConfig.ambient as { color: number }).color).toBe(
          lightPresets.dawn.ambient.color
        )
      })

      it('turning on the player clears the active preset', async () => {
        const store = useSceneViewStore()

        await initWithEnvironment(store)
        store.applyLightPreset('noon')
        store.setLightTransitionEnabled(true)

        expect(store.activeLightPreset).toBe(null)
        store.setLightTransitionEnabled(false)
      })
    })

    it('should set scene elements in debug store', async () => {
      const store = useSceneViewStore()
      const debugSceneStore = useDebugSceneStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, {
        camera: { position: [0, 5, 10] }
      })

      expect(debugSceneStore.sceneElements.length).toBeGreaterThan(0)
      expect(debugSceneStore.sceneElements[0].name).toBe('Camera')
    })

    it('should sync orbit controls change listener', async () => {
      const store = useSceneViewStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, {
        camera: { position: [0, 5, 10] }
      })

      expect(mockOrbit.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('initTextureGroups', () => {
    it('should push groups to texture store', async () => {
      const store = useSceneViewStore()
      const textureStore = useTextureGroupsStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, { camera: { position: [0, 5, 10] } })
      store.initTextureGroups(
        [
          {
            id: 'cloud',
            name: 'Cloud',
            textures: [{ id: 't1', name: 'cloud1', filename: 'cloud1', url: 'test.webp' }]
          }
        ],
        { cloud: 'Cloud' }
      )

      expect(textureStore.groups).toHaveLength(1)
      expect(textureStore.groups[0].id).toBe('cloud')
    })

    it('should register texture group handlers', async () => {
      const store = useSceneViewStore()
      const textureStore = useTextureGroupsStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, { camera: { position: [0, 5, 10] } })
      store.initTextureGroups([{ id: 'cloud', name: 'Cloud', textures: [] }], { cloud: 'Cloud' })

      expect(textureStore.handlers).not.toBe(null)
      expect(textureStore.handlers?.onToggleVisibility).toBeDefined()
      expect(textureStore.handlers?.onToggleWireframe).toBeDefined()
    })
  })

  describe('init with defineSetup', () => {
    it('should call defineSetup with context during init', async () => {
      const store = useSceneViewStore()
      const canvas = document.createElement('canvas')
      const defineSetup = vi.fn()

      await store.init(canvas, { camera: { position: [0, 5, 10] } }, { defineSetup })

      expect(defineSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          scene: mockScene,
          camera: mockCamera,
          world: expect.anything(),
          getDelta: expect.any(Function),
          animate: expect.any(Function)
        })
      )
    })

    it('should not call animate when defineSetup is provided', async () => {
      const store = useSceneViewStore()
      const canvas = document.createElement('canvas')
      mockAnimate.mockClear()

      await store.init(
        canvas,
        { camera: { position: [0, 5, 10] } },
        {
          defineSetup: vi.fn()
        }
      )

      expect(mockAnimate).not.toHaveBeenCalled()
    })

    it('should pass defineSetup to setup call', async () => {
      const store = useSceneViewStore()
      const canvas = document.createElement('canvas')
      mockSetup.mockClear()

      await store.init(
        canvas,
        { camera: { position: [0, 5, 10] } },
        {
          defineSetup: vi.fn()
        }
      )

      expect(mockSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          defineSetup: expect.any(Function)
        })
      )
    })
  })

  describe('registerTextureAreas', () => {
    it('should register texture area element properties', async () => {
      const store = useSceneViewStore()
      const elementPropertiesStore = useElementPropertiesStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, { camera: { position: [0, 5, 10] } })
      store.registerTextureAreas([
        {
          name: 'clouds',
          schema: { size: { component: 'CoordinateInput', label: 'Size' } },
          initialData: { size: { x: 200, y: 100, z: 0 } },
          meshPrefix: 'area-clouds'
        }
      ])

      elementPropertiesStore.openElementProperties('clouds')
      expect(elementPropertiesStore.activeProperties?.title).toBe('clouds')
      expect(elementPropertiesStore.activeProperties?.type).toBe('TextureArea')
    })

    it('should add texture areas to scene elements', async () => {
      const store = useSceneViewStore()
      const debugSceneStore = useDebugSceneStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, { camera: { position: [0, 5, 10] } })
      store.registerTextureAreas([
        { name: 'clouds', schema: {}, initialData: {}, meshPrefix: 'area-clouds' },
        { name: 'trees', schema: {}, initialData: {}, meshPrefix: 'area-trees' }
      ])

      const areaElements = debugSceneStore.sceneElements.filter((e) => e.type === 'TextureArea')
      expect(areaElements).toHaveLength(2)
      expect(areaElements.map((e) => e.name)).toEqual(['clouds', 'trees'])
    })

    it('should filter individual area meshes from scene elements', async () => {
      const store = useSceneViewStore()
      const debugSceneStore = useDebugSceneStore()
      const canvas = document.createElement('canvas')

      mockScene.children = [
        { name: 'area-clouds-0', type: 'Mesh', visible: true },
        { name: 'area-clouds-1', type: 'Mesh', visible: true },
        { name: 'Player', type: 'Group', visible: true }
      ]

      await store.init(canvas, { camera: { position: [0, 5, 10] } })
      store.registerTextureAreas([
        { name: 'clouds', schema: {}, initialData: {}, meshPrefix: 'area-clouds' }
      ])

      const meshElements = debugSceneStore.sceneElements.filter((e) =>
        e.name.startsWith('area-clouds')
      )
      expect(meshElements).toHaveLength(0)
      const playerElements = debugSceneStore.sceneElements.filter((e) => e.name === 'Player')
      expect(playerElements).toHaveLength(1)
    })
  })

  describe('cleanup', () => {
    it('should clear all stores and reset refs', async () => {
      const store = useSceneViewStore()
      const debugSceneStore = useDebugSceneStore()
      const elementPropertiesStore = useElementPropertiesStore()
      const textureStore = useTextureGroupsStore()
      const canvas = document.createElement('canvas')

      await store.init(canvas, { camera: { position: [0, 5, 10] } })
      store.cleanup()

      expect(store.isInitialized).toBe(false)
      expect(store.threeScene).toBe(null)
      expect(store.threeCamera).toBe(null)
      expect(debugSceneStore.sceneElements).toEqual([])
      expect(elementPropertiesStore.activeProperties).toBe(null)
      expect(textureStore.groups).toEqual([])
    })
  })
})
