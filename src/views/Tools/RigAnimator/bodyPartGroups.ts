import * as THREE from 'three'
import type { RigAnimatorConfig } from './types'

/** A named region of the rig a capture, photo or preset source can be scoped to. */
export type RigBodyPartGroup = 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'spineHead'

export const RIG_BODY_PART_GROUPS: RigBodyPartGroup[] = [
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
  'spineHead'
]

export const RIG_BODY_PART_GROUP_LABELS: Record<RigBodyPartGroup, string> = {
  leftArm: 'Left Arm',
  rightArm: 'Right Arm',
  leftLeg: 'Left Leg',
  rightLeg: 'Right Leg',
  spineHead: 'Spine / Head'
}

/** The chain-root bone that marks the start of each limb group; a bone found while walking up
 * past this point belongs to that group. Anything that reaches the skeleton root without
 * passing through one of these (the spine chain itself, and the root bone) falls into
 * `spineHead` instead, so the mapping needs no separate entry for it. */
const GROUP_ROOT_BONE_NAMES: Record<Exclude<RigBodyPartGroup, 'spineHead'>, string> = {
  leftArm: 'mixamorigLeftShoulder',
  rightArm: 'mixamorigRightShoulder',
  leftLeg: 'mixamorigLeftUpLeg',
  rightLeg: 'mixamorigRightUpLeg'
}

const LIMB_GROUP_ENTRIES = Object.entries(GROUP_ROOT_BONE_NAMES) as [
  Exclude<RigBodyPartGroup, 'spineHead'>,
  string
][]

/** A bone and every Bone ancestor above it, itself first, up to the skeleton root. */
const ancestorBoneChain = (bone: THREE.Bone): THREE.Bone[] =>
  bone.parent instanceof THREE.Bone ? [bone, ...ancestorBoneChain(bone.parent)] : [bone]

/**
 * Which body-part group a bone belongs to, found by walking its own ancestor chain (itself
 * first) until a limb-chain root bone (a shoulder or an upper leg) is reached. A finger or toe
 * bone, or any custom rig extra, is classified the same way as the named bones it hangs off of,
 * with no separate name list needed for it. A bone whose chain reaches the skeleton root
 * without passing through a limb root — the spine, neck and head, and the root bone itself —
 * belongs to `spineHead`.
 * @param bone The bone to classify
 * @returns The group this bone's pose belongs to
 */
export const boneBodyPartGroup = (bone: THREE.Bone): RigBodyPartGroup => {
  const chainNames = new Set(ancestorBoneChain(bone).map((ancestor) => ancestor.name))
  const match = LIMB_GROUP_ENTRIES.find(([, rootName]) => chainNames.has(rootName))
  return match ? match[0] : 'spineHead'
}

/**
 * Every bone name in a loaded rig whose group is one of `groups`.
 * @param bones The rig's bones
 * @param groups The groups a source is scoped to
 * @returns The names of every bone that scope covers
 */
export const boneNamesInGroups = (
  bones: THREE.Bone[],
  groups: Set<RigBodyPartGroup>
): Set<string> =>
  new Set(bones.filter((bone) => groups.has(boneBodyPartGroup(bone))).map((bone) => bone.name))

/** Which config field holds each group's Merge Target flag. */
const TARGET_CONFIG_KEY: Record<RigBodyPartGroup, keyof RigAnimatorConfig> = {
  leftArm: 'targetLeftArm',
  rightArm: 'targetRightArm',
  leftLeg: 'targetLeftLeg',
  rightLeg: 'targetRightLeg',
  spineHead: 'targetSpineHead'
}

/**
 * Read the five Merge Target config flags into the set of groups they select.
 * @param config The rig animator's current config
 * @returns The groups whose flag is on
 */
export const selectedBodyPartGroups = (config: RigAnimatorConfig): Set<RigBodyPartGroup> =>
  new Set(RIG_BODY_PART_GROUPS.filter((group) => config[TARGET_CONFIG_KEY[group]] as boolean))

/**
 * Flip one group's Merge Target flag, leaving every other config field untouched — the pure
 * logic behind clicking a region of the Merge Target diagram.
 * @param config The rig animator's current config
 * @param group The clicked group
 * @returns A new config with only that group's flag flipped
 */
export const toggleBodyPartGroupTarget = (
  config: RigAnimatorConfig,
  group: RigBodyPartGroup
): RigAnimatorConfig => {
  const key = TARGET_CONFIG_KEY[group]
  return { ...config, [key]: !config[key] }
}
