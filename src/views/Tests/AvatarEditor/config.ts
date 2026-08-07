import {
  MAIN_MATERIAL_TYPES,
  MATERIAL_LABELS,
  CONFIG_SCHEMA
} from '@/views/Tests/MaterialsList/materialsListConfig'
import type { MaterialTypeName } from '@/views/Tests/MaterialsList/types'
import { STICKMAN_PART_NAMES, STICKMAN_PART_OFFSET_CONTROLS } from '@/utils/stickmanRig'
import type { AvatarMapStrengths } from '@/types/avatarEditor'

export const DEFAULT_MATERIAL_TYPE: MaterialTypeName = 'MeshStandardMaterial'

/**
 * Displacement starts at zero rather than at the strength the material
 * showcase uses: the rig is a handful of low-poly limbs, so a displacement
 * map has almost no vertices to push and mostly just tears the silhouette.
 * It stays available for anyone who wants it, just not on by default.
 */
export const DEFAULT_MAP_STRENGTHS: AvatarMapStrengths = {
  normalScale: 1,
  aoIntensity: 1,
  displacementScale: 0,
  emissiveIntensity: 1,
  envMapIntensity: 1
}

export const AVATAR_CONFIG_CONTROLS = {
  __defaultOpenGroups: ['parts'] as string[],
  materialType: {
    label: 'Material',
    component: 'ButtonSelector' as const,
    options: MAIN_MATERIAL_TYPES.map((type) => ({ value: type, label: MATERIAL_LABELS[type] }))
  },
  strengths: {
    normalScale: { min: 0, max: 5, step: 0.1, label: 'Normal Scale' },
    aoIntensity: { min: 0, max: 2, step: 0.05, label: 'AO Intensity' },
    displacementScale: { min: 0, max: 2, step: 0.01, label: 'Displacement Scale' },
    emissiveIntensity: { min: 0, max: 5, step: 0.1, label: 'Emissive Intensity' },
    envMapIntensity: { min: 0, max: 3, step: 0.1, label: 'Env Map Intensity' }
  },
  materials: {
    properties: CONFIG_SCHEMA.properties,
    maps: CONFIG_SCHEMA.maps
  },
  parts: Object.fromEntries(
    STICKMAN_PART_NAMES.map((name) => [name, STICKMAN_PART_OFFSET_CONTROLS])
  )
}
