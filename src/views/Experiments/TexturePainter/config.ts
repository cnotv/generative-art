export {
  MATERIAL_TYPES,
  MAIN_MATERIAL_TYPES,
  MATERIAL_LABELS,
  MATERIAL_FEATURES,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA,
  getEnabledMaps,
  SPHERE_SEGMENT_COUNT,
  PROCEDURAL_TEXTURE_SIZE,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  MORTAR_SIZE,
  MORTAR_EDGE_OFFSET,
  MORTAR_EDGE_SIZE,
  SCENE_BG_COLOR,
  LIGHT_INTENSITY,
  AMBIENT_LIGHT_INTENSITY,
  HEMISPHERE_SKY,
  HEMISPHERE_GROUND,
  LIGHT_ORBIT_RADIUS,
  LIGHT_Z_POSITION,
  ENV_SKY_COLOR,
  ENV_GROUND_COLOR,
  ENV_GROUND_SIZE,
  ENV_GROUND_Y,
  ENV_LIGHT_INTENSITY,
  ENV_LIGHT_POSITION,
  ENV_LIGHT_Y,
  ENV_AMBIENT_COLOR,
  ENV_AMBIENT_INTENSITY,
  ENV_LIGHT_COLOR
} from '@/views/Experiments/MaterialsList/materialsListConfig'

export type { MaterialTypeName, MaterialsListConfig } from '@/views/Experiments/MaterialsList/types'

export const PAINTER_SPHERE_RADIUS = 2.5
export const PAINTER_SPHERE_SEGMENTS = 64
export const PAINTER_CANVAS_SIZE = 512
export const PAINTER_LIGHT_ORBIT_SPEED = 0.3
export const PAINTER_TARGET_FPS = 60
export const PAINTER_ORTHO_FRUSTUM = 5.0
export const PAINTER_ORTHO_NEAR = 0.1
export const PAINTER_ORTHO_FAR = 100
export const PAINTER_ORTHO_DISTANCE = 20

export const STORAGE_PREFIX = 'texture-painter'

export type TextureSlotKey = 'diffuse' | 'normal' | 'roughness' | 'ao' | 'displacement' | 'emissive'

export const TEXTURE_SLOTS: TextureSlotKey[] = [
  'diffuse',
  'normal',
  'roughness',
  'ao',
  'displacement',
  'emissive'
]

export const TEXTURE_SLOT_LABELS: Record<TextureSlotKey, string> = {
  diffuse: 'Diffuse',
  normal: 'Normal',
  roughness: 'Roughness',
  ao: 'Ambient Occlusion',
  displacement: 'Displacement',
  emissive: 'Emissive'
}

export const TEXTURE_SLOT_PALETTE: Record<TextureSlotKey, string[]> = {
  diffuse: ['#cc8866', '#884433', '#ffffff', '#000000'],
  normal: ['#8080ff', '#404080', '#ffffff'],
  roughness: ['#ffffff', '#000000', '#888888'],
  ao: ['#ffffff', '#000000', 'rgba(0,0,0,0.4)'],
  displacement: ['#cccccc', '#000000', '#ffffff'],
  emissive: ['#ff6600', '#000000', '#ff3300']
}

export const TEXTURE_SLOT_DEFAULT_COLOR: Record<TextureSlotKey, string> = {
  diffuse: '#cc8866',
  normal: '#8080ff',
  roughness: '#ffffff',
  ao: '#ffffff',
  displacement: '#cccccc',
  emissive: '#ff6600'
}
