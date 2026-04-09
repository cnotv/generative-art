import * as THREE from 'three'
import { useElementPropertiesStore } from '@/stores/elementProperties'

const POSITION_STEP = 0.1
const ROTATION_STEP = 0.01

const objectSchema = {
  position: {
    x: { min: -1000, max: 1000, step: POSITION_STEP, label: 'X' },
    y: { min: -1000, max: 1000, step: POSITION_STEP, label: 'Y' },
    z: { min: -1000, max: 1000, step: POSITION_STEP, label: 'Z' }
  },
  rotation: {
    x: { min: -Math.PI, max: Math.PI, step: ROTATION_STEP, label: 'X' },
    y: { min: -Math.PI, max: Math.PI, step: ROTATION_STEP, label: 'Y' },
    z: { min: -Math.PI, max: Math.PI, step: ROTATION_STEP, label: 'Z' }
  }
}

const getObjectValue = (object: THREE.Object3D, path: string): unknown => {
  const [group, axis] = path.split('.')
  if (group === 'position') return object.position[axis as 'x' | 'y' | 'z']
  if (group === 'rotation') return object.rotation[axis as 'x' | 'y' | 'z']
  return undefined
}

const setObjectValue = (object: THREE.Object3D, path: string, value: unknown): void => {
  const [group, axis] = path.split('.')
  if (group === 'position') object.position[axis as 'x' | 'y' | 'z'] = value as number
  if (group === 'rotation') object.rotation[axis as 'x' | 'y' | 'z'] = value as number
}

interface RegisterObjectOptions {
  object: THREE.Object3D
  name: string
  title?: string
}

/**
 * Registers a Three.js object's position and rotation for the element properties panel.
 *
 * @param options.object - The Three.js Object3D to inspect and control
 * @param options.name - Unique element name for registration
 * @param options.title - Display title in the properties panel (defaults to name)
 */
export const registerObjectProperties = ({ object, name, title }: RegisterObjectOptions): void => {
  const store = useElementPropertiesStore()
  store.registerElementProperties(name, {
    title: title ?? name,
    schema: objectSchema,
    getValue: (path) => getObjectValue(object, path),
    updateValue: (path, value) => setObjectValue(object, path, value)
  })
}
