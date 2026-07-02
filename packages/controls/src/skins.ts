import type { ControlSkin, ControlSkinId } from './types'

/**
 * Registry of provided on-screen control skins. The UI renders the visual style
 * for each id; this data only declares which skins exist and which is default.
 */
export const CONTROL_SKINS: ControlSkin[] = [
  { id: 'default', label: 'Default', isDefault: true },
  { id: 'neon', label: 'Neon' },
  { id: 'minimal', label: 'Minimal' }
]

/**
 * Get the id of the skin flagged as default, falling back to the first skin.
 *
 * @returns {ControlSkinId} The default skin id
 */
export function getDefaultSkinId(): ControlSkinId {
  return (CONTROL_SKINS.find((skin) => skin.isDefault) ?? CONTROL_SKINS[0]).id
}
