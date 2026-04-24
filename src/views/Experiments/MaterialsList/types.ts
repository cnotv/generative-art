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

export type MaterialsListConfig = {
  wireframe: boolean
  roughness: number
  metalness: number
  diffuse: boolean
  normal: boolean
  roughnessMap: boolean
  metalnessMap: boolean
  ao: boolean
  displacement: boolean
  emissive: boolean
  envMapEnabled: boolean
}
