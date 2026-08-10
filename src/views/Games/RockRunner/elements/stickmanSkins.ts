import stickmanBackUrl from '@/assets/images/characters/stickman_back.webp'
import stickmanDrawTemplateUrl from '@/assets/images/characters/stickman_draw_template.png'
import wildBoyUrl from '@/assets/images/characters/wild-boy.webp'
import wildGirlUrl from '@/assets/images/characters/wild-girl.webp'
import strawManUrl from '@/assets/images/characters/bw-strawman.webp'
import backpackKidUrl from '@/assets/images/characters/backpack-kid.webp'

/** One texture the stickman can wear, picked from the elements or config panel. */
export type StickmanSkin = {
  id: string
  label: string
  textureUrl: string
}

export const STICKMAN_SKINS: StickmanSkin[] = [
  { id: 'stickman', label: 'Stickman', textureUrl: stickmanBackUrl },
  { id: 'draw-template', label: 'Draw template', textureUrl: stickmanDrawTemplateUrl },
  { id: 'wild-boy', label: 'Wild boy', textureUrl: wildBoyUrl },
  { id: 'wild-girl', label: 'Wild girl', textureUrl: wildGirlUrl },
  { id: 'straw-man', label: 'Straw man', textureUrl: strawManUrl },
  { id: 'backpack-kid', label: 'Backpack kid', textureUrl: backpackKidUrl }
]

export const DEFAULT_STICKMAN_SKIN = 'stickman'

const defaultSkin = (): StickmanSkin =>
  STICKMAN_SKINS.find((skin) => skin.id === DEFAULT_STICKMAN_SKIN) ?? STICKMAN_SKINS[0]

/**
 * Looks a skin up by id, falling back to the default.
 *
 * A saved or shared id can outlive the skin it named, and a rig with no
 * texture at all is back to its plain default material.
 * @param id - Skin id, from the panel or a peer
 * @returns The matching skin, or the default one
 */
export const stickmanSkinById = (id: string): StickmanSkin =>
  STICKMAN_SKINS.find((skin) => skin.id === id) ?? defaultSkin()

/**
 * The skins as the panel's select field wants them.
 * @returns One option per skin, in catalogue order
 */
export const stickmanSkinOptions = (): { value: string; label: string }[] =>
  STICKMAN_SKINS.map((skin) => ({ value: skin.id, label: skin.label }))
