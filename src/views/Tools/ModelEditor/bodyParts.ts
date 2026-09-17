import * as THREE from 'three'
import { MODEL_EDITOR_PARTS } from './config'
import type {
  ModelEditorBoneRest,
  ModelEditorPart,
  ModelEditorPartName,
  ModelEditorPartScales
} from './types'

const AXES: ('x' | 'y' | 'z')[] = ['x', 'y', 'z']

/** A humanoid limb runs up its own local Y in every rig here, so an unmeasurable bone assumes it. */
const DEFAULT_LENGTH_AXIS: 'x' | 'y' | 'z' = 'y'

const NEUTRAL_SCALE = new THREE.Vector3(1, 1, 1)

const PART_NAME_BY_BONE_NAME = new Map(
  MODEL_EDITOR_PARTS.flatMap((part) =>
    part.segments.map((segment): [string, ModelEditorPartName] => [segment.bone, part.name])
  )
)

const TIP_NAME_BY_BONE_NAME = new Map(
  MODEL_EDITOR_PARTS.flatMap((part) =>
    part.segments.map((segment): [string, string] => [segment.bone, segment.tip])
  )
)

/**
 * Every region with at least one of its bones in the loaded rig, in panel order. A model rigged
 * to some other convention matches nothing and gets no proportion controls at all, rather than
 * a panel full of sliders that move nothing.
 * @param boneNames Every bone name the loaded rig carries
 * @returns The regions this rig can actually be edited by
 */
export const partsInRig = (boneNames: string[]): ModelEditorPart[] => {
  const presentBoneNames = new Set(boneNames)
  return MODEL_EDITOR_PARTS.filter((part) =>
    part.segments.some((segment) => presentBoneNames.has(segment.bone))
  )
}

/**
 * The proportions a freshly loaded rig starts at: its own, every region left untouched.
 * @returns A fresh set of per-region scales, safe to mutate
 */
export const createPartScales = (): ModelEditorPartScales =>
  Object.fromEntries(
    MODEL_EDITOR_PARTS.map((part) => [part.name, { length: 1, size: 1 }])
  ) as ModelEditorPartScales

/**
 * Which of a bone's own axes runs down its length, taken from where its tip sits. A bone's scale
 * applies in its own local space, so lengthening a limb means scaling the single axis its tip
 * lies along and leaving the two across it free to carry thickness instead.
 */
const lengthAxisTowards = (tipOffset: THREE.Vector3): 'x' | 'y' | 'z' =>
  AXES.reduce(
    (longest, axis) => (Math.abs(tipOffset[axis]) > Math.abs(tipOffset[longest]) ? axis : longest),
    DEFAULT_LENGTH_AXIS
  )

/** The offset of the bone a region runs towards, falling back to whichever chain the bone starts. */
const tipOffsetOf = (bone: THREE.Bone): THREE.Vector3 | null => {
  const tipName = TIP_NAME_BY_BONE_NAME.get(bone.name)
  const named = bone.children.find((child) => child.name === tipName)
  const fallback = bone.children.find((child) => child instanceof THREE.Bone)
  return (named ?? fallback)?.position ?? null
}

/**
 * Measure every bone once, while the rig still stands in the proportions it was authored in.
 * @param bones The loaded rig's bones, already resolved to the ones that move the whole model
 * @returns Each bone's rest scale, its length axis and the region it belongs to
 */
export const measureRigBones = (bones: THREE.Bone[]): ModelEditorBoneRest[] =>
  bones.map((bone) => {
    const tipOffset = tipOffsetOf(bone)
    return {
      bone,
      restScale: bone.scale.clone(),
      lengthAxis: tipOffset ? lengthAxisTowards(tipOffset) : DEFAULT_LENGTH_AXIS,
      part: PART_NAME_BY_BONE_NAME.get(bone.name) ?? null
    }
  })

/** The scale a bone's own region asks it to carry: length down the bone, size across it. */
const partScaleVector = (
  rest: ModelEditorBoneRest,
  parts: ModelEditorPartScales
): THREE.Vector3 => {
  if (!rest.part) return NEUTRAL_SCALE
  const { length, size } = parts[rest.part]
  return new THREE.Vector3(size, size, size).setComponent(AXES.indexOf(rest.lengthAxis), length)
}

/**
 * Push every region's proportions onto the rig.
 *
 * A bone's scale carries down the chain, so each bone takes its own region's scale divided by
 * whatever its parent already applies: the thickening lands on the bone it was asked for and on
 * nothing below it, and a thicker upper arm does not come with a swollen hand. The limb still
 * grows longer all the same, because a child bone's offset sits in its parent's own scaled
 * space, and that offset is exactly what a segment's length is.
 * @param rig Every bone measured at load, from `measureRigBones`
 * @param parts The proportions each region is currently set to
 * @returns Nothing; the rig's bones are scaled in place
 */
export const applyPartScales = (rig: ModelEditorBoneRest[], parts: ModelEditorPartScales): void => {
  const scaleByBoneName = new Map(
    rig.map((rest): [string, THREE.Vector3] => [rest.bone.name, partScaleVector(rest, parts)])
  )
  rig.forEach(({ bone, restScale }) => {
    const own = scaleByBoneName.get(bone.name) ?? NEUTRAL_SCALE
    const parentName = bone.parent instanceof THREE.Bone ? bone.parent.name : ''
    const inherited = scaleByBoneName.get(parentName) ?? NEUTRAL_SCALE
    bone.scale.copy(restScale).multiply(own).divide(inherited)
  })
}
