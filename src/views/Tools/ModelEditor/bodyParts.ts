import * as THREE from 'three'
import { resolveHierarchyBones } from '@/views/Tools/RigAnimator/rigModel'
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
 * A Mixamo bone's name without the numbered prefix a re-import gives it. Mixamo itself exports
 * `mixamorig:Hips`, which both loaders sanitise to `mixamorigHips`, but a rig brought through
 * Blender more than once comes back as `mixamorig1:Hips`, `mixamorig2:Hips` and so on: the
 * same skeleton that would otherwise match nothing here.
 * @param name A bone's name as loaded
 * @returns The name every table in this editor keys the bone by
 */
export const canonicalBoneName = (name: string): string =>
  name.replace(/^mixamorig\d*:?/, 'mixamorig')

/**
 * Every bone the loaded model carries, each resolved to the copy that actually moves the model.
 * Read from the whole model rather than one skinned mesh's skeleton, since a body and a head
 * bound as separate meshes can each list only the bones their own vertices use.
 * @param model The loaded model
 * @returns Each distinct bone once
 */
export const collectRigBones = (model: THREE.Object3D): THREE.Bone[] => {
  const bones = model
    .getObjectsByProperty('isBone', true)
    .filter((object): object is THREE.Bone => object instanceof THREE.Bone)
  return [...new Set(resolveHierarchyBones(bones))]
}

/**
 * Every region with at least one of its bones in the loaded rig, in panel order. A model rigged
 * to some other convention matches nothing and gets no proportion controls at all, rather than
 * a panel full of sliders that move nothing.
 * @param boneNames Every bone name the loaded rig carries
 * @returns The regions this rig can actually be edited by
 */
export const partsInRig = (boneNames: string[]): ModelEditorPart[] => {
  const presentBoneNames = new Set(boneNames.map(canonicalBoneName))
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

/**
 * The offset of the bone a region runs towards, falling back to whichever chain the bone starts,
 * and for a bone at the end of its chain to the bone's own offset from its parent: a generated
 * rig ends its arms at the hand and its spine at the head, and both carry on the way they came.
 */
const tipOffsetOf = (bone: THREE.Bone): THREE.Vector3 | null => {
  const tipName = TIP_NAME_BY_BONE_NAME.get(canonicalBoneName(bone.name))
  const named = bone.children.find((child) => canonicalBoneName(child.name) === tipName)
  const firstChildBone = bone.children.find((child) => child instanceof THREE.Bone)
  const ownOffset = bone.parent instanceof THREE.Bone ? bone : undefined
  return (named ?? firstChildBone ?? ownOffset)?.position ?? null
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
      part: PART_NAME_BY_BONE_NAME.get(canonicalBoneName(bone.name)) ?? null
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
 * The scale a bone's chain carries at that bone: its own region's, or for a bone no region covers
 * (a finger, a toe, the end of the skull) whatever the nearest covered bone above it carries.
 */
const carriedScale = (
  object: THREE.Object3D | null,
  restByBone: Map<THREE.Object3D, ModelEditorBoneRest>,
  parts: ModelEditorPartScales
): THREE.Vector3 => {
  if (!object) return NEUTRAL_SCALE
  const rest = restByBone.get(object)
  return rest?.part ? partScaleVector(rest, parts) : carriedScale(object.parent, restByBone, parts)
}

/**
 * Push every region's proportions onto the rig.
 *
 * A bone's scale carries down the chain, so a bone that starts a new region takes its region's
 * scale divided by whatever its parent already carries: the thickening lands on the region it
 * was asked for and stops where the next region begins, and a thicker upper arm does not come
 * with a swollen hand. The limb still grows longer all the same, because a child bone's offset
 * sits in its parent's own scaled space, and that offset is exactly what a segment's length is.
 * A bone no region covers keeps its rest scale and so simply rides along with the region above
 * it: fingers grow with the hand, toes with the foot, the crown with the head.
 * @param rig Every bone measured at load, from `measureRigBones`
 * @param parts The proportions each region is currently set to
 * @returns Nothing; the rig's bones are scaled in place
 */
export const applyPartScales = (rig: ModelEditorBoneRest[], parts: ModelEditorPartScales): void => {
  const restByBone = new Map<THREE.Object3D, ModelEditorBoneRest>(
    rig.map((rest) => [rest.bone, rest])
  )
  rig.forEach(({ bone, restScale }) => {
    const carriedHere = carriedScale(bone, restByBone, parts)
    const carriedAbove = carriedScale(bone.parent, restByBone, parts)
    bone.scale.copy(restScale).multiply(carriedHere).divide(carriedAbove)
  })
}
