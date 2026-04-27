import type { ConfigControlsSchema } from '@/stores/viewConfig'
import type {
  MaterialTypeName,
  MapToggleKey,
  MaterialFeatureMap,
  MaterialsListConfig
} from './types'

export type { MaterialTypeName, MapToggleKey, MaterialFeatureMap, MaterialsListConfig }

export const MATERIAL_TYPES: MaterialTypeName[] = [
  'MeshBasicMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshStandardMaterial',
  'MeshPhysicalMaterial',
  'MeshToonMaterial',
  'MeshNormalMaterial',
  'MeshDepthMaterial'
]

export const MAIN_MATERIAL_TYPES: MaterialTypeName[] = [
  'MeshBasicMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshStandardMaterial',
  'MeshPhysicalMaterial'
]

export const SPECIAL_MATERIAL_TYPES: MaterialTypeName[] = [
  'MeshToonMaterial',
  'MeshNormalMaterial',
  'MeshDepthMaterial'
]

export const MATERIAL_LABELS: Record<MaterialTypeName, string> = {
  MeshBasicMaterial: 'Basic',
  MeshLambertMaterial: 'Lambert',
  MeshPhongMaterial: 'Phong',
  MeshStandardMaterial: 'Standard',
  MeshPhysicalMaterial: 'Physical',
  MeshToonMaterial: 'Toon',
  MeshNormalMaterial: 'Normal',
  MeshDepthMaterial: 'Depth'
}

export const MATERIAL_DESCRIPTIONS: Record<MaterialTypeName, string> = {
  MeshBasicMaterial: 'Diffuse\nAO\nenv map',
  MeshLambertMaterial: 'normal\nemissive',
  MeshPhongMaterial: 'displacement\nspecular',
  MeshStandardMaterial: 'roughness\nmetalness',
  MeshPhysicalMaterial: 'clearcoat\nsheen\ntransmission',
  MeshToonMaterial: 'Cel-shading\nvariant',
  MeshNormalMaterial: 'Debug:\nnormals as color',
  MeshDepthMaterial: 'Debug:\ndepth as shade'
}

export const MATERIAL_PROPERTIES: Record<MaterialTypeName, string> = {
  MeshBasicMaterial: '{\n  color: Color\n  map: Texture\n  aoMap: Texture\n  envMap: Texture\n}',
  MeshLambertMaterial: '{\n  normalMap: Texture\n  emissiveMap: Texture\n}',
  MeshPhongMaterial: '{\n  displacementMap: Texture\n  shininess: number\n}',
  MeshStandardMaterial: '{\n  roughness: number\n  metalness: number\n}',
  MeshPhysicalMaterial: '{\n  clearcoat: number\n  transmission: number\n}',
  MeshToonMaterial: '{\n  gradientMap: Texture\n}',
  MeshNormalMaterial: '{\n  normalMap: Texture\n  flatShading: boolean\n}',
  MeshDepthMaterial: '{\n  displacementMap: Texture\n  depthPacking: number\n}'
}

export const MATERIAL_FEATURES: MaterialFeatureMap = {
  MeshBasicMaterial: ['diffuse', 'ao', 'envMap'],
  MeshLambertMaterial: ['diffuse', 'normal', 'ao', 'emissive', 'envMap'],
  MeshPhongMaterial: ['diffuse', 'normal', 'ao', 'displacement', 'emissive', 'envMap'],
  MeshStandardMaterial: [
    'diffuse',
    'normal',
    'roughness',
    'metalness',
    'ao',
    'displacement',
    'emissive',
    'envMap'
  ],
  MeshPhysicalMaterial: [
    'diffuse',
    'normal',
    'roughness',
    'metalness',
    'ao',
    'displacement',
    'emissive',
    'envMap'
  ],
  MeshToonMaterial: ['diffuse', 'normal', 'ao', 'emissive'],
  MeshNormalMaterial: ['normal', 'displacement'],
  MeshDepthMaterial: ['displacement']
}

export const SPHERE_SEGMENT_COUNT = 64
export const SPHERE_RADIUS = 0.56
export const WAVE_WIDTH = 17
export const WAVE_HALF_WIDTH = WAVE_WIDTH / 2
export const WAVE_AMPLITUDE = 2.5
export const WAVE_CYCLES = 1.5
export const WAVE_SEGMENTS = 200
export const WAVE_COLOR = 0xffffff
export const WAVE_TUBE_RADIUS = 0.02
export const WAVE_TUBE_RADIAL_SEGMENTS = 8
export const WAVE_DASH_COUNT = 30
export const WAVE_DASH_DUTY = 0.55
export const TEXT_COLOR_LABEL = '#ffffff'
export const TEXT_COLOR_DESCRIPTION = '#ffdd55'
export const TEXT_COLOR_PROPERTIES = '#88aaff'
export const TEXT_COLOR_VALUE = '#ffffff'
export const PROCEDURAL_TEXTURE_SIZE = 512
export const DISPLACEMENT_SCALE = 0.25
export const NORMAL_STRENGTH = 2
export const TARGET_FPS = 60
export const LIGHT_ORBIT_SPEED = 0.3
export const LIGHT_ORBIT_RADIUS = 5
export const LIGHT_Z_POSITION = 7
export const EMISSIVE_COLOR = 0xff6600
export const EMISSIVE_INTENSITY = 1.5
export const CLEARCOAT_VALUE = 0.8
export const CLEARCOAT_ROUGHNESS_VALUE = 0.1
export const PHONG_SHININESS = 100
export const ENV_MAP_INTENSITY = 1
export const ENV_MAP_REFLECTIVITY = 0.6
export const ENV_GROUND_SIZE = 200
export const ENV_GROUND_Y = -2
export const ENV_LIGHT_INTENSITY = 2
export const ENV_LIGHT_POSITION = 5
export const ENV_LIGHT_Y = 10
export const ENV_AMBIENT_COLOR = 0x88aacc
export const ENV_AMBIENT_INTENSITY = 0.5
export const ENV_SKY_COLOR = 0x87ceeb
export const ENV_GROUND_COLOR = 0x556644
export const SCENE_BG_COLOR = 0x1a1a2e
export const GROUND_WIDTH = 50
export const GROUND_DEPTH = 30
export const GROUND_COLOR = 0x1e1e2e
export const GROUND_ROTATION_X = 0
export const GROUND_BACKGROUND_Y = 0
export const GROUND_BACKGROUND_Z = -0.8
export const LIGHT_INTENSITY = 3
export const HEMISPHERE_SKY = 0xddeeff
export const HEMISPHERE_GROUND = 0x222233
export const MATERIAL_COLOR = 0xcc8866
export const LIGHT_POSITION_XZ = 5
export const ENV_LIGHT_COLOR = 0xffffff

export const ORTHO_NEAR_PLANE = 0.1
export const ORTHO_FAR_PLANE = 100
export const ORTHO_FRUSTUM_HALF_HEIGHT = 8.0
export const WAVE_Y_OFFSET = -1.0
export const ORTHO_CAMERA_DISTANCE = 20

export const SPECIAL_COLUMN_X = 13.5
export const SPECIAL_COLUMN_Y_START = 2.5
export const SPECIAL_COLUMN_Y_SPACING = 3.5
export const SPECIAL_DEBUG_TITLE_Y = 4.0
export const SPECIAL_DEBUG_TITLE = 'Debug'

export const LEGEND_TITLE = 'Legend'
export const LEGEND_TITLE_Y = -4.5
export const LEGEND_SWATCH_Y = -5.5
export const LEGEND_SWATCH_SIZE = 1.2
export const LEGEND_SWATCH_SPACING = 2.8
export const LEGEND_PROPS_Y = -7.2
export const LEGEND_PROPERTIES_TEXT =
  'wireframe: edges only  ·  roughness: micro-scatter (0–1)  ·  metalness: conductor model (0–1)'

export const LABEL_FONT_SIZE = 72
export const DESCRIPTION_FONT_SIZE = 50
export const PROPERTIES_FONT_SIZE = 46
export const LABEL_CANVAS_WIDTH = 1024
export const LABEL_CANVAS_HEIGHT = 80
export const LABEL_SPRITE_SCALE_X = 3.5
export const LABEL_SPRITE_SCALE_Y = 0.55
export const DESCRIPTION_SPRITE_SCALE_X = 3.8
export const DESCRIPTION_SPRITE_SCALE_Y = 0.5
export const PROPERTIES_SPRITE_SCALE_X = 3.8
export const PROPERTIES_SPRITE_SCALE_Y = 0.45

// Spacing unit derived from description scale — all Y gaps scale with it automatically
export const TEXT_Y_STEP = DESCRIPTION_SPRITE_SCALE_Y

export const LABEL_Y_OFFSET = SPHERE_RADIUS + TEXT_Y_STEP
export const DESCRIPTION_Y_OFFSET = LABEL_Y_OFFSET + TEXT_Y_STEP * 2
export const PROPERTIES_Y_OFFSET = DESCRIPTION_Y_OFFSET + TEXT_Y_STEP * 2

export const SPECIAL_LABEL_Y_OFFSET = SPHERE_RADIUS + TEXT_Y_STEP
export const SPECIAL_DESCRIPTION_Y_OFFSET = SPECIAL_LABEL_Y_OFFSET + TEXT_Y_STEP
export const SPECIAL_PROPERTIES_Y_OFFSET = SPECIAL_DESCRIPTION_Y_OFFSET + TEXT_Y_STEP * 2

export const LEGEND_LABEL_Y_OFFSET = TEXT_Y_STEP * 2

export const LEGEND_FONT_SIZE_TITLE = 44
export const LEGEND_SCALE_TITLE = 0.75
export const LEGEND_FONT_SIZE_LABEL = 34
export const LEGEND_SCALE_LABEL = 0.55
export const LEGEND_LABEL_CANVAS_WIDTH = 256
export const LEGEND_FONT_SIZE_PROPS = 32
export const LEGEND_SCALE_PROPS = 0.55
export const AMBIENT_LIGHT_INTENSITY = 1.5

export const BRICK_WIDTH = 64
export const BRICK_HEIGHT = 32
export const MORTAR_SIZE = 3
export const MORTAR_EDGE_OFFSET = 3
export const MORTAR_EDGE_SIZE = 4

export const DEFAULT_CONFIG: MaterialsListConfig = {
  properties: {
    wireframe: false,
    roughness: 0.5,
    metalness: 0.5
  },
  maps: {
    diffuse: true,
    normal: true,
    roughnessMap: true,
    metalnessMap: true,
    ao: true,
    displacement: false,
    emissive: false,
    envMapEnabled: true
  }
}

export const CONFIG_SCHEMA: ConfigControlsSchema = {
  properties: {
    wireframe: { checkbox: true },
    roughness: { min: 0, max: 1, step: 0.01 },
    metalness: { min: 0, max: 1, step: 0.01 }
  },
  maps: {
    diffuse: { checkbox: true },
    normal: { checkbox: true },
    roughnessMap: { checkbox: true, label: 'roughness map' },
    metalnessMap: { checkbox: true, label: 'metalness map' },
    ao: { checkbox: true, label: 'ambient occlusion' },
    displacement: { checkbox: true },
    emissive: { checkbox: true },
    envMapEnabled: { checkbox: true, label: 'environment map' }
  }
}

/**
 * Map config booleans to MapToggleKey record for material building.
 * @param materialsConfig - The current config state.
 * @returns A record of MapToggleKey to enabled state.
 */
export const getEnabledMaps = (
  materialsConfig: MaterialsListConfig
): Record<MapToggleKey, boolean> => ({
  diffuse: materialsConfig.maps.diffuse,
  normal: materialsConfig.maps.normal,
  roughness: materialsConfig.maps.roughnessMap,
  metalness: materialsConfig.maps.metalnessMap,
  ao: materialsConfig.maps.ao,
  displacement: materialsConfig.maps.displacement,
  emissive: materialsConfig.maps.emissive,
  envMap: materialsConfig.maps.envMapEnabled
})
