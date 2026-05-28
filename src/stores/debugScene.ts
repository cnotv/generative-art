import { defineStore } from 'pinia'
import { ref } from 'vue'
import type * as THREE from 'three'
import { usePerfMetricsStore } from './perfMetrics'

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

  const registerSceneElements = (
    camera: { type: string },
    objects: Array<{ name?: string; type: string }>,
    elementHandlers?: Partial<DebugSceneHandlers>,
    renderer?: THREE.WebGLRenderer
  ) => {
    setSceneElements(
      [
        { name: 'Camera', type: camera.type, hidden: false },
        ...objects.map((element) => ({
          name: element.name || element.type,
          type: element.type,
          hidden: false
        }))
      ],
      {
        onToggleVisibility: elementHandlers?.onToggleVisibility ?? (() => {}),
        onRemove: elementHandlers?.onRemove ?? (() => {})
      }
    )
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

  const addSceneElement = (element: SceneElement) => {
    if (sceneElements.value.some((e) => e.name === element.name)) return
    sceneElements.value = [...sceneElements.value, element]
  }

  const removeSceneElement = (name: string) => {
    sceneElements.value = sceneElements.value.filter((e) => e.name !== name)
  }

  const clearSceneElements = () => {
    sceneElements.value = []
    sceneGroups.value = {}
    spawns.value = []
    handlers.value = null
    usePerfMetricsStore().clearRenderer()
  }

  const handleToggleVisibility = (name: string) => {
    handlers.value?.onToggleVisibility(name)
  }

  const handleRemove = (name: string) => {
    handlers.value?.onRemove(name)
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
    handleRemove
  }
})
