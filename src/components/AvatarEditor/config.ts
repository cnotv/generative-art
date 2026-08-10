export const AVATAR_MODEL_PATH = 'stickboy.glb'

/**
 * The texture is two panels side by side, front then back, each square so the
 * body keeps its proportions rather than being squeezed into half a square.
 */
export const AVATAR_PANEL_SIZE = 512
export const AVATAR_PANEL_COUNT = 2
export const AVATAR_CANVAS_WIDTH = AVATAR_PANEL_SIZE * AVATAR_PANEL_COUNT
export const AVATAR_CANVAS_HEIGHT = AVATAR_PANEL_SIZE

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

/** Filename stem for a texture saved out of the painter. */
export const AVATAR_EXPORT_PREFIX = 'avatar-texture'

/**
 * Backs both the 3D scene and the page around it, from one value so the two
 * cannot drift apart — the controls sit beside the canvas rather than over it,
 * so any difference between them shows as a seam down the middle.
 */
export const AVATAR_BACKGROUND_COLOR = '#ffffff'

/**
 * Alpha at or below this is discarded outright rather than blended, so a body
 * faded to nothing stops writing depth and hiding the strokes behind it. Set
 * just above nothing, so every partial fade still blends normally.
 */
export const AVATAR_ALPHA_CUTOFF = 0.01

/** Marks the seam between the front and back panels on the guide. */
export const AVATAR_PANEL_DIVIDER_COLOR = 'rgba(0, 0, 0, 0.35)'

/**
 * Carries the sheet layout, because a saved drawing is only meaningful against
 * the one it was painted on — a single-panel texture restored onto the
 * two-panel sheet would be stretched across both halves rather than rejected.
 */
export const STORAGE_KEY = 'avatar-editor-split'

/**
 * The flat colour the sheet starts as, under anything drawn on it.
 *
 * The body template is deliberately not part of it: the guide is drawn over
 * the map at display time, never into it, so it can be turned off and never
 * lands in an exported texture.
 */
export const TEXTURE_BASE_COLOR = '#ffffff'

export const TEXTURE_PALETTE = ['#e8b48c', '#3b6ea5', '#c0392b', '#2d3436', '#f5f5f5', '#7f5a3a']

export const TEXTURE_DEFAULT_COLOR = TEXTURE_PALETTE[0]
