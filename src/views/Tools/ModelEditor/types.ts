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

/** The facial features the editor reshapes by deforming the mesh around a point on the face. */
export type FaceFeatureName = 'eyes' | 'nose' | 'mouth' | 'jaw' | 'ears' | 'cheeks'

/**
 * Where a feature sits on the face, as fractions of the face's height from chin to crown, so
 * one table fits a head of any size or unit.
 */
export type FaceFeature = {
  name: FaceFeatureName
  /**
   * Distance either side of the centre line for a front-facing pair, or zero for a single
   * feature on the line. A side-facing feature is always a pair, found from the centre outwards.
   */
  across: number
  /** Height above the chin. */
  up: number
  /** How far the deformation reaches from the feature's own point before fading to nothing. */
  radius: number
  /** Which way the feature faces: its point is snapped onto the surface in this direction. */
  facing: 'front' | 'side'
}

/** How far a feature departs from the face it was authored with. */
export type FaceFeatureSetting = {
  /** Multiplies the feature's extent around its own point. */
  size: number
  /** Moves the feature up or down, as a fraction of the face's height. */
  height: number
  /** Pushes the feature out of or into the face, as a fraction of the face's height. */
  depth: number
}

export type FaceFeatureSettings = Record<FaceFeatureName, FaceFeatureSetting>

/** One feature point found on the face, in world space at the rig's rest pose. */
export type FaceAnchor = {
  feature: FaceFeatureName
  position: THREE.Vector3
  /** The direction the feature faces, the one its depth pushes along. */
  outward: THREE.Vector3
}

/** A feature's pull on one vertex, precomputed in the mesh's own geometry space. */
export type FaceVertexContribution = {
  feature: FaceFeatureName
  weight: number
  /** The vertex's offset from the feature point, the lever its size scales. */
  fromAnchor: THREE.Vector3
  /** The feature's outward direction, one face height long. */
  outward: THREE.Vector3
}

/** A vertex some feature reaches, with its untouched position and every pull on it. */
export type FaceVertex = {
  index: number
  rest: THREE.Vector3
  contributions: FaceVertexContribution[]
}

/** One mesh's share of the face: the vertices the features reach, and which way is up in it. */
export type FaceMeshRig = {
  geometry: THREE.BufferGeometry
  /** World up, one face height long, carried into the mesh's geometry space. */
  up: THREE.Vector3
  vertices: FaceVertex[]
}

/** A head vertex's world position at rest, tagged with where it came from. */
export type HeadVertex = {
  mesh: THREE.Mesh
  index: number
  world: THREE.Vector3
}

/** The head's own frame, measured from its vertices and its bones. */
export type FaceFrame = {
  centerX: number
  centerZ: number
  chin: number
  height: number
}

export type ModelEditorConfig = {
  body: ModelEditorPartScales
  face: FaceFeatureSettings
}
