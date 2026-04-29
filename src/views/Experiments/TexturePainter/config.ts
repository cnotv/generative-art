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

export type PresetKey = 'glass' | 'metal' | 'rock' | 'magic' | 'cutout'

export const PRESET_LABELS: Record<PresetKey, string> = {
  glass: 'Glass',
  metal: 'Metal',
  rock: 'Rock',
  magic: 'Magic',
  cutout: 'Cutout'
}

export interface PresetValues {
  materialType: string
  properties: {
    wireframe: boolean
    roughness: number
    metalness: number
    shininess: number
    clearcoat: number
    transmission: number
    flatShading: boolean
  }
  strengths: {
    normalScale: number
    aoIntensity: number
    displacementScale: number
    emissiveIntensity: number
    envMapIntensity: number
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
    gradientMap: boolean
  }
}

export const PRESETS: Record<PresetKey, PresetValues> = {
  glass: {
    materialType: 'MeshPhysicalMaterial',
    properties: {
      wireframe: false,
      roughness: 0.0,
      metalness: 0,
      shininess: 300,
      clearcoat: 1,
      transmission: 0.95,
      flatShading: false
    },
    strengths: {
      normalScale: 0.3,
      aoIntensity: 0,
      displacementScale: 0,
      emissiveIntensity: 0,
      envMapIntensity: 2.5
    },
    maps: {
      diffuse: false,
      normal: true,
      roughnessMap: false,
      metalnessMap: false,
      ao: false,
      displacement: false,
      emissive: false,
      envMapEnabled: true,
      gradientMap: false
    }
  },
  metal: {
    materialType: 'MeshStandardMaterial',
    properties: {
      wireframe: false,
      roughness: 0.25,
      metalness: 1,
      shininess: 100,
      clearcoat: 0,
      transmission: 0,
      flatShading: false
    },
    strengths: {
      normalScale: 3,
      aoIntensity: 1,
      displacementScale: 0,
      emissiveIntensity: 0,
      envMapIntensity: 2
    },
    maps: {
      diffuse: true,
      normal: true,
      roughnessMap: true,
      metalnessMap: false,
      ao: true,
      displacement: false,
      emissive: false,
      envMapEnabled: true,
      gradientMap: false
    }
  },
  rock: {
    materialType: 'MeshStandardMaterial',
    properties: {
      wireframe: false,
      roughness: 0.9,
      metalness: 0,
      shininess: 10,
      clearcoat: 0,
      transmission: 0,
      flatShading: false
    },
    strengths: {
      normalScale: 5,
      aoIntensity: 1.5,
      displacementScale: 0.4,
      emissiveIntensity: 0,
      envMapIntensity: 0.2
    },
    maps: {
      diffuse: true,
      normal: true,
      roughnessMap: true,
      metalnessMap: false,
      ao: true,
      displacement: true,
      emissive: false,
      envMapEnabled: false,
      gradientMap: false
    }
  },
  magic: {
    materialType: 'MeshStandardMaterial',
    properties: {
      wireframe: false,
      roughness: 0.1,
      metalness: 0.2,
      shininess: 100,
      clearcoat: 0.8,
      transmission: 0,
      flatShading: false
    },
    strengths: {
      normalScale: 1,
      aoIntensity: 0,
      displacementScale: 0,
      emissiveIntensity: 4,
      envMapIntensity: 1
    },
    maps: {
      diffuse: true,
      normal: false,
      roughnessMap: false,
      metalnessMap: false,
      ao: false,
      displacement: false,
      emissive: true,
      envMapEnabled: true,
      gradientMap: false
    }
  },
  cutout: {
    materialType: 'MeshStandardMaterial',
    properties: {
      wireframe: false,
      roughness: 0.7,
      metalness: 0,
      shininess: 30,
      clearcoat: 0,
      transmission: 0,
      flatShading: true
    },
    strengths: {
      normalScale: 2,
      aoIntensity: 2,
      displacementScale: 0.8,
      emissiveIntensity: 0,
      envMapIntensity: 0.5
    },
    maps: {
      diffuse: true,
      normal: false,
      roughnessMap: false,
      metalnessMap: false,
      ao: true,
      displacement: true,
      emissive: false,
      envMapEnabled: true,
      gradientMap: false
    }
  }
}

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
