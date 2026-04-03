import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Ref } from 'vue'
import * as THREE from 'three'
import { getTools, getCube, generateAreaPositions, SCENE_DEFAULTS } from '@webgamekit/threejs'
import type { SetupConfig, CoordinateTuple, AreaConfig } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { usePanelsStore } from '@/stores/panels'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { useDebugSceneStore } from '@/stores/debugScene'
import type { SceneElement } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useTextureGroupsStore } from '@/stores/textureGroups'
import type { TextureGroup, GroupConfig } from '@/stores/textureGroups'
import { addGroupMeshes, removeGroupMeshes } from '@/utils/groupMeshes'
import { toggleObjectVisibility, replaceGeometry } from '@/utils/threeObjectUpdaters'
import {
  groundSchema,
  lightsSchema,
  skySchema,
  configControls
} from '@/views/Tools/SceneEditor/config'
import { registerCameraProperties as registerCameraPropertiesShared } from '@/utils/cameraProperties'
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects'

type Vec3 = { x: number; y: number; z: number }
type OrbitControls = {
  target: THREE.Vector3
  enabled: boolean
  update: () => void
  addEventListener: (event: string, callback: () => void) => void
}

const DEBOUNCE_DELAY = 150
const createDebouncedMap = () => {
  let timers: Record<string, ReturnType<typeof setTimeout>> = {}
  return (key: string, callback: () => void) => {
    if (timers[key]) clearTimeout(timers[key])
    timers = {
      ...timers,
      [key]: setTimeout(() => {
        const { [key]: _completed, ...remaining } = timers
        timers = remaining
        callback()
      }, DEBOUNCE_DELAY)
    }
  }
}

interface TextureGroupDefinition {
  id: string
  name: string
  textures: { id: string; name: string; filename: string; url: string }[]
}

interface DefineSetupContext {
  ground: { mesh?: THREE.Mesh } | null
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  getDelta: () => number
  clock: THREE.Clock
  animate: (options: {
    beforeTimeline?: () => void
    afterTimeline?: () => void
    timeline: ReturnType<typeof createTimelineManager>
  }) => void
}

export interface InitOptions {
  defineSetup?: (context: DefineSetupContext) => Promise<void> | void
  viewPanels?: Record<string, boolean>
  playMode?: boolean
}

export interface TextureAreaDefinition {
  name: string
  schema: Record<string, unknown>
  initialData: Record<string, unknown>
  meshPrefix: string
  textures?: { id: string; name: string; filename: string; url: string }[]
}

const SPHERE_SEGMENTS = 32
const MAX_INSTANCES = 2000
const MIN_INSTANCES = 1
const HALF = 0.5

interface SceneReferences {
  threeScene: Ref<THREE.Scene | null>
  threeWorld: Ref<unknown>
  threeCamera: Ref<THREE.Camera | null>
  orbitReference: Ref<OrbitControls | null>
  groundReference: Ref<{ mesh?: THREE.Mesh } | null>
  ambientLightReference: Ref<THREE.Light | null>
  directionalLightReference: Ref<THREE.Light | null>
  skyMeshReference: Ref<THREE.Mesh | null>
  isInitialized: Ref<boolean>
  playMode: Ref<boolean>
  cameraConfig: Ref<Record<string, unknown>>
  groundConfig: Ref<Record<string, unknown>>
  lightsConfig: Ref<Record<string, unknown>>
  skyConfig: Ref<Record<string, unknown>>
  groupConfigs: Ref<Record<string, Record<string, unknown>>>
  textureAreaConfigs: Ref<Record<string, Record<string, unknown>>>
  textureAreaDefinitions: Ref<TextureAreaDefinition[]>
  areaMeshCache: Ref<Record<string, THREE.Object3D[]>>
}

// --- Config builders ---

const buildCameraConfigFromSetup = (config: SetupConfig): Record<string, unknown> => {
  const cameraPosition = (config.camera?.position ?? SCENE_DEFAULTS.camera.position) as number[]
  const orbitDisabledFromConfig =
    config.orbit &&
    typeof config.orbit === 'object' &&
    'disabled' in config.orbit &&
    config.orbit.disabled === true
  return {
    position: { x: cameraPosition[0], y: cameraPosition[1], z: cameraPosition[2] },
    fov: config.camera?.fov ?? SCENE_DEFAULTS.camera.fov,
    orbitTarget: { x: 0, y: 0, z: 0 },
    orbitEnabled: config.orbit !== false && !orbitDisabledFromConfig
  }
}

const buildGroundConfigFromSetup = (config: SetupConfig): Record<string, unknown> => {
  const groundOverrides = (
    config.ground && typeof config.ground === 'object' ? config.ground : {}
  ) as { color?: number; size?: number | number[] }
  const size = groundOverrides.size ?? SCENE_DEFAULTS.ground.size
  return {
    color: groundOverrides.color ?? SCENE_DEFAULTS.ground.color,
    size: Array.isArray(size)
      ? { x: size[0], y: size[1], z: size[2] }
      : { x: size ?? 100, y: 0.1, z: size ?? 100 }
  }
}

const buildLightsConfigFromSetup = (config: SetupConfig): Record<string, unknown> => {
  const lightsOverrides = (
    config.lights && typeof config.lights === 'object' ? config.lights : {}
  ) as Record<string, unknown>
  const ambientOverrides = (lightsOverrides.ambient ?? {}) as Record<string, unknown>
  const directionalOverrides = (lightsOverrides.directional ?? {}) as Record<string, unknown>
  const directionalPosition = (directionalOverrides.position ??
    SCENE_DEFAULTS.lights.directional.position) as number[]
  return {
    ambient: { ...SCENE_DEFAULTS.lights.ambient, ...ambientOverrides },
    directional: {
      ...SCENE_DEFAULTS.lights.directional,
      ...directionalOverrides,
      position: {
        x: directionalPosition[0],
        y: directionalPosition[1],
        z: directionalPosition[2]
      }
    }
  }
}

const buildSkyConfigFromSetup = (config: SetupConfig): Record<string, unknown> => {
  const skyOverrides = (config.sky && typeof config.sky === 'object' ? config.sky : {}) as Record<
    string,
    unknown
  >
  return { ...SCENE_DEFAULTS.sky, ...skyOverrides }
}

const buildInitConfig = (
  config: SetupConfig,
  configReferences: Pick<
    SceneReferences,
    'cameraConfig' | 'groundConfig' | 'lightsConfig' | 'skyConfig'
  >
) => {
  configReferences.cameraConfig.value = buildCameraConfigFromSetup(config)
  if (config.ground !== false)
    configReferences.groundConfig.value = buildGroundConfigFromSetup(config)
  if (config.lights !== false)
    configReferences.lightsConfig.value = buildLightsConfigFromSetup(config)
  if (config.sky !== false) configReferences.skyConfig.value = buildSkyConfigFromSetup(config)
}

// --- Scene object updaters ---

const applyGroundUpdate = (
  path: string,
  value: unknown,
  groundReference: Ref<{ mesh?: THREE.Mesh } | null>
) => {
  const ground = groundReference.value
  if (!ground?.mesh) return
  if (path === 'color') {
    ;(ground.mesh.material as THREE.MeshStandardMaterial).color.set(value as number)
  } else if (path === 'size') {
    const size = value as Vec3
    replaceGeometry(ground.mesh, new THREE.BoxGeometry(size.x, size.y, size.z))
  }
}

const applyLightsUpdate = (
  path: string,
  value: unknown,
  ambientLightReference: Ref<THREE.Light | null>,
  directionalLightReference: Ref<THREE.Light | null>
) => {
  const [group, field] = path.split('.')
  if (group === 'ambient' && ambientLightReference.value) {
    if (field === 'intensity') ambientLightReference.value.intensity = value as number
    else if (field === 'color') ambientLightReference.value.color.set(value as number)
  } else if (group === 'directional' && directionalLightReference.value) {
    if (field === 'intensity') directionalLightReference.value.intensity = value as number
    else if (field === 'color') directionalLightReference.value.color.set(value as number)
    else if (field === 'position') {
      const pos = value as Vec3
      directionalLightReference.value.position.set(pos.x, pos.y, pos.z)
    }
  }
}

const applySkyUpdate = (path: string, value: unknown, skyMeshReference: Ref<THREE.Mesh | null>) => {
  const mesh = skyMeshReference.value
  if (!mesh) return
  if (path === 'color') {
    ;(mesh.material as THREE.MeshBasicMaterial).color.set(value as number)
  } else if (path === 'size') {
    replaceGeometry(
      mesh,
      new THREE.SphereGeometry(value as number, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
    )
  }
}

// --- Scene element builders ---

const buildSceneElements = (
  threeScene: Ref<THREE.Scene | null>,
  threeCamera: Ref<THREE.Camera | null>,
  areaMeshCache: Ref<Record<string, THREE.Object3D[]>>,
  textureStore: ReturnType<typeof useTextureGroupsStore>
): SceneElement[] => {
  const scene = threeScene.value
  const camera = threeCamera.value
  if (!scene || !camera) return []

  const textureGroups = textureStore.groups
  const cachedMeshNames = new Set(
    Object.values(areaMeshCache.value).flatMap((meshes) => meshes.map((m) => m.name))
  )
  const cameraElement: SceneElement = { name: 'Camera', type: camera.type, hidden: false }

  const sceneChildren: SceneElement[] = scene.children
    .filter((child) => !cachedMeshNames.has(child.name))
    .filter((child) => !child.userData?.spawnId)
    .filter((child) => !(child instanceof THREE.BoxHelper))
    .filter((child) => child.name !== 'PathDebug')
    .map((child) => {
      const groupId = textureGroups.find(
        (g) => child.name?.startsWith(`grp-${g.id}-`) || child.name === `wireframe-${g.id}`
      )?.id
      const childCount =
        child instanceof THREE.Group && child.children.length > 0 ? child.children.length : null
      return {
        name: child.name || child.type,
        label: childCount !== null ? `${child.name || child.type} [${childCount}]` : undefined,
        type: groupId ? 'TextureArea' : child.type,
        hidden: false,
        groupId
      }
    })

  const textureGroupElements: SceneElement[] = textureGroups.map((g) => ({
    name: g.id,
    type: 'TextureArea',
    hidden: false,
    groupId: g.id
  }))

  return [cameraElement, ...sceneChildren, ...textureGroupElements]
}

const buildAreaMeshCacheFromScene = (
  scene: THREE.Scene,
  textureAreaDefinitions: TextureAreaDefinition[]
): Record<string, THREE.Object3D[]> => {
  const prefixToName = Object.fromEntries(
    textureAreaDefinitions.map((area) => [`${area.meshPrefix}-`, area.name])
  )
  const prefixes = Object.keys(prefixToName)

  return scene.children.reduce<Record<string, THREE.Object3D[]>>(
    (cache, child) => {
      const matchedPrefix = child.name
        ? prefixes.find((prefix) => child.name.startsWith(prefix))
        : undefined
      if (matchedPrefix) {
        const areaName = prefixToName[matchedPrefix]
        return { ...cache, [areaName]: [...(cache[areaName] ?? []), child] }
      }
      return cache
    },
    Object.fromEntries(textureAreaDefinitions.map((area) => [area.name, [] as THREE.Object3D[]]))
  )
}

// --- Texture mesh placement ---

interface TextureMeshOptions {
  scene: THREE.Scene
  world: unknown
  area: TextureAreaDefinition
  position: CoordinateTuple
  index: number
  textures: { id: string; name: string; filename: string; url: string }[]
  meshSize: CoordinateTuple
  meshRotation: CoordinateTuple
}

const placeTextureMesh = (meshOptions: TextureMeshOptions): THREE.Object3D =>
  getCube(meshOptions.scene, meshOptions.world, {
    name: `${meshOptions.area.meshPrefix}-${meshOptions.index}`,
    size: meshOptions.meshSize,
    position: meshOptions.position,
    rotation: meshOptions.meshRotation,
    texture: meshOptions.textures[Math.floor(Math.random() * meshOptions.textures.length)].url,
    material: 'MeshBasicMaterial',
    color: 0x000000,
    transparent: true,
    castShadow: false,
    receiveShadow: false,
    physic: false
  }) as unknown as THREE.Object3D

const computeMeshTransform = (
  baseSize: CoordinateTuple,
  sizeVariation: CoordinateTuple,
  rotationVariation: CoordinateTuple,
  hasVariation: boolean
): { meshSize: CoordinateTuple; meshRotation: CoordinateTuple } => {
  if (!hasVariation) {
    return { meshSize: baseSize, meshRotation: [0, 0, 0] }
  }
  return {
    meshSize: [
      baseSize[0] + (Math.random() - HALF) * sizeVariation[0],
      baseSize[1] + (Math.random() - HALF) * sizeVariation[1],
      baseSize[2] + (Math.random() - HALF) * sizeVariation[2]
    ],
    meshRotation: [
      (Math.random() - HALF) * rotationVariation[0],
      (Math.random() - HALF) * rotationVariation[1],
      (Math.random() - HALF) * rotationVariation[2]
    ]
  }
}

const populateTextureArea = (
  scene: THREE.Scene,
  world: unknown,
  area: TextureAreaDefinition,
  config: GroupConfig,
  textures: { id: string; name: string; filename: string; url: string }[]
): THREE.Object3D[] => {
  const areaConfig: AreaConfig = {
    center: config.area.center,
    size: config.area.size,
    count: Math.min(MAX_INSTANCES, Math.max(MIN_INSTANCES, Math.round(config.instances.density))),
    pattern: config.instances.pattern,
    seed: config.instances.seed,
    sizeVariation: config.textures.sizeVariation,
    rotationVariation: config.textures.rotationVariation
  }

  const allPositions = generateAreaPositions(areaConfig)
  const { baseSize, sizeVariation, rotationVariation } = config.textures
  const hasVariation = sizeVariation.some((v) => v !== 0) || rotationVariation.some((v) => v !== 0)

  return allPositions.map((position: CoordinateTuple, index: number) => {
    const { meshSize, meshRotation } = computeMeshTransform(
      baseSize,
      sizeVariation,
      rotationVariation,
      hasVariation
    )
    return placeTextureMesh({
      scene,
      world,
      area,
      position,
      index,
      textures,
      meshSize,
      meshRotation
    })
  })
}

// --- Setup helpers ---

interface SetupFunction {
  (options: {
    config: SetupConfig
    defineSetup?: (ctx: unknown) => Promise<void> | void
  }): Promise<{ ground: { mesh?: THREE.Mesh } | null; orbit: unknown }>
}

interface AnimateFunction {
  (options: {
    beforeTimeline?: () => void
    afterTimeline?: () => void
    timeline: ReturnType<typeof createTimelineManager>
  }): void
}

interface DefineSetupRunOptions {
  setup: SetupFunction
  toolsAnimate: AnimateFunction
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  getDelta: () => number
  clock: THREE.Clock
  config: SetupConfig
  defineSetupCallback: (context: DefineSetupContext) => Promise<void> | void
}

const runSetupWithDefineSetup = async (
  runOptions: DefineSetupRunOptions
): Promise<SceneSetupResult> => {
  const {
    setup,
    toolsAnimate,
    scene,
    camera,
    world,
    getDelta,
    clock,
    config,
    defineSetupCallback
  } = runOptions
  const result = await setup({
    config,
    defineSetup: async (setupContext) => {
      await defineSetupCallback({
        ground: (setupContext as { ground: { mesh?: THREE.Mesh } | null }).ground,
        scene,
        camera,
        world,
        getDelta,
        clock,
        animate: toolsAnimate
      })
    }
  })
  return { ground: result.ground, orbit: result.orbit as OrbitControls, scene, camera, world }
}

interface SceneSetupResult {
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  orbit: OrbitControls
  ground: { mesh?: THREE.Mesh } | null
}

const resolveSceneReferencesFromResult = (
  setupResult: SceneSetupResult,
  sceneReferences: Pick<
    SceneReferences,
    | 'threeScene'
    | 'threeCamera'
    | 'threeWorld'
    | 'orbitReference'
    | 'groundReference'
    | 'ambientLightReference'
    | 'directionalLightReference'
    | 'skyMeshReference'
  >
) => {
  const { scene, camera, world, orbit, ground } = setupResult
  sceneReferences.threeScene.value = scene
  sceneReferences.threeCamera.value = camera
  sceneReferences.threeWorld.value = world
  sceneReferences.orbitReference.value = orbit
  sceneReferences.groundReference.value = ground
  sceneReferences.ambientLightReference.value =
    (scene.getObjectByName('ambient-light') as THREE.Light) ?? null
  sceneReferences.directionalLightReference.value =
    (scene.getObjectByName('directional-light') as THREE.Light) ?? null
  sceneReferences.skyMeshReference.value = (scene.getObjectByName('sky') as THREE.Mesh) ?? null
}

// --- Wireframe helpers ---

const toggleAreaWireframe = (
  id: string,
  references: Pick<SceneReferences, 'threeScene' | 'threeWorld' | 'textureAreaConfigs'>,
  textureStore: ReturnType<typeof useTextureGroupsStore>
) => {
  const scene = references.threeScene.value
  const world = references.threeWorld.value
  const group = textureStore.groups.find((g) => g.id === id)
  const config = references.textureAreaConfigs.value[id] as unknown as GroupConfig
  if (!group || !scene || !config?.area) return

  const newShowWireframe = !group.showWireframe
  textureStore.$patch({
    groups: textureStore.groups.map((g) =>
      g.id === id ? { ...g, showWireframe: newShowWireframe } : g
    )
  })

  const wireframeName = `wireframe-${id}`
  const existing = scene.getObjectByName(wireframeName)
  if (existing) scene.remove(existing)

  if (newShowWireframe) {
    getCube(scene, world, {
      name: wireframeName,
      size: config.area.size,
      position: config.area.center,
      color: 0x00ff00,
      material: 'MeshBasicMaterial',
      wireframe: true,
      castShadow: false,
      receiveShadow: false,
      physic: false
    })
  }
}

// --- Texture area group handlers ---

interface TextureAreaHandlerContext {
  references: Pick<
    SceneReferences,
    'threeScene' | 'threeWorld' | 'areaMeshCache' | 'textureAreaConfigs' | 'textureAreaDefinitions'
  >
  textureStore: ReturnType<typeof useTextureGroupsStore>
  elementPropertiesStore: ReturnType<typeof useElementPropertiesStore>
  getAreaMeshes: (name: string) => THREE.Object3D[]
  regenerateTextureArea: (area: TextureAreaDefinition) => void
  updateSceneElements: () => void
}

const buildGroupHandlersForTextureAreas = (context: TextureAreaHandlerContext) => {
  const {
    references,
    textureStore,
    elementPropertiesStore,
    getAreaMeshes,
    regenerateTextureArea,
    updateSceneElements
  } = context
  return {
    onSelectGroup: (id: string) => {
      elementPropertiesStore.openElementProperties(id)
    },
    onRemoveGroup: (id: string) => {
      const scene = references.threeScene.value
      if (scene) {
        getAreaMeshes(id).forEach((mesh) => scene.remove(mesh))
      }
      const { [id]: _removed, ...remainingCache } = references.areaMeshCache.value
      references.areaMeshCache.value = remainingCache
      textureStore.$patch({
        groups: textureStore.groups.filter((g) => g.id !== id)
      })
      references.textureAreaDefinitions.value = references.textureAreaDefinitions.value.filter(
        (a) => a.name !== id
      )
      elementPropertiesStore.unregisterElementProperties(id)
      updateSceneElements()
    },
    onRemoveTexture: () => {},
    onToggleVisibility: (id: string) => {
      const group = textureStore.groups.find((g) => g.id === id)
      if (!group) return
      textureStore.$patch({
        groups: textureStore.groups.map((g) => (g.id === id ? { ...g, hidden: !group.hidden } : g))
      })
      getAreaMeshes(id).forEach((child) => toggleObjectVisibility(child))
    },
    onToggleWireframe: (id: string) => {
      toggleAreaWireframe(
        id,
        {
          threeScene: references.threeScene,
          threeWorld: references.threeWorld,
          textureAreaConfigs: references.textureAreaConfigs
        },
        textureStore
      )
    },
    onAddTextureToGroup: () => {},
    onAddNewGroup: () => {},
    onManualUpdate: () => {
      references.textureAreaDefinitions.value.forEach((area) => regenerateTextureArea(area))
    },
    onAddElement: () => {}
  }
}

// --- Texture group handlers ---

interface TextureGroupHandlerContext {
  references: Pick<SceneReferences, 'threeScene' | 'threeWorld' | 'groupConfigs'>
  textureStore: ReturnType<typeof useTextureGroupsStore>
  elementPropertiesStore: ReturnType<typeof useElementPropertiesStore>
  getGroupConfig: (groupId: string) => GroupConfig
  registerGroupProperties: (group: TextureGroup) => void
  regenerateGroup: (id: string) => void
  updateSceneElements: () => void
}

const addNewTextureGroup = (event: Event, context: TextureGroupHandlerContext) => {
  const {
    references,
    textureStore,
    elementPropertiesStore,
    getGroupConfig,
    registerGroupProperties,
    updateSceneElements
  } = context
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const file = files[0]
  const url = URL.createObjectURL(file)
  const filename = file.name.replace(/\.[^./]+$/, '')
  const textureId = `texture-${Date.now()}`
  const groupId = `group-${Date.now()}`

  const newGroup: TextureGroup = {
    id: groupId,
    name: filename,
    textures: [{ id: textureId, name: filename, filename, url }]
  }

  const defaultConfig = textureStore.createDefaultGroupConfig()
  references.groupConfigs.value = {
    ...references.groupConfigs.value,
    [groupId]: defaultConfig as unknown as Record<string, unknown>
  }

  textureStore.$patch({ groups: [...textureStore.groups, newGroup] })
  registerGroupProperties(newGroup)
  elementPropertiesStore.openElementProperties(groupId)

  const scene = references.threeScene.value
  if (scene) addGroupMeshes(scene, references.threeWorld.value, newGroup, getGroupConfig)
  updateSceneElements()
  target.value = ''
}

const addTextureToExistingGroup = (
  groupId: string,
  event: Event,
  textureStore: ReturnType<typeof useTextureGroupsStore>,
  regenerateGroup: (id: string) => void
) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const file = files[0]
  const url = URL.createObjectURL(file)
  const filename = file.name.replace(/\.[^./]+$/, '')
  const textureId = `texture-${Date.now()}`

  const group = textureStore.groups.find((g) => g.id === groupId)
  if (group) {
    textureStore.$patch({
      groups: textureStore.groups.map((g) =>
        g.id === groupId
          ? { ...g, textures: [...g.textures, { id: textureId, name: filename, filename, url }] }
          : g
      )
    })
    regenerateGroup(groupId)
  }
  target.value = ''
}

const buildGroupHandlersForTextureGroups = (context: TextureGroupHandlerContext) => {
  const { references, textureStore, elementPropertiesStore, regenerateGroup, updateSceneElements } =
    context
  return {
    onSelectGroup: (id: string) => {
      elementPropertiesStore.openElementProperties(id)
    },
    onRemoveGroup: (id: string) => {
      const scene = references.threeScene.value
      if (scene) removeGroupMeshes(scene, id)
      textureStore.$patch({ groups: textureStore.groups.filter((g) => g.id !== id) })
      elementPropertiesStore.unregisterElementProperties(id)
      updateSceneElements()
    },
    onRemoveTexture: () => {},
    onToggleVisibility: (id: string) => {
      const scene = references.threeScene.value
      const group = textureStore.groups.find((g) => g.id === id)
      if (!group) return
      textureStore.$patch({
        groups: textureStore.groups.map((g) => (g.id === id ? { ...g, hidden: !group.hidden } : g))
      })
      if (scene) {
        const prefix = `grp-${id}-`
        scene.children
          .filter((child) => child.name?.startsWith(prefix))
          .forEach((child) => toggleObjectVisibility(child))
      }
    },
    onToggleWireframe: (id: string) => {
      const group = textureStore.groups.find((g) => g.id === id)
      if (group) {
        textureStore.$patch({
          groups: textureStore.groups.map((g) =>
            g.id === id ? { ...g, showWireframe: !g.showWireframe } : g
          )
        })
        regenerateGroup(id)
      }
    },
    onAddTextureToGroup: (groupId: string, event: Event) => {
      addTextureToExistingGroup(groupId, event, textureStore, regenerateGroup)
    },
    onAddNewGroup: (event: Event) => {
      addNewTextureGroup(event, context)
    },
    onManualUpdate: () => {
      textureStore.groups.forEach((group) => regenerateGroup(group.id))
    },
    onAddElement: () => {}
  }
}

const mountGroupMeshes = (
  scene: THREE.Scene,
  world: unknown,
  textureStore: ReturnType<typeof useTextureGroupsStore>,
  getGroupConfig: (groupId: string) => GroupConfig,
  registerGroupProperties: (group: TextureGroup) => void
) => {
  textureStore.groups.forEach((group) => {
    addGroupMeshes(scene, world, group, getGroupConfig)
    registerGroupProperties(group)
  })
}

// --- Scene element removal ---

interface RemoveHandlerContext {
  threeScene: Ref<THREE.Scene | null>
  threeWorld: Ref<unknown>
  areaMeshCache: Ref<Record<string, THREE.Object3D[]>>
  textureAreaDefinitions: Ref<TextureAreaDefinition[]>
  elementPropertiesStore: ReturnType<typeof useElementPropertiesStore>
  getAreaMeshes: (name: string) => THREE.Object3D[]
  updateSceneElements: () => void
}

const removeSceneElement = (name: string, context: RemoveHandlerContext) => {
  const {
    threeScene,
    threeWorld,
    areaMeshCache,
    textureAreaDefinitions,
    elementPropertiesStore,
    getAreaMeshes
  } = context
  const scene = threeScene.value
  const world = threeWorld.value as { removeRigidBody: (body: unknown) => void } | null
  if (!scene) return

  const removePhysicsBodies = (object: THREE.Object3D) => {
    if (!world) return
    object.traverse((child) => {
      if ((child as THREE.Mesh).userData?.body) {
        world.removeRigidBody((child as THREE.Mesh).userData.body)
      }
    })
  }

  const cachedMeshes = getAreaMeshes(name)
  if (cachedMeshes.length > 0) {
    cachedMeshes.forEach((mesh) => {
      removePhysicsBodies(mesh)
      mesh.removeFromParent()
    })
    const { [name]: _removed, ...remainingCache } = areaMeshCache.value
    areaMeshCache.value = remainingCache
    textureAreaDefinitions.value = textureAreaDefinitions.value.filter((a) => a.name !== name)
    elementPropertiesStore.unregisterElementProperties(name)
  } else {
    const object = scene.getObjectByName(name)
    if (object) {
      removePhysicsBodies(object)
      object.removeFromParent()
    }
  }
  context.updateSceneElements()
}

// --- Store ---

export const useSceneViewStore = defineStore('sceneView', () => {
  const cameraConfig = ref<Record<string, unknown>>({})
  const groundConfig = ref<Record<string, unknown>>({})
  const lightsConfig = ref<Record<string, unknown>>({})
  const skyConfig = ref<Record<string, unknown>>({})
  const groupConfigs = ref<Record<string, Record<string, unknown>>>({})

  const threeScene = ref<THREE.Scene | null>(null)
  const threeWorld = ref<unknown>(null)
  const threeCamera = ref<THREE.Camera | null>(null)
  const orbitReference = ref<OrbitControls | null>(null)
  const groundReference = ref<{ mesh?: THREE.Mesh } | null>(null)
  const ambientLightReference = ref<THREE.Light | null>(null)
  const directionalLightReference = ref<THREE.Light | null>(null)
  const skyMeshReference = ref<THREE.Mesh | null>(null)
  const isInitialized = ref(false)
  const playMode = ref(false)
  const textureAreaConfigs = ref<Record<string, Record<string, unknown>>>({})
  const textureAreaDefinitions = ref<TextureAreaDefinition[]>([])
  const areaMeshCache = ref<Record<string, THREE.Object3D[]>>({})

  const panelsStore = usePanelsStore()
  const viewPanelsStore = useViewPanelsStore()
  const debugSceneStore = useDebugSceneStore()
  const elementPropertiesStore = useElementPropertiesStore()
  const textureStore = useTextureGroupsStore()
  const debouncedRegenerate = createDebouncedMap()

  const getAreaMeshes = (areaName: string): THREE.Object3D[] => areaMeshCache.value[areaName] ?? []

  const buildAreaMeshCache = () => {
    const scene = threeScene.value
    if (!scene) return
    areaMeshCache.value = buildAreaMeshCacheFromScene(scene, textureAreaDefinitions.value)
  }

  const updateSceneElements = () => {
    const defaultGroups = Object.fromEntries(textureStore.groups.map((g) => [g.id, g.name]))

    const toggleVisibilityHandler = (name: string) => {
      const scene = threeScene.value
      const camera = threeCamera.value
      if (!scene) return
      const cachedMeshes = getAreaMeshes(name)
      if (cachedMeshes.length > 0) {
        cachedMeshes.forEach((child) => toggleObjectVisibility(child))
      } else {
        const object =
          name === 'Camera' ? (camera as unknown as THREE.Object3D) : scene.getObjectByName(name)
        if (object) toggleObjectVisibility(object)
      }
      debugSceneStore.$patch({
        sceneElements: debugSceneStore.sceneElements.map((element) =>
          element.name === name ? { ...element, hidden: !element.hidden } : element
        )
      })
    }

    const removeHandler = (name: string) =>
      removeSceneElement(name, {
        threeScene,
        threeWorld,
        areaMeshCache,
        textureAreaDefinitions,
        elementPropertiesStore,
        getAreaMeshes,
        updateSceneElements
      })

    debugSceneStore.setSceneElements(
      buildSceneElements(threeScene, threeCamera, areaMeshCache, textureStore),
      { onToggleVisibility: toggleVisibilityHandler, onRemove: removeHandler },
      defaultGroups
    )
  }

  const registerCameraProperties = () => {
    const camera = threeCamera.value
    const orbit = orbitReference.value
    if (!camera || !('fov' in camera)) return

    registerCameraPropertiesShared({
      camera: camera as THREE.PerspectiveCamera,
      orbit,
      cameraConfig,
      skipOrbitSync: playMode.value
    })
  }

  const registerGroundProperties = () => {
    if (Object.keys(groundConfig.value).length === 0) return

    elementPropertiesStore.registerElementProperties('ground', {
      title: 'Ground',
      schema: groundSchema,
      getValue: (path) => getNestedValue(groundConfig.value, path),
      updateValue: (path, value) => {
        groundConfig.value = setNestedValueImmutable(groundConfig.value, path, value)
        applyGroundUpdate(path, value, groundReference)
      }
    })
  }

  const registerLightsProperties = () => {
    if (Object.keys(lightsConfig.value).length === 0) return

    elementPropertiesStore.registerElementProperties('ambient-light', {
      title: 'Ambient Light',
      schema: lightsSchema.ambient,
      getValue: (path) =>
        getNestedValue(lightsConfig.value.ambient as Record<string, unknown>, path),
      updateValue: (path, value) => {
        lightsConfig.value = setNestedValueImmutable(lightsConfig.value, `ambient.${path}`, value)
        applyLightsUpdate(
          `ambient.${path}`,
          value,
          ambientLightReference,
          directionalLightReference
        )
      }
    })

    elementPropertiesStore.registerElementProperties('directional-light', {
      title: 'Directional Light',
      schema: lightsSchema.directional,
      getValue: (path) =>
        getNestedValue(lightsConfig.value.directional as Record<string, unknown>, path),
      updateValue: (path, value) => {
        lightsConfig.value = setNestedValueImmutable(
          lightsConfig.value,
          `directional.${path}`,
          value
        )
        applyLightsUpdate(
          `directional.${path}`,
          value,
          ambientLightReference,
          directionalLightReference
        )
      }
    })
  }

  const registerSkyProperties = () => {
    if (Object.keys(skyConfig.value).length === 0) return

    elementPropertiesStore.registerElementProperties('sky', {
      title: 'Sky',
      schema: skySchema,
      getValue: (path) => getNestedValue(skyConfig.value, path),
      updateValue: (path, value) => {
        skyConfig.value = setNestedValueImmutable(skyConfig.value, path, value)
        applySkyUpdate(path, value, skyMeshReference)
      }
    })
  }

  const getGroupConfig = (groupId: string): GroupConfig => {
    const config = groupConfigs.value[groupId] as unknown as GroupConfig | undefined
    return config ?? textureStore.createDefaultGroupConfig()
  }

  const regenerateGroup = (groupId: string) => {
    const scene = threeScene.value
    const group = textureStore.groups.find((g) => g.id === groupId)
    if (!scene || !group) return
    removeGroupMeshes(scene, groupId)
    addGroupMeshes(scene, threeWorld.value, group, getGroupConfig)
  }

  const registerGroupProperties = (group: TextureGroup) => {
    const config = groupConfigs.value[group.id]
    if (!config) return

    elementPropertiesStore.registerElementProperties(group.id, {
      title: group.name,
      type: 'group',
      schema: configControls,
      getValue: (path) => getNestedValue(groupConfigs.value[group.id], path),
      updateValue: (path, value) => {
        groupConfigs.value = {
          ...groupConfigs.value,
          [group.id]: setNestedValueImmutable(groupConfigs.value[group.id], path, value)
        }
        if (textureStore.autoUpdate) {
          debouncedRegenerate(group.id, () => regenerateGroup(group.id))
        }
      }
    })
  }

  const getAreaResources = (areaName: string) => {
    const config = textureAreaConfigs.value[areaName] as unknown as GroupConfig
    if (!config?.area || !config?.textures || !config?.instances) return null
    const group = textureStore.groups.find((g) => g.id === areaName)
    const textures = group?.textures ?? []
    if (textures.length === 0) return null
    return { config, textures }
  }

  const regenerateTextureArea = (area: TextureAreaDefinition) => {
    const scene = threeScene.value
    const world = threeWorld.value
    if (!scene) return

    getAreaMeshes(area.name).forEach((mesh) => scene.remove(mesh))

    const resources = getAreaResources(area.name)
    if (!resources) return

    const newMeshes = populateTextureArea(scene, world, area, resources.config, resources.textures)
    areaMeshCache.value = { ...areaMeshCache.value, [area.name]: newMeshes }
  }

  const registerTextureAreaProperties = (areas: TextureAreaDefinition[]) => {
    areas.forEach((area) => {
      elementPropertiesStore.registerElementProperties(area.name, {
        title: area.name,
        type: 'TextureArea',
        schema: configControls,
        getValue: (path) => getNestedValue(textureAreaConfigs.value[area.name], path),
        updateValue: (path, value) => {
          textureAreaConfigs.value = {
            ...textureAreaConfigs.value,
            [area.name]: setNestedValueImmutable(textureAreaConfigs.value[area.name], path, value)
          }
          if (textureStore.autoUpdate) {
            debouncedRegenerate(area.name, () => regenerateTextureArea(area))
          }
        }
      })
    })
  }

  const registerTextureAreas = (areas: TextureAreaDefinition[]) => {
    textureAreaDefinitions.value = [...textureAreaDefinitions.value, ...areas]

    textureAreaConfigs.value = areas.reduce(
      (accumulator, area) => ({ ...accumulator, [area.name]: { ...area.initialData } }),
      { ...textureAreaConfigs.value }
    )

    textureStore.$patch({
      groups: [
        ...textureStore.groups,
        ...areas.map((area) => ({ id: area.name, name: area.name, textures: area.textures ?? [] }))
      ]
    })

    const areaReferences = {
      threeScene,
      threeWorld,
      areaMeshCache,
      textureAreaConfigs,
      textureAreaDefinitions
    }
    textureStore.registerHandlers(
      buildGroupHandlersForTextureAreas({
        references: areaReferences,
        textureStore,
        elementPropertiesStore,
        getAreaMeshes,
        regenerateTextureArea,
        updateSceneElements
      })
    )

    registerTextureAreaProperties(areas)

    const areaGroups = Object.fromEntries(areas.map((a) => [a.name, a.name]))
    debugSceneStore.$patch({ sceneGroups: { ...debugSceneStore.sceneGroups, ...areaGroups } })

    buildAreaMeshCache()
    updateSceneElements()
  }

  const unregisterTextureArea = (areaName: string) => {
    const scene = threeScene.value
    if (scene) {
      getAreaMeshes(areaName).forEach((mesh) => scene.remove(mesh))
    }
    const { [areaName]: _removed, ...remainingCache } = areaMeshCache.value
    areaMeshCache.value = remainingCache
    const { [areaName]: _removedConfig, ...remainingConfigs } = textureAreaConfigs.value
    textureAreaConfigs.value = remainingConfigs
    textureStore.$patch({
      groups: textureStore.groups.filter((g) => g.id !== areaName)
    })
    textureAreaDefinitions.value = textureAreaDefinitions.value.filter((a) => a.name !== areaName)
    elementPropertiesStore.unregisterElementProperties(areaName)
    updateSceneElements()
  }

  const runInit = async (
    canvas: HTMLCanvasElement,
    config: SetupConfig,
    options: InitOptions
  ): Promise<SceneSetupResult> => {
    const {
      setup,
      animate: toolsAnimate,
      scene,
      camera,
      world,
      getDelta,
      clock
    } = await getTools({
      canvas
    })

    if (options.defineSetup) {
      return runSetupWithDefineSetup({
        setup,
        toolsAnimate,
        scene,
        camera,
        world,
        getDelta,
        clock,
        config,
        defineSetupCallback: options.defineSetup
      })
    }

    const result = await setup({ config })
    toolsAnimate({ timeline: createTimelineManager() })
    return { ground: result.ground, orbit: result.orbit as OrbitControls, scene, camera, world }
  }

  const init = async (canvas: HTMLCanvasElement, config: SetupConfig, options?: InitOptions) => {
    const resolvedOptions = options ?? {}
    playMode.value = resolvedOptions.playMode ?? false
    buildInitConfig(config, { cameraConfig, groundConfig, lightsConfig, skyConfig })

    const { ground, orbit, scene, camera, world } = await runInit(canvas, config, resolvedOptions)

    resolveSceneReferencesFromResult(
      { scene, camera, world, orbit: orbit ?? ({} as OrbitControls), ground },
      {
        threeScene,
        threeCamera,
        threeWorld,
        orbitReference,
        groundReference,
        ambientLightReference,
        directionalLightReference,
        skyMeshReference
      }
    )

    registerCameraProperties()
    if (config.ground !== false) registerGroundProperties()
    if (config.lights !== false) registerLightsProperties()
    if (config.sky !== false) registerSkyProperties()

    viewPanelsStore.setViewPanels(resolvedOptions.viewPanels ?? {})
    updateSceneElements()
    if (viewPanelsStore.viewPanels.showElements) panelsStore.openPanel('elements')
    isInitialized.value = true
  }

  const initTextureGroups = (
    groups: TextureGroupDefinition[],
    defaultGroups: Record<string, string>,
    initialConfigs?: Record<string, GroupConfig>
  ) => {
    groupConfigs.value = groups.reduce(
      (accumulator, group) => ({
        ...accumulator,
        [group.id]: (groupConfigs.value[group.id] ??
          (initialConfigs?.[group.id] as unknown as Record<string, unknown>) ??
          textureStore.createDefaultGroupConfig()) as unknown as Record<string, unknown>
      }),
      { ...groupConfigs.value }
    )

    textureStore.$patch({
      groups: [
        ...textureStore.groups,
        ...groups.map((g) => ({ id: g.id, name: g.name, textures: [...g.textures] }))
      ]
    })

    const groupReferences = { threeScene, threeWorld, groupConfigs }
    textureStore.registerHandlers(
      buildGroupHandlersForTextureGroups({
        references: groupReferences,
        textureStore,
        elementPropertiesStore,
        getGroupConfig,
        registerGroupProperties,
        regenerateGroup,
        updateSceneElements
      })
    )

    const scene = threeScene.value
    const world = threeWorld.value
    if (scene) mountGroupMeshes(scene, world, textureStore, getGroupConfig, registerGroupProperties)

    debugSceneStore.$patch({ sceneGroups: defaultGroups })
    updateSceneElements()
  }

  const cleanup = () => {
    viewPanelsStore.clearViewPanels()
    debugSceneStore.clearSceneElements()
    elementPropertiesStore.clearAllElementProperties()
    textureStore.clear()
    cameraConfig.value = {}
    groundConfig.value = {}
    lightsConfig.value = {}
    skyConfig.value = {}
    groupConfigs.value = {}
    textureAreaConfigs.value = {}
    textureAreaDefinitions.value = []
    areaMeshCache.value = {}
    playMode.value = false
    threeScene.value = null
    threeWorld.value = null
    threeCamera.value = null
    orbitReference.value = null
    groundReference.value = null
    ambientLightReference.value = null
    directionalLightReference.value = null
    skyMeshReference.value = null
    isInitialized.value = false
  }

  return {
    cameraConfig,
    groundConfig,
    lightsConfig,
    skyConfig,
    groupConfigs,
    textureAreaConfigs,
    textureAreaDefinitions,
    threeScene,
    threeWorld,
    threeCamera,
    orbitReference,
    isInitialized,
    playMode,
    init,
    initTextureGroups,
    registerTextureAreas,
    unregisterTextureArea,
    cleanup,
    getGroupConfig,
    regenerateGroup,
    refreshElements: updateSceneElements
  }
})
