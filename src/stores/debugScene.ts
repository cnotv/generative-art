import { defineStore } from 'pinia'
import { ref } from 'vue'
import type * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
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

export const useDebugSceneStore = defineStore('debugScene', () => {
  const sceneElements = ref<SceneElement[]>([])
  const sceneGroups = ref<Record<string, string>>({})
  const spawns = ref<SpawnEntry[]>([])
  const handlers = ref<DebugSceneHandlers | null>(null)
  const spawnHandlers = ref<Record<string, () => void>>({})

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
    setSceneElements,
    addSceneElement,
    removeSceneElement,
    registerSceneElements,
    registerSpawn,
    unregisterSpawn,
    toggleSpawnVisibility,
    clearSceneElements,
    handleToggleVisibility,
    handleRemove,
    moveElementAfter
  }
})
