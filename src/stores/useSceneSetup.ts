import { ref, type Ref, onBeforeUnmount } from 'vue'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { getNestedValue, setNestedValueImmutable } from '@/utils/nestedObjects'

export interface SceneElementDefinition {
  title?: string
  type?: string
  schema: ConfigControlsSchema
  initialValues: Record<string, unknown>
  onUpdate?: (path: string, value: unknown) => void
}

export const useSceneSetup = (
  elementDefinitions: Record<string, SceneElementDefinition>
): Record<string, Ref<Record<string, unknown>>> => {
  const store = useElementPropertiesStore()

  const configReferences: Record<string, Ref<Record<string, unknown>>> = Object.fromEntries(
    Object.entries(elementDefinitions).map(([name, definition]) => [
      name,
      ref(JSON.parse(JSON.stringify(definition.initialValues)) as Record<string, unknown>)
    ])
  )

  Object.entries(elementDefinitions).forEach(([name, definition]) => {
    const configReference = configReferences[name]
    store.registerElementProperties(name, {
      title: definition.title ?? name,
      type: definition.type,
      schema: definition.schema,
      getValue: (path) => getNestedValue(configReference.value, path),
      updateValue: (path, value) => {
        configReference.value = setNestedValueImmutable(configReference.value, path, value)
        definition.onUpdate?.(path, value)
      }
    })
  })

  onBeforeUnmount(() => store.clearAllElementProperties())

  return configReferences
}
