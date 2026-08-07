import type { MaterialTypeName, MaterialsListConfig } from '@/views/Tests/MaterialsList/types'
import type { StickmanPartName, StickmanPartOffset } from '@/types/stickmanRig'

/** How strongly each map is felt, independent of what is painted into it. */
export type AvatarMapStrengths = {
  normalScale: number
  aoIntensity: number
  displacementScale: number
  emissiveIntensity: number
  envMapIntensity: number
}

/**
 * Everything the avatar editor's config panel drives: which material the rig
 * wears, how strongly its painted maps read, and where each limb sits.
 *
 * The painted textures themselves are not here — they live on their own
 * offscreen canvases, persisted separately, since a data URL per slot has no
 * business round-tripping through a panel control.
 */
export type AvatarEditorConfig = {
  materialType: MaterialTypeName
  strengths: AvatarMapStrengths
  materials: MaterialsListConfig
  parts: Record<StickmanPartName, StickmanPartOffset>
}
