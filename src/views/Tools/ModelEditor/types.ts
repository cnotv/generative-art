import * as THREE from 'three'

/** The humanoid regions the editor resizes, each covering one or more of the rig's own bones. */
export type ModelEditorPartName =
  | 'head'
  | 'neck'
  | 'torso'
  | 'shoulders'
  | 'upperArms'
  | 'forearms'
  | 'hands'
  | 'thighs'
  | 'shins'
  | 'feet'

/** One bone of a region, paired with the bone below it that the region runs towards. */
export type ModelEditorPartSegment = {
  bone: string
  tip: string
}

/** A region as the panel offers it: its name, and every bone segment it covers. */
export type ModelEditorPart = {
  name: ModelEditorPartName
  segments: ModelEditorPartSegment[]
}

/** How far a region departs from the proportions its rig was authored in. */
export type ModelEditorPartScale = {
  /** Multiplies the distance from a bone to the one below it, stretching the segment. */
  length: number
  /** Multiplies the two axes across a bone, thickening it without moving anything below. */
  size: number
}

/** Every region's current proportions, one entry per region the editor knows about. */
export type ModelEditorPartScales = Record<ModelEditorPartName, ModelEditorPartScale>

/**
 * One bone measured while the rig still stood in its authored proportions, so an edit always
 * offsets from a fixed baseline rather than compounding onto the previous one.
 */
export type ModelEditorBoneRest = {
  bone: THREE.Bone
  restScale: THREE.Vector3
  /** Which of the bone's own axes runs down the segment towards its tip. */
  lengthAxis: 'x' | 'y' | 'z'
  /** The region this bone belongs to, or null for a bone no region covers. */
  part: ModelEditorPartName | null
}
