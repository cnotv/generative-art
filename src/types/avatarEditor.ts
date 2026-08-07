import type { StickmanPartName, StickmanPartOffset } from '@/types/stickmanRig'

/**
 * Everything the avatar editor's config panel drives: whether the rig is shown
 * at all, and where each limb sits.
 *
 * The material is fixed rather than configurable — this view is for authoring a
 * character, not for comparing material types — and the painted textures live
 * on their own offscreen canvases, persisted separately, since a data URL per
 * slot has no business round-tripping through a panel control.
 */
export type AvatarEditorConfig = {
  visible: boolean
  parts: Record<StickmanPartName, StickmanPartOffset>
}
