import { reactive, watch } from 'vue'
import type { StickmanConfig, StickmanPartName, StickmanPartOffset } from '../types'
import { STICKMAN_SCALE, STICKMAN_ARM_SPREAD } from '../config'
import {
  DEFAULT_STICKMAN_SKIN,
  stickmanSkinById,
  stickmanSkinOptions
} from '../elements/stickmanSkins'

/** Every limb the rig exposes a rest transform for, in panel order. */
export const STICKMAN_PART_NAMES: StickmanPartName[] = [
  'head',
  'torso',
  'armLeft',
  'armRight',
  'legs'
]

/** One part's nudge: an offset from its own rest position, plus a size multiplier. */
const PART_OFFSET_CONTROLS = {
  x: { min: -1, max: 1, step: 0.01, label: 'X' },
  y: { min: -1, max: 1, step: 0.01, label: 'Y' },
  z: { min: -1, max: 1, step: 0.01, label: 'Z' },
  scale: { min: 0.2, max: 3, step: 0.05, label: 'Size' }
}

/**
 * The stickman's tunables. There is no physics preset here the way the rock
 * has one: the stickman rides the rock's own sphere collider and never
 * simulates anything of its own, so every property here is purely how it
 * looks riding that sphere.
 *
 * Scale multiplies the player's own shared Size (radius) rather than
 * replacing it, so resizing the player from either panel moves whichever
 * body is visible. Ground offset is a small manual nudge on top of the
 * automatic standoff already computed from the rig's own geometry — not the
 * whole offset, just a fine-tune. Skin picks from the catalogue; Texture
 * stays for uploading something outside it. Parts nudges one limb's
 * position and size at a time, on top of the rig's own rest pose — useful
 * for closing a gap a texture reveals, like a shoulder that doesn't quite
 * reach an arm spread further out.
 *
 * Merged into the rock's own "Player" panel entry rather than a row of its
 * own — the two are one player wearing two different looks, not two
 * separate things to tune — and included only when a stickman is actually
 * the one riding the sphere.
 */
export const RR_STICKMAN_CONTROLS = {
  skin: { options: stickmanSkinOptions(), label: 'Skin' },
  scale: { min: 0.5, max: 5, step: 0.1, label: 'Scale' },
  groundOffset: { min: -2, max: 2, step: 0.05, label: 'Ground offset' },
  opacity: { min: 0, max: 1, step: 0.05, label: 'Opacity', sectionStart: true },
  texture: { file: 'image/*', label: 'Texture' },
  parts: Object.fromEntries(STICKMAN_PART_NAMES.map((name) => [name, PART_OFFSET_CONTROLS]))
}

const defaultPartOffset = (): StickmanPartOffset => ({ x: 0, y: 0, z: 0, scale: 1 })

/**
 * Builds the stickman's reactive cosmetic config, read live by the run loop
 * every frame the same way the rock's own drive/steering figures are — a
 * change is felt on the very next frame with nothing to push it onto, since
 * there is no physics body of its own to update.
 *
 * Skin and Texture both end up on the same `texture` field the run loop
 * actually reads: picking a skin resolves its catalogue URL onto it, and a
 * raw upload overwrites it directly. Watched here, not read straight from
 * `skin` at the call site, so it applies the same way from either panel.
 * @param initialSkin - Skin id to start from, e.g. one already picked in the lobby
 * @returns A fresh reactive config, ready to be merged into the rock's panel
 */
export const createStickmanConfig = (
  initialSkin: string = DEFAULT_STICKMAN_SKIN
): StickmanConfig => {
  const startSkin = stickmanSkinById(initialSkin)
  const config = reactive<StickmanConfig>({
    scale: STICKMAN_SCALE,
    groundOffset: 0,
    opacity: 1,
    skin: startSkin.id,
    texture: startSkin.textureUrl,
    parts: {
      head: defaultPartOffset(),
      torso: defaultPartOffset(),
      // Tucked in at x: 0, which reads as cramped and leaves a texture no
      // room to tell the arm's silhouette apart from the torso's own — so
      // these start already spread, not at the rig's own bare rest pose.
      armLeft: { ...defaultPartOffset(), x: -STICKMAN_ARM_SPREAD },
      armRight: { ...defaultPartOffset(), x: STICKMAN_ARM_SPREAD },
      legs: defaultPartOffset()
    }
  })
  watch(
    () => config.skin,
    (id) => {
      config.texture = stickmanSkinById(id).textureUrl
    }
  )
  return config
}
