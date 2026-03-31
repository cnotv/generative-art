import { reactive } from 'vue'
import { useElementPropertiesStore } from '@/stores/elementProperties'

type LightObject = {
  color: { getHex: () => number; set: (value: number) => void }
  intensity: number
}

const lightSchema = {
  intensity: { min: 0, max: 10, step: 0.1, label: 'Intensity' },
  color: { color: true, label: 'Color' }
}

interface RegisterLightOptions {
  light: LightObject
  name: string
  title: string
  schema?: Record<string, unknown>
}

/**
 * Registers a single light's element properties for the properties panel.
 * Creates reactive state from current light values and syncs changes back to the Three.js light.
 *
 * @param options.light - The Three.js light object (must have color.getHex/set and intensity)
 * @param options.name - Unique element name for registration (e.g., 'ambient-light')
 * @param options.title - Display title in the properties panel
 * @param options.schema - Optional custom schema (defaults to intensity + color)
 */
export const registerLightProperties = ({
  light,
  name,
  title,
  schema
}: RegisterLightOptions): void => {
  const elementPropertiesStore = useElementPropertiesStore()
  const lightState = reactive({ intensity: light.intensity, color: light.color.getHex() })

  elementPropertiesStore.registerElementProperties(name, {
    title,
    schema: schema ?? lightSchema,
    getValue: (path: string) => (lightState as Record<string, unknown>)[path],
    updateValue: (path: string, value: unknown) => {
      ;(lightState as Record<string, unknown>)[path] = value
      if (path === 'color') light.color.set(value as number)
      else (light as Record<string, unknown>)[path] = value
    }
  })
}
