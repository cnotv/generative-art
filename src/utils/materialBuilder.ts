import * as THREE from 'three'
import type {
  MaterialTypeName,
  MapToggleKey,
  MaterialsListConfig
} from '@/views/Experiments/MaterialsList/types'
import {
  EMISSIVE_COLOR,
  EMISSIVE_INTENSITY,
  CLEARCOAT_ROUGHNESS_VALUE,
  ENV_MAP_INTENSITY,
  ENV_MAP_REFLECTIVITY,
  NORMAL_STRENGTH,
  DISPLACEMENT_SCALE,
  MATERIAL_COLOR
} from '@/views/Experiments/MaterialsList/materialsListConfig'

export interface BuildMaterialScene {
  textures: Record<string, THREE.Texture>
  envMap: THREE.Texture | null
}

const MATERIAL_CONSTRUCTORS: Record<MaterialTypeName, new (p: never) => THREE.Material> = {
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshLambertMaterial: THREE.MeshLambertMaterial,
  MeshPhongMaterial: THREE.MeshPhongMaterial,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
  MeshToonMaterial: THREE.MeshToonMaterial,
  MeshNormalMaterial: THREE.MeshNormalMaterial,
  MeshDepthMaterial: THREE.MeshDepthMaterial
}

const applyTextureParameters = (
  parameters: Record<string, unknown>,
  hasFeature: (key: MapToggleKey) => boolean,
  textures: Record<string, THREE.Texture>
): void => {
  if (hasFeature('diffuse')) parameters.map = textures.diffuse
  if (hasFeature('normal')) {
    parameters.normalMap = textures.normal
    parameters.normalScale = new THREE.Vector2(NORMAL_STRENGTH, NORMAL_STRENGTH)
  }
  if (hasFeature('roughness')) parameters.roughnessMap = textures.roughness
  if (hasFeature('metalness')) parameters.metalnessMap = textures.roughness
  if (hasFeature('ao')) {
    parameters.aoMap = textures.ao
    parameters.aoMapIntensity = 1
  }
  if (hasFeature('displacement')) {
    parameters.displacementMap = textures.displacement
    parameters.displacementScale = DISPLACEMENT_SCALE
  }
}

interface ApplyContext {
  typeName: MaterialTypeName
  hasFeature: (key: MapToggleKey) => boolean
  textures: Record<string, THREE.Texture>
  configValues: MaterialsListConfig
  envMap: THREE.Texture | null
}

const applyMaterialTypeParameters = (
  parameters: Record<string, unknown>,
  { typeName, hasFeature, textures, configValues, envMap }: ApplyContext
): void => {
  if (hasFeature('emissive') && typeName !== 'MeshBasicMaterial') {
    parameters.emissiveMap = textures.emissive
    parameters.emissive = new THREE.Color(EMISSIVE_COLOR)
    parameters.emissiveIntensity = EMISSIVE_INTENSITY
  }
  if (hasFeature('envMap') && envMap) {
    const isPbr = ['MeshStandardMaterial', 'MeshPhysicalMaterial'].includes(typeName)
    parameters.envMap = envMap
    if (isPbr) {
      parameters.envMapIntensity = ENV_MAP_INTENSITY
    } else {
      parameters.combine = THREE.AddOperation
      parameters.reflectivity = ENV_MAP_REFLECTIVITY
    }
  }
  if (['MeshStandardMaterial', 'MeshPhysicalMaterial'].includes(typeName)) {
    parameters.roughness = configValues.properties.roughness
    parameters.metalness = configValues.properties.metalness
  }
  if (typeName === 'MeshPhysicalMaterial') {
    parameters.clearcoat = configValues.properties.clearcoat
    parameters.clearcoatRoughness = CLEARCOAT_ROUGHNESS_VALUE
    parameters.transmission = configValues.properties.transmission
  }
  if (typeName === 'MeshPhongMaterial') parameters.shininess = configValues.properties.shininess
  if (typeName === 'MeshNormalMaterial')
    parameters.flatShading = configValues.properties.flatShading
}

/**
 * Build a Three.js material from type, enabled maps, config values, and scene resources.
 * @param typeName - Material type identifier
 * @param supported - Map keys this material type supports
 * @param maps - Which maps are currently enabled
 * @param configValues - Property values (roughness, metalness, etc.)
 * @param scene - Scene resources containing textures and envMap
 * @returns Constructed Three.js material
 */
export const buildMaterial = (
  typeName: MaterialTypeName,
  supported: MapToggleKey[],
  maps: Record<MapToggleKey, boolean>,
  configValues: MaterialsListConfig,
  scene: BuildMaterialScene
): THREE.Material => {
  const { textures, envMap } = scene
  const hasFeature = (key: MapToggleKey): boolean => supported.includes(key) && maps[key]
  const parameters: Record<string, unknown> = {}

  if (!['MeshNormalMaterial', 'MeshDepthMaterial'].includes(typeName)) {
    parameters.color = MATERIAL_COLOR
  }
  applyTextureParameters(parameters, hasFeature, textures)
  applyMaterialTypeParameters(parameters, { typeName, hasFeature, textures, configValues, envMap })

  const Constructor = MATERIAL_CONSTRUCTORS[typeName]
  const material = new Constructor(parameters as never)
  ;(material as THREE.MeshBasicMaterial).wireframe = configValues.properties.wireframe
  return material
}
