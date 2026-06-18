import cloudUrl from '@/assets/images/goomba/cloud.png'
export { cloudUrl }
import { ref, reactive, toRaw } from 'vue'
import * as THREE from 'three'
import {
  getCube,
  getBall,
  generateAreaPositions,
  getTools,
  type ComplexModel
} from '@webgamekit/threejs'
import type { CoordinateTuple } from '@webgamekit/animation'
import {
  registerTextureAreaProperties,
  buildTextureAreaConfig
} from '@/utils/textureAreaProperties'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useTextureGroupsStore } from '@/stores/textureGroups'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects'
import { CLOUD_AREA_NAME, CLOUD_AREA_SEED, CLOUD_AREA_CONTROLS } from './config'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>
export type WorldReference = NonNullable<GetToolsResult['world']>

export type CloudBuildOptions = {
  center: CoordinateTuple
  size: CoordinateTuple
  baseSize: CoordinateTuple
  rotation: CoordinateTuple
  sizeVariation: CoordinateTuple
  rotationVariation: CoordinateTuple
  pattern: 'random' | 'grid' | 'grid-jitter'
  count: number
  seed: number
  opacity: number
}

const HALF = 0.5
const applyVariation = (base: number, variation: number): number =>
  base + (Math.random() - HALF) * 2 * variation

export const buildCloudObjects = (
  scene: THREE.Scene,
  world: WorldReference,
  options: CloudBuildOptions
): ComplexModel[] => {
  const {
    center,
    size,
    baseSize,
    rotation,
    sizeVariation,
    rotationVariation,
    pattern,
    count,
    seed,
    opacity
  } = options
  const positions = generateAreaPositions({ center, size, count, pattern, seed })
  return positions.map((position, index) => {
    const instanceSize: CoordinateTuple = [
      Math.max(1, applyVariation(baseSize[0], sizeVariation[0])),
      baseSize[1],
      Math.max(1, applyVariation(baseSize[2], sizeVariation[2]))
    ]
    const instanceRotation: CoordinateTuple = [
      rotation[0] + applyVariation(0, rotationVariation[0]),
      rotation[1] + applyVariation(0, rotationVariation[1]),
      rotation[2] + applyVariation(0, rotationVariation[2])
    ]
    const cloud = getCube(scene, world, {
      name: `cloud-${index + 1}`,
      size: instanceSize,
      position,
      rotation: instanceRotation,
      texture: cloudUrl,
      material: 'MeshBasicMaterial',
      transparent: true,
      opacity,
      alphaTest: 0.5,
      depthWrite: false,
      renderOrder: 1,
      type: 'fixed',
      castShadow: false,
      receiveShadow: false
    })
    const cloudMesh = cloud as unknown as THREE.Mesh
    cloudMesh.geometry.dispose()
    cloudMesh.geometry = new THREE.PlaneGeometry(instanceSize[0], instanceSize[2])
    if (cloudMesh.material instanceof THREE.Material) cloudMesh.material.side = THREE.DoubleSide
    cloudMesh.rotation.set(0, instanceRotation[1], instanceRotation[2])
    return cloud
  })
}

export const disposeClouds = (
  objects: ComplexModel[],
  scene: THREE.Scene | null,
  world: WorldReference | null
): void => {
  objects.forEach((cloudObject) => {
    const mesh = cloudObject as unknown as THREE.Mesh
    scene?.remove(cloudObject)
    mesh.geometry.dispose()
    if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    world?.removeRigidBody(cloudObject.userData.body)
  })
}

export const SHARED_CLOUD_OPTIONS: CloudBuildOptions = {
  center: [0, -100, 50],
  size: [600, 0, 1400],
  baseSize: [145, 0.001, 60],
  rotation: [Math.PI / 2, 0, 0],
  sizeVariation: [0, 0, 0],
  rotationVariation: [0, 0, 0],
  pattern: 'grid-jitter',
  count: 30,
  seed: CLOUD_AREA_SEED,
  opacity: 1
}

export const setupCloudArea = (
  scene: THREE.Scene,
  world: WorldReference,
  onRebuild: (updated: ComplexModel[]) => void
): ComplexModel[] => {
  const areaConfigs = ref<Record<string, Record<string, unknown>>>({})
  let currentObjects = buildCloudObjects(scene, world, SHARED_CLOUD_OPTIONS)
  registerTextureAreaProperties({
    areaName: CLOUD_AREA_NAME,
    layers: [
      {
        name: CLOUD_AREA_NAME,
        texture: cloudUrl,
        baseSize: SHARED_CLOUD_OPTIONS.baseSize,
        center: SHARED_CLOUD_OPTIONS.center,
        size: SHARED_CLOUD_OPTIONS.size,
        density: SHARED_CLOUD_OPTIONS.count,
        seed: SHARED_CLOUD_OPTIONS.seed,
        speed: 0,
        opacity: 1
      }
    ],
    schema: CLOUD_AREA_CONTROLS,
    areaConfigs,
    onUpdate: (name) => {
      const config = areaConfigs.value[name]
      if (!config) return
      const area = config.area as {
        center: { x: number; y: number; z: number }
        size: { x: number; y: number; z: number }
      }
      const textures = config.textures as {
        baseSize: { x: number; y: number; z: number }
        rotation: { x: number; y: number; z: number }
        sizeVariation: { x: number; y: number; z: number }
        rotationVariation: { x: number; y: number; z: number }
      }
      const instances = config.instances as {
        density: number
        pattern: 'random' | 'grid' | 'grid-jitter'
        seed: number
      }
      const rendering = config.rendering as { opacity: number }
      disposeClouds(currentObjects, scene, world)
      currentObjects = buildCloudObjects(scene, world, {
        center: [area.center.x, area.center.y, area.center.z],
        size: [area.size.x, area.size.y, area.size.z],
        baseSize: [textures.baseSize.x, textures.baseSize.y, textures.baseSize.z],
        rotation: [textures.rotation.x, textures.rotation.y, textures.rotation.z],
        sizeVariation: [
          textures.sizeVariation.x,
          textures.sizeVariation.y,
          textures.sizeVariation.z
        ],
        rotationVariation: [
          textures.rotationVariation.x,
          textures.rotationVariation.y,
          textures.rotationVariation.z
        ],
        pattern: instances.pattern,
        count: instances.density,
        seed: instances.seed,
        opacity: rendering.opacity
      })
      onRebuild(currentObjects)
    }
  })
  return currentObjects
}

export const teardownCloudArea = (): void => {
  useDebugSceneStore().removeSceneElement(CLOUD_AREA_NAME)
}

/**
 * Registers the cloud area as an ElementGroup in the elements panel (same style as ForestGame).
 * Wires up the textureStore group, schema controls, and rebuild handlers.
 *
 * @param scene - Three.js scene
 * @param world - Rapier world
 * @param initialOptions - Initial cloud build configuration
 * @returns The built cloud ComplexModel array
 */
export const setupCloudAreaAsGroup = (
  scene: THREE.Scene,
  world: WorldReference,
  initialOptions: CloudBuildOptions
): ComplexModel[] => {
  const textureStore = useTextureGroupsStore()
  const debugSceneStore = useDebugSceneStore()
  const elementPropertiesStore = useElementPropertiesStore()

  const areaConfigs = ref<Record<string, Record<string, unknown>>>({})
  areaConfigs.value[CLOUD_AREA_NAME] = buildTextureAreaConfig([
    {
      name: CLOUD_AREA_NAME,
      texture: cloudUrl,
      baseSize: initialOptions.baseSize,
      rotation: initialOptions.rotation,
      center: initialOptions.center,
      size: initialOptions.size,
      density: initialOptions.count,
      seed: initialOptions.seed,
      speed: 0,
      opacity: initialOptions.opacity,
      pattern: initialOptions.pattern,
      sizeVariation: initialOptions.sizeVariation,
      rotationVariation: initialOptions.rotationVariation
    }
  ])

  let currentObjects = buildCloudObjects(scene, world, initialOptions)
  currentObjects.forEach((sceneObject) => {
    sceneObject.userData.textureGroupId = CLOUD_AREA_NAME
  })

  textureStore.$patch({
    groups: [
      ...textureStore.groups,
      {
        id: CLOUD_AREA_NAME,
        name: 'Clouds',
        textures: [{ id: 'cloud-tex', name: 'cloud.png', filename: 'cloud.png', url: cloudUrl }],
        instanceCount: initialOptions.count
      }
    ]
  })

  debugSceneStore.$patch({
    sceneGroups: { ...debugSceneStore.sceneGroups, [CLOUD_AREA_NAME]: 'Clouds' }
  })

  const rebuild = () => {
    const config = areaConfigs.value[CLOUD_AREA_NAME]
    if (!config) return
    const area = config.area as {
      center: { x: number; y: number; z: number }
      size: { x: number; y: number; z: number }
    }
    const textures = config.textures as {
      baseSize: { x: number; y: number; z: number }
      rotation: { x: number; y: number; z: number }
      sizeVariation: { x: number; y: number; z: number }
      rotationVariation: { x: number; y: number; z: number }
    }
    const instances = config.instances as {
      density: number
      pattern: 'random' | 'grid' | 'grid-jitter'
      seed: number
    }
    const rendering = config.rendering as { opacity: number }
    disposeClouds(currentObjects, scene, world)
    currentObjects = buildCloudObjects(scene, world, {
      center: [area.center.x, area.center.y, area.center.z],
      size: [area.size.x, area.size.y, area.size.z],
      baseSize: [textures.baseSize.x, textures.baseSize.y, textures.baseSize.z],
      rotation: [textures.rotation.x, textures.rotation.y, textures.rotation.z],
      sizeVariation: [textures.sizeVariation.x, textures.sizeVariation.y, textures.sizeVariation.z],
      rotationVariation: [
        textures.rotationVariation.x,
        textures.rotationVariation.y,
        textures.rotationVariation.z
      ],
      pattern: instances.pattern,
      count: instances.density,
      seed: instances.seed,
      opacity: rendering.opacity
    })
    currentObjects.forEach((sceneObject) => {
      sceneObject.userData.textureGroupId = CLOUD_AREA_NAME
    })
    textureStore.$patch({
      groups: textureStore.groups.map((g) =>
        g.id === CLOUD_AREA_NAME ? { ...g, instanceCount: instances.density } : g
      )
    })
  }

  debugSceneStore.addSceneElement(
    { name: CLOUD_AREA_NAME, type: 'TextureArea', hidden: false, groupId: CLOUD_AREA_NAME },
    {
      title: 'Clouds',
      type: 'TextureArea',
      schema: CLOUD_AREA_CONTROLS,
      getValue: (path: string) => getNestedValue(toRaw(areaConfigs.value)[CLOUD_AREA_NAME], path),
      updateValue: (path: string, value: unknown) => {
        const raw = toRaw(areaConfigs.value)
        raw[CLOUD_AREA_NAME] = setNestedValueImmutable(raw[CLOUD_AREA_NAME], path, value)
        if (textureStore.autoUpdate) rebuild()
      }
    }
  )

  textureStore.registerHandlers({
    onSelectGroup: (id) => {
      if (id === CLOUD_AREA_NAME) elementPropertiesStore.openElementProperties(CLOUD_AREA_NAME)
    },
    onToggleVisibility: (id) => {
      if (id !== CLOUD_AREA_NAME) return
      const group = textureStore.groups.find((g) => g.id === id)
      const isNowHidden = !group?.hidden
      textureStore.$patch({
        groups: textureStore.groups.map((g) => (g.id === id ? { ...g, hidden: isNowHidden } : g))
      })
      currentObjects.forEach((sceneObject) => {
        sceneObject.visible = !isNowHidden
      })
    },
    onToggleWireframe: () => {},
    onRemoveGroup: () => {
      disposeClouds(currentObjects, scene, world)
    },
    onRemoveTexture: () => {},
    onAddTextureToGroup: () => {},
    onAddNewGroup: () => {},
    onManualUpdate: rebuild,
    onAddElement: () => {}
  })

  return currentObjects
}

const GROUND_SPHERE_RADIUS = 1500
const GROUND_SPHERE_Y = -1700
const GROUND_SPHERE_Z = -120
const GROUND_SPHERE_CENTER: CoordinateTuple = [0, GROUND_SPHERE_Y, GROUND_SPHERE_Z]
const GROUND_SPHERE_COLOR = 0x4a7a3a

export const addGroundSphereToScene = (scene: THREE.Scene): THREE.Mesh => {
  const mesh = getBall(scene, undefined, {
    size: GROUND_SPHERE_RADIUS,
    position: GROUND_SPHERE_CENTER,
    color: GROUND_SPHERE_COLOR,
    segments: 64,
    castShadow: false,
    receiveShadow: false
  })
  mesh.userData.skipEdgeLines = true
  return mesh as unknown as THREE.Mesh
}

export const registerGroundSphereProperties = (groundMesh: THREE.Mesh): void => {
  const state = reactive({
    position: { x: groundMesh.position.x, y: groundMesh.position.y, z: groundMesh.position.z },
    radius: groundMesh.scale.x * GROUND_SPHERE_RADIUS,
    color: (groundMesh.material as THREE.MeshStandardMaterial).color.getHex()
  })
  useDebugSceneStore().addSceneElement(
    { name: 'Ground', type: 'Mesh', hidden: false },
    {
      title: 'Ground',
      type: 'Mesh',
      schema: {
        position: {
          label: 'Position',
          component: 'CoordinateInput',
          min: { x: -2000, y: -2000, z: -2000 },
          max: { x: 2000, y: 2000, z: 2000 },
          step: { x: 10, y: 10, z: 10 }
        },
        radius: { label: 'Radius', min: 100, max: 2000, step: 10 },
        color: { label: 'Color', color: true }
      },
      getValue: (path: string) => {
        if (path === 'position')
          return { x: state.position.x, y: state.position.y, z: state.position.z }
        if (path === 'radius') return state.radius
        if (path === 'color') return state.color
        return undefined
      },
      updateValue: (path: string, value: unknown) => {
        if (path === 'position') {
          const v = value as { x: number; y: number; z: number }
          state.position = { x: v.x, y: v.y, z: v.z }
          groundMesh.position.set(v.x, v.y, v.z)
        } else if (path === 'radius') {
          state.radius = value as number
          const scale = (value as number) / GROUND_SPHERE_RADIUS
          groundMesh.scale.set(scale, scale, scale)
        } else if (path === 'color') {
          state.color = value as number
          ;(groundMesh.material as THREE.MeshStandardMaterial).color.setHex(value as number)
        }
      }
    }
  )
}

export const teardownGroundSphere = (): void => {
  useDebugSceneStore().removeSceneElement('Ground')
}

export const moveGroundSphere = (mesh: THREE.Mesh, x: number, z: number): void => {
  mesh.position.x = x
  mesh.position.z = z
}

type CloudChunk = { startZ: number; endZ: number; meshes: ComplexModel[] }

export type CloudChunkOptions = {
  chunkLength: number
  countPerChunk: number
  lookaheadZ: number
  disposeBehindZ: number
  baseSize?: CoordinateTuple
  centerY?: number
  sizeX?: number
  opacity?: number
}

export type CloudChunkManager = {
  ensureAhead: (marbleZ: number) => void
  prune: (marbleZ: number) => void
  teardown: () => void
}

export const createCloudChunkManager = (
  scene: THREE.Scene,
  world: WorldReference,
  options: CloudChunkOptions
): CloudChunkManager => {
  const baseSize = options.baseSize ?? SHARED_CLOUD_OPTIONS.baseSize
  const centerY = options.centerY ?? SHARED_CLOUD_OPTIONS.center[1]
  const sizeX = options.sizeX ?? SHARED_CLOUD_OPTIONS.size[0]
  const opacity = options.opacity ?? SHARED_CLOUD_OPTIONS.opacity
  let chunks: CloudChunk[] = []
  let chunkSerial = 0

  const spawnChunk = (startZ: number, endZ: number): void => {
    const centerZ = (startZ + endZ) / 2
    const chunkLength = startZ - endZ
    const meshes = buildCloudObjects(scene, world, {
      ...SHARED_CLOUD_OPTIONS,
      center: [0, centerY, centerZ],
      size: [sizeX, 0, chunkLength],
      baseSize,
      count: options.countPerChunk,
      seed: CLOUD_AREA_SEED + chunkSerial,
      opacity
    })
    chunkSerial += 1
    chunks.push({ startZ, endZ, meshes })
  }

  const ensureAhead = (marbleZ: number): void => {
    const targetFarZ = marbleZ - options.lookaheadZ
    const tail = chunks[chunks.length - 1]
    if (tail && tail.endZ <= targetFarZ) return
    const startZ = tail ? tail.endZ : marbleZ + options.chunkLength
    spawnChunk(startZ, startZ - options.chunkLength)
    ensureAhead(marbleZ)
  }

  const prune = (marbleZ: number): void => {
    const cutoffZ = marbleZ + options.disposeBehindZ
    const toRemove = chunks.filter((c) => c.endZ > cutoffZ)
    toRemove.forEach((c) => disposeClouds(c.meshes, scene, world))
    chunks = chunks.filter((c) => c.endZ <= cutoffZ)
  }

  const teardown = (): void => {
    chunks.forEach((c) => disposeClouds(c.meshes, scene, world))
    chunks = []
  }

  return { ensureAhead, prune, teardown }
}
