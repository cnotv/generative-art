import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ConfigControlsSchema } from '@/stores/viewConfig'

export interface ElementPropertiesConfig {
  title: string
  type?: 'camera' | 'group' | string
  schema: ConfigControlsSchema
  getValue: (path: string) => unknown
  updateValue: (path: string, value: unknown) => void
}

export const useElementPropertiesStore = defineStore('elementProperties', () => {
  const selectedElementName = ref<string | null>(null)
  const elementPropertiesRegistry = ref<Record<string, ElementPropertiesConfig>>({})
  /** Bumped on each external selection request (e.g. clicking an element in the
   *  3D scene) so the Elements panel can react even if selectedElementName is
   *  unchanged. */
  const selectionRequestNonce = ref(0)

  const activeProperties = computed<ElementPropertiesConfig | null>(() => {
    if (selectedElementName.value === null) return null
    return (
      elementPropertiesRegistry.value[selectedElementName.value] ?? {
        title: selectedElementName.value,
        schema: {},
        getValue: () => undefined,
        updateValue: () => {}
      }
    )
  })

  const registerElementProperties = (name: string, config: ElementPropertiesConfig) => {
    elementPropertiesRegistry.value = { ...elementPropertiesRegistry.value, [name]: config }
  }

  const unregisterElementProperties = (name: string) => {
    const { [name]: _removed, ...rest } = elementPropertiesRegistry.value
    elementPropertiesRegistry.value = rest
    if (selectedElementName.value === name) {
      selectedElementName.value = null
    }
  }

  const clearAllElementProperties = () => {
    elementPropertiesRegistry.value = {}
    selectedElementName.value = null
  }

  const openElementProperties = (name: string) => {
    selectedElementName.value = name
  }

  /** Request that the Elements panel select and expand a named element,
   *  e.g. from a click in the 3D scene. */
  const requestElementSelection = (name: string) => {
    selectedElementName.value = name
    selectionRequestNonce.value += 1
  }

  return {
    selectedElementName,
    selectionRequestNonce,
    activeProperties,
    registerElementProperties,
    unregisterElementProperties,
    clearAllElementProperties,
    openElementProperties,
    requestElementSelection
  }
})
