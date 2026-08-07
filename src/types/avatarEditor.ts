import type { StickmanPartName, StickmanPartOffset } from '@/types/stickmanRig'

/**
 * Everything the avatar editor's config panel drives: how solid the rig is,
 * whether the drawing guide shows over it, and where each limb sits.
 *
 * The material is fixed rather than configurable — this view is for authoring a
 * character, not for comparing material types — and the painted textures live
 * on their own offscreen canvases, persisted separately, since a data URL per
 * slot has no business round-tripping through a panel control.
 */
export type AvatarEditorConfig = {
  /** Fades the rig without hiding what is painted on it. */
  opacity: number
  /** Shows the body template over the colour map, without painting it in. */
  showGuide: boolean
  parts: Record<StickmanPartName, StickmanPartOffset>
}
