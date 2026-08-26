import * as THREE from 'three'

/** The scene children the Lights element speaks for, so they never get a row of their own. */
export const LIGHT_ELEMENT_NAMES: Set<string> = new Set([
  'ambient-light',
  'directional-light',
  'hemisphere-light',
  'point-light',
  'spot-light',
  'rect-area-light',
  'sky'
])

const asPanelPosition = (light: THREE.Object3D) => ({
  x: light.position.x,
  y: light.position.y,
  z: light.position.z
})

/**
 * Read the panel's light state off a scene that built its own lights, so a view that never
 * declared a SetupConfig still gets the same Lights element as one that did. Colours and
 * positions come from the objects themselves, in the shape the panel controls expect.
 * @param scene - The scene to read
 * @returns The lights config, and the sky config when the scene has a sky
 */
export const readLightsFromScene = (
  scene: THREE.Scene
): { lights: Record<string, unknown>; sky: Record<string, unknown> } => {
  const find = <T extends THREE.Object3D>(name: string): T | undefined =>
    scene.getObjectByName(name) as T | undefined

  const ambient = find<THREE.AmbientLight>('ambient-light')
  const directional = find<THREE.DirectionalLight>('directional-light')
  const hemisphere = find<THREE.HemisphereLight>('hemisphere-light')
  const point = find<THREE.PointLight>('point-light')
  const spot = find<THREE.SpotLight>('spot-light')
  const rectArea = find<THREE.RectAreaLight>('rect-area-light')
  const sky = find<THREE.Mesh>('sky')

  return {
    lights: {
      ...(ambient
        ? { ambient: { color: ambient.color.getHex(), intensity: ambient.intensity } }
        : {}),
      ...(directional
        ? {
            directional: {
              color: directional.color.getHex(),
              intensity: directional.intensity,
              position: asPanelPosition(directional)
            }
          }
        : {}),
      ...(hemisphere
        ? {
            hemisphere: {
              skyColor: hemisphere.color.getHex(),
              groundColor: hemisphere.groundColor.getHex(),
              intensity: hemisphere.intensity
            }
          }
        : {}),
      ...(point ? { point: { color: point.color.getHex(), intensity: point.intensity } } : {}),
      ...(spot ? { spot: { color: spot.color.getHex(), intensity: spot.intensity } } : {}),
      ...(rectArea
        ? { rectArea: { color: rectArea.color.getHex(), intensity: rectArea.intensity } }
        : {}),
      ...(scene.environment ? { environment: { intensity: scene.environmentIntensity } } : {})
    },
    sky:
      sky && sky.material instanceof THREE.MeshBasicMaterial
        ? { color: sky.material.color.getHex() }
        : {}
  }
}
