export const AVATAR_MODEL_PATH = 'stickboy.glb'

export const AVATAR_CANVAS_SIZE = 512

/**
 * Padding around the rig when the camera frames it, as a fraction of its
 * height. Generous enough that the rig sits as a figure being worked on with
 * room around it, and that a limb scaled well past its rest size still has
 * somewhere to grow into instead of running straight off frame.
 */
export const AVATAR_FRAME_PADDING = 0.6
export const AVATAR_ORTHO_NEAR = 0.1
export const AVATAR_ORTHO_FAR = 100
export const AVATAR_ORTHO_DISTANCE = 20

export const AVATAR_DRAG_SENSITIVITY = 0.008
export const AVATAR_BRUSH_SIZE_DEFAULT = 12
export const AVATAR_HISTORY_LIMIT = 20

/** The clip name the rig ships its walk cycle under. */
export const AVATAR_WALK_ACTION = 'walk'
/** Playback rate for the walk cycle, in the units updateAnimation scales by. */
export const AVATAR_WALK_SPEED = 10

/**
 * The material is fixed rather than exposed: this view authors one character,
 * so the only thing worth varying is what is painted into the maps, not which
 * material type is showing them. Standard covers every map the painter offers.
 */
export const AVATAR_MATERIAL_TYPE = 'MeshStandardMaterial' as const

/**
 * Displacement stays at zero: the rig is a handful of low-poly limbs, so a
 * displacement map has almost no vertices to push and mostly just tears the
 * silhouette. The slot is still paintable, it simply has nothing to move here.
 */
export const AVATAR_MAP_STRENGTHS = {
  normalScale: 1,
  aoIntensity: 1,
  displacementScale: 0,
  emissiveIntensity: 1,
  envMapIntensity: 1
}

/** Alpha below this is cut away, so the template's margin reads as empty, not as a slab. */
export const AVATAR_ALPHA_TEST = 0.5

export const STORAGE_PREFIX = 'avatar-editor'

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

/**
 * The flat value each map starts at, painted over the whole canvas.
 *
 * Every one is the map's own no-op: a normal pointing straight out, fully
 * rough, unoccluded, undisplaced, unlit. The rig then looks exactly like its
 * untextured self until something is actually painted, rather than arriving
 * pre-dented by a procedural pattern that has nothing to do with an avatar.
 * Diffuse is the exception — it starts as the draw template, so there is a
 * body outline to paint inside of.
 */
export const TEXTURE_SLOT_BASE_COLOR: Record<TextureSlotKey, string> = {
  diffuse: '#ffffff',
  normal: '#8080ff',
  roughness: '#ffffff',
  ao: '#ffffff',
  displacement: '#000000',
  emissive: '#000000'
}

export const TEXTURE_SLOT_PALETTE: Record<TextureSlotKey, string[]> = {
  diffuse: ['#e8b48c', '#3b6ea5', '#c0392b', '#2d3436', '#f5f5f5', '#7f5a3a'],
  normal: ['#8080ff', '#404080', '#c0c0ff'],
  roughness: ['#ffffff', '#888888', '#000000'],
  ao: ['#ffffff', '#888888', '#000000'],
  displacement: ['#000000', '#888888', '#ffffff'],
  emissive: ['#ff6600', '#00ccff', '#000000']
}

export const TEXTURE_SLOT_DEFAULT_COLOR: Record<TextureSlotKey, string> = {
  diffuse: '#e8b48c',
  normal: '#8080ff',
  roughness: '#888888',
  ao: '#888888',
  displacement: '#888888',
  emissive: '#ff6600'
}
