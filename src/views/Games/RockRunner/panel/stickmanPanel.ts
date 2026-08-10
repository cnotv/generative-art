import { reactive, watch } from 'vue'
import type { StickmanConfig } from '../types'
import { STICKMAN_SCALE } from '../config'
import {
  STICKMAN_PART_NAMES,
  STICKMAN_PART_OFFSET_CONTROLS,
  createStickmanPartOffsets
} from '@/utils/stickmanRig'
import {
  DEFAULT_STICKMAN_SKIN,
  stickmanSkinById,
  stickmanSkinOptions
} from '../elements/stickmanSkins'

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
  parts: Object.fromEntries(
    STICKMAN_PART_NAMES.map((name) => [name, STICKMAN_PART_OFFSET_CONTROLS])
  )
}

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
    parts: createStickmanPartOffsets()
  })
  watch(
    () => config.skin,
    (id) => {
      config.texture = stickmanSkinById(id).textureUrl
    }
  )
  return config
}
