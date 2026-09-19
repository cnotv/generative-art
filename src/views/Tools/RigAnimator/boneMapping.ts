import { RIG_BONE_SLOTS } from './config'
import type { RigBoneMapping, RigBoneSlot } from './types'

/** A bone name reduced to comparable letters: no case, no separators, no rig prefix. */
const simplifyBoneName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/mixamorig/g, '')
    .replace(/[^a-z]/g, '')

/**
 * Both ways a rig names a side: the whole word, and a lone letter standing on its own between
 * separators, which is how every exporter but Mixamo writes it (`hand_L`, `L.upperarm`, `arm L`).
 */
const SIDE_PATTERNS: Record<'left' | 'right', RegExp[]> = {
  left: [/left/i, /(^|[^a-z])l([^a-z]|$)/i],
  right: [/right/i, /(^|[^a-z])r([^a-z]|$)/i]
}

/**
 * Which side of the body a bone's own name says it is on.
 * @param name The bone's name, as its rig spells it
 * @returns The side its name carries, or `center` when it carries none
 */
export const boneNameSide = (name: string): RigBoneSlot['side'] => {
  if (SIDE_PATTERNS.left.some((pattern) => pattern.test(name))) return 'left'
  if (SIDE_PATTERNS.right.some((pattern) => pattern.test(name))) return 'right'
  return 'center'
}

/** The longest of a slot's own fragments this bone name contains, or 0 when it contains none. */
const matchedFragmentLength = (slot: RigBoneSlot, simplified: string): number =>
  slot.match
    .filter((fragment) => simplified.includes(fragment))
    .reduce((longest, fragment) => Math.max(longest, fragment.length), 0)

/**
 * The bone whose name best fits one slot: same side, matching the most specific fragment, and
 * where two match equally well, the one carrying the least else in its name.
 */
const bestBoneMatch = (slot: RigBoneSlot, boneNames: string[]): string | null =>
  boneNames.reduce<{ name: string; fragment: number } | null>((best, name) => {
    if (boneNameSide(name) !== slot.side) return best
    const fragment = matchedFragmentLength(slot, simplifyBoneName(name))
    if (fragment === 0) return best
    const isBetter =
      !best ||
      fragment > best.fragment ||
      (fragment === best.fragment && name.length < best.name.length)
    return isBetter ? { name, fragment } : best
  }, null)?.name ?? null

/**
 * Guess which bone of a loaded rig plays each canonical role, from the names alone. A Mixamo rig
 * maps every role to the bone already carrying that name; any other naming convention is matched
 * on its own fragments (see `RIG_BONE_SLOTS`). It is a starting point, not an answer: a rig with
 * unhelpful names (`Bone.001`) matches nothing, and the panel is where a wrong guess is corrected.
 * @param boneNames Every bone name the loaded rig has
 * @returns The roles that found a bone, keyed by canonical name
 */
export const guessBoneMapping = (boneNames: string[]): RigBoneMapping =>
  Object.fromEntries(
    RIG_BONE_SLOTS.flatMap((slot) => {
      const match = bestBoneMatch(slot, boneNames)
      return match ? [[slot.canonical, match]] : []
    })
  )

/**
 * The bone a canonical role is mapped to.
 * @param mapping The rig's current mapping
 * @param canonical The canonical name the retargeting asks for
 * @returns The mapped bone's name, or the canonical name itself when the role is unmapped
 */
export const resolveBoneName = (mapping: RigBoneMapping, canonical: string): string =>
  mapping[canonical] || canonical

/**
 * A lookup from a rig's own bone names to the canonical names the retargeting speaks, so one
 * rekeying at the top of a pose lets the whole mapping below it go on asking for `mixamorigHips`.
 * @param mapping The rig's current mapping
 * @returns The lookup, or null when the mapping renames nothing and every name is already canonical
 */
export const boneNameCanonicalizer = (
  mapping: RigBoneMapping
): ((name: string) => string) | null => {
  const canonicalByBoneName = new Map(
    Object.entries(mapping)
      .filter(([canonical, boneName]) => boneName && boneName !== canonical)
      .map(([canonical, boneName]) => [boneName, canonical])
  )
  return canonicalByBoneName.size === 0
    ? null
    : (name: string): string => canonicalByBoneName.get(name) ?? name
}

/**
 * A canonical role's panel label.
 * @param canonical The canonical bone name
 * @returns Its short label, or the canonical name for a role with no slot of its own
 */
export const boneSlotLabel = (canonical: string): string =>
  RIG_BONE_SLOTS.find((slot) => slot.canonical === canonical)?.label ?? canonical
