export type MaterialTypeName =
  | 'MeshBasicMaterial'
  | 'MeshLambertMaterial'
  | 'MeshPhongMaterial'
  | 'MeshStandardMaterial'
  | 'MeshPhysicalMaterial'
  | 'MeshToonMaterial'
  | 'MeshNormalMaterial'
  | 'MeshDepthMaterial'

export type MapToggleKey =
  | 'diffuse'
  | 'normal'
  | 'roughness'
  | 'metalness'
  | 'ao'
  | 'displacement'
  | 'emissive'
  | 'envMap'

export type MaterialFeatureMap = Record<MaterialTypeName, MapToggleKey[]>

export type AttributeKey =
  | 'color'
  | 'map'
  | 'normalMap'
  | 'roughness'
  | 'roughnessMap'
  | 'metalness'
  | 'metalnessMap'
  | 'aoMap'
  | 'displacementMap'
  | 'emissiveMap'
  | 'envMap'
  | 'shininess'
  | 'clearcoat'
  | 'transmission'
  | 'gradientMap'
  | 'flatShading'
  | 'depthPacking'
  | 'wireframe'

export type MaterialsListConfig = {
  properties: {
    wireframe: boolean
    roughness: number
    metalness: number
  }
  maps: {
    diffuse: boolean
    normal: boolean
    roughnessMap: boolean
    metalnessMap: boolean
    ao: boolean
    displacement: boolean
    emissive: boolean
    envMapEnabled: boolean
  }
}
