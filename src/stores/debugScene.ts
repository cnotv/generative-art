import { defineStore } from 'pinia'
import { ref } from 'vue'
import type * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CoordinateTuple } from '@webgamekit/threejs'
import { usePerfMetricsStore } from './perfMetrics'
import { useElementPropertiesStore, type ElementPropertiesConfig } from './elementProperties'
import { registerCameraProperties } from '@/utils/cameraProperties'

const GENERIC_THREE_TYPES = new Set([
  'Mesh',
  'Object3D',
  'Group',
  'Line',
  'Points',
  'Sprite',
  'InstancedMesh',
  'SkinnedMesh',
  'LineSegments',
  'LineLoop'
])

const warnIfGenericName = (name: string) => {
  if (import.meta.env.DEV && (!name || GENERIC_THREE_TYPES.has(name))) {
    console.warn(
      `[ElementsPanel] Element registered with generic name "${name}". Provide a descriptive scene-role name instead.`
    )
  }
}

export interface SceneElement {
  name: string
  label?: string
  type: string
  hidden?: boolean
  groupId?: string
  spawnId?: string
}

export interface SpawnEntry {
  id: string
  label: string
  hidden?: boolean
}

export interface DebugSceneHandlers {
  onToggleVisibility: (name: string) => void
  onRemove: (name: string) => void
}

export interface InstancedGroupHandlers {
  onAdd: (position: CoordinateTuple) => void
  onDelete: (index: number) => void
  onUpdate: (index: number, position: CoordinateTuple) => void
  onToggleVisibility: (hidden: boolean) => void
  onRemove: () => void
}

export interface InstancedGroup {
  id: string
  label: string
  positions: CoordinateTuple[]
  hidden?: boolean
  handlers: InstancedGroupHandlers
}

export interface SpawnGroupHandlers {
  onToggleVisibility: (hidden: boolean) => void
  onRemove: () => void
}

export interface SpawnGroup {
  id: string
  label: string
  count: number
  hidden?: boolean
  handlers: SpawnGroupHandlers
}

export interface PathConfig {
  speed: number
  obstacleImpulse: number
  easing: string
  easingIntensity: number
  playing: boolean
  loop: boolean
  pingPong: boolean
  showPath: boolean
  showNodes: boolean
}

export interface PathHandlers {
  onAddWaypoint: (position: CoordinateTuple) => void
  onRemoveWaypoint: (index: number) => void
  onUpdateWaypoint: (index: number, position: CoordinateTuple) => void
  onReset: () => void
  onToggleVisibility: (hidden: boolean) => void
  onRemove: () => void
  onConfigChange: (key: keyof PathConfig, value: unknown) => void
}

export interface PathEntry {
  id: string
  elementName: string
  label: string
  waypoints: CoordinateTuple[]
  config: PathConfig
  hidden?: boolean
  handlers: PathHandlers
}

export interface PathRegistrationContext {
  onEnablePath: (elementName: string) => void
}

export const useDebugSceneStore = defineStore('debugScene', () => {
  const sceneElements = ref<SceneElement[]>([])
  const sceneGroups = ref<Record<string, string>>({})
  const spawns = ref<SpawnEntry[]>([])
  const instancedGroups = ref<InstancedGroup[]>([])
  const spawnGroups = ref<SpawnGroup[]>([])
  const paths = ref<PathEntry[]>([])
  const handlers = ref<DebugSceneHandlers | null>(null)
  const spawnHandlers = ref<Record<string, () => void>>({})
  const pathRegistrationContext = ref<PathRegistrationContext | null>(null)

  const setSceneElements = (
    elements: SceneElement[],
    newHandlers: DebugSceneHandlers,
    groups?: Record<string, string>
  ) => {
    sceneElements.value = elements
    handlers.value = newHandlers
    sceneGroups.value = groups ?? {}
  }

  interface RegisterSceneOptions {
    renderer?: THREE.WebGLRenderer
    orbit?: OrbitControls | null
    setCamera?: (newCamera: THREE.Camera) => OrbitControls | null
  }

  type ObjectEntry = { name?: string; type: string; visible?: boolean }

  const resolveRawNames = (objects: ObjectEntry[]): string[] =>
    objects.map((element) => {
      const rawName = element.name || element.type
      warnIfGenericName(rawName)
      return rawName
    })

  const resolveElementNames = (objects: ObjectEntry[]): SceneElement[] => {
    const rawNames = resolveRawNames(objects)
    return rawNames.map((rawName, index) => {
      const previousCount = rawNames.slice(0, index).filter((n) => n === rawName).length
      const name = previousCount === 0 ? rawName : `${rawName} (${previousCount + 1})`
      return { name, type: objects[index].type, hidden: false }
    })
  }

  const registerSceneElements = (
    camera: THREE.Camera,
    objects: ObjectEntry[],
    elementHandlers?: Partial<DebugSceneHandlers>,
    options?: RegisterSceneOptions
  ) => {
    const { renderer, orbit, setCamera } = options ?? {}
    const defaultToggleVisibility = (name: string) => {
      const sceneObject = objects.find((o) => o.name === name) as { visible?: boolean } | undefined
      if (sceneObject && typeof sceneObject.visible === 'boolean') {
        Reflect.set(sceneObject, 'visible', !sceneObject.visible)
      }
    }
    setSceneElements(
      [{ name: 'Camera', type: camera.type, hidden: false }, ...resolveElementNames(objects)],
      {
        onToggleVisibility: elementHandlers?.onToggleVisibility ?? defaultToggleVisibility,
        onRemove: elementHandlers?.onRemove ?? (() => {})
      }
    )
    if ('fov' in camera) {
      registerCameraProperties({ camera, orbit, renderer, setCamera })
    }
    if (renderer) usePerfMetricsStore().setRenderer(renderer)
  }

  const registerSpawn = (id: string, label: string, onToggleVisibility?: () => void) => {
    spawns.value = [...spawns.value.filter((s) => s.id !== id), { id, label }]
    if (onToggleVisibility) {
      spawnHandlers.value = { ...spawnHandlers.value, [id]: onToggleVisibility }
    }
  }

  const toggleSpawnVisibility = (id: string) => {
    spawns.value = spawns.value.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s))
    spawnHandlers.value[id]?.()
  }

  const unregisterSpawn = (id: string) => {
    spawns.value = spawns.value.filter((s) => s.id !== id)
    const { [id]: _removed, ...rest } = spawnHandlers.value
    spawnHandlers.value = rest
  }

  const addSceneElement = (element: SceneElement, properties: ElementPropertiesConfig) => {
    warnIfGenericName(element.name)
    if (sceneElements.value.some((e) => e.name === element.name)) return
    sceneElements.value = [...sceneElements.value, element]
    useElementPropertiesStore().registerElementProperties(element.name, properties)
  }

  const removeSceneElement = (name: string) => {
    sceneElements.value = sceneElements.value.filter((e) => e.name !== name)
    useElementPropertiesStore().unregisterElementProperties(name)
  }

  const clearSceneElements = () => {
    sceneElements.value = []
    sceneGroups.value = {}
    spawns.value = []
    instancedGroups.value = []
    spawnGroups.value = []
    paths.value = []
    handlers.value = null
    usePerfMetricsStore().clearRenderer()
  }

  const handleToggleVisibility = (name: string) => {
    sceneElements.value = sceneElements.value.map((e) =>
      e.name === name ? { ...e, hidden: !e.hidden } : e
    )
    handlers.value?.onToggleVisibility(name)
  }

  const handleRemove = (name: string) => {
    handlers.value?.onRemove(name)
    removeSceneElement(name)
  }

  const addInstancedGroup = (group: InstancedGroup) => {
    const existing = instancedGroups.value.find((g) => g.id === group.id)
    const merged = { ...group, hidden: group.hidden ?? existing?.hidden ?? false }
    instancedGroups.value = [...instancedGroups.value.filter((g) => g.id !== group.id), merged]
  }

  const removeInstancedGroup = (id: string) => {
    const group = instancedGroups.value.find((g) => g.id === id)
    group?.handlers.onRemove()
    instancedGroups.value = instancedGroups.value.filter((g) => g.id !== id)
  }

  const toggleInstancedGroupVisibility = (id: string) => {
    instancedGroups.value = instancedGroups.value.map((g) => {
      if (g.id !== id) return g
      const hidden = !g.hidden
      g.handlers.onToggleVisibility(hidden)
      return { ...g, hidden }
    })
  }

  const updateInstancedGroupPosition = (id: string, index: number, position: CoordinateTuple) => {
    instancedGroups.value = instancedGroups.value.map((g) =>
      g.id !== id
        ? g
        : {
            ...g,
            positions: g.positions.map((p, i) => (i === index ? position : p))
          }
    )
  }

  const addSpawnGroup = (group: SpawnGroup) => {
    const existing = spawnGroups.value.find((g) => g.id === group.id)
    const merged = { ...group, hidden: group.hidden ?? existing?.hidden ?? false }
    spawnGroups.value = [...spawnGroups.value.filter((g) => g.id !== group.id), merged]
  }

  const removeSpawnGroup = (id: string) => {
    const group = spawnGroups.value.find((g) => g.id === id)
    group?.handlers.onRemove()
    spawnGroups.value = spawnGroups.value.filter((g) => g.id !== id)
    useElementPropertiesStore().unregisterElementProperties(id)
  }

  const toggleSpawnGroupVisibility = (id: string) => {
    spawnGroups.value = spawnGroups.value.map((g) => {
      if (g.id !== id) return g
      const hidden = !g.hidden
      g.handlers.onToggleVisibility(hidden)
      return { ...g, hidden }
    })
  }

  const setSpawnGroupCount = (id: string, count: number) => {
    spawnGroups.value = spawnGroups.value.map((g) => (g.id === id ? { ...g, count } : g))
  }

  const registerPathContext = (context: PathRegistrationContext) => {
    pathRegistrationContext.value = context
  }

  const unregisterPathContext = () => {
    pathRegistrationContext.value = null
  }

  const enablePathForElement = (elementName: string) => {
    pathRegistrationContext.value?.onEnablePath(elementName)
  }

  const addPath = (entry: PathEntry) => {
    const existing = paths.value.find((p) => p.id === entry.id)
    const merged = { ...entry, hidden: entry.hidden ?? existing?.hidden ?? false }
    paths.value = [...paths.value.filter((p) => p.id !== entry.id), merged]
  }

  const removePath = (id: string) => {
    const entry = paths.value.find((p) => p.id === id)
    entry?.handlers.onRemove()
    paths.value = paths.value.filter((p) => p.id !== id)
    useElementPropertiesStore().unregisterElementProperties(id)
  }

  const togglePathVisibility = (id: string) => {
    paths.value = paths.value.map((p) => {
      if (p.id !== id) return p
      const hidden = !p.hidden
      p.handlers.onToggleVisibility(hidden)
      return { ...p, hidden }
    })
  }

  const addPathWaypoint = (id: string, position: CoordinateTuple) => {
    const entry = paths.value.find((p) => p.id === id)
    if (!entry) return
    entry.handlers.onAddWaypoint(position)
    paths.value = paths.value.map((p) =>
      p.id === id ? { ...p, waypoints: [...p.waypoints, position] } : p
    )
  }

  const removePathWaypoint = (id: string, index: number) => {
    const entry = paths.value.find((p) => p.id === id)
    if (!entry) return
    entry.handlers.onRemoveWaypoint(index)
    paths.value = paths.value.map((p) =>
      p.id === id ? { ...p, waypoints: p.waypoints.filter((_, i) => i !== index) } : p
    )
  }

  const updatePathWaypoint = (id: string, index: number, position: CoordinateTuple) => {
    const entry = paths.value.find((p) => p.id === id)
    if (!entry) return
    entry.handlers.onUpdateWaypoint(index, position)
    paths.value = paths.value.map((p) =>
      p.id === id ? { ...p, waypoints: p.waypoints.map((w, i) => (i === index ? position : w)) } : p
    )
  }

  const updatePathConfig = (id: string, key: keyof PathConfig, value: unknown) => {
    const entry = paths.value.find((p) => p.id === id)
    if (!entry) return
    entry.handlers.onConfigChange(key, value)
    paths.value = paths.value.map((p) =>
      p.id === id ? { ...p, config: { ...p.config, [key]: value } } : p
    )
  }

  const moveElementAfter = (name: string, afterName: string) => {
    const index = sceneElements.value.findIndex((e) => e.name === name)
    const afterIndex = sceneElements.value.findIndex((e) => e.name === afterName)
    if (index === -1 || afterIndex === -1 || index === afterIndex + 1) return
    const element = sceneElements.value[index]
    const without = sceneElements.value.filter((_, i) => i !== index)
    const insertAt = without.findIndex((e) => e.name === afterName) + 1
    sceneElements.value = [...without.slice(0, insertAt), element, ...without.slice(insertAt)]
  }

  return {
    sceneElements,
    sceneGroups,
    spawns,
    instancedGroups,
    spawnGroups,
    paths,
    setSceneElements,
    addSceneElement,
    removeSceneElement,
    registerSceneElements,
    addInstancedGroup,
    removeInstancedGroup,
    toggleInstancedGroupVisibility,
    updateInstancedGroupPosition,
    addSpawnGroup,
    removeSpawnGroup,
    toggleSpawnGroupVisibility,
    setSpawnGroupCount,
    registerPathContext,
    unregisterPathContext,
    enablePathForElement,
    addPath,
    removePath,
    togglePathVisibility,
    addPathWaypoint,
    removePathWaypoint,
    updatePathWaypoint,
    updatePathConfig,
    registerSpawn,
    unregisterSpawn,
    toggleSpawnVisibility,
    clearSceneElements,
    handleToggleVisibility,
    handleRemove,
    moveElementAfter
  }
})
