import * as THREE from 'three'

/** A quaternion snapshot, plain data so it survives JSON export/import */
export interface QuaternionData {
  x: number
  y: number
  z: number
  w: number
}

/** One captured rig pose: every posed bone's local rotation, keyed by bone name */
export type Pose = Record<string, QuaternionData>

/** A pose pinned to a frame on the animation timeline */
export interface PoseKeyframe {
  frame: number
  pose: Pose
}

/** Where a humanoid template bone sits, as fractions of the model's bounding box */
export interface HumanoidBoneDefinition {
  name: string
  parent: string | null
  /** Fraction of bounding-box height, measured from the bottom */
  heightFraction: number
  side: 'left' | 'right' | 'center'
  /** Fraction of half the bounding-box width the bone offsets toward its side */
  spreadFraction: number
}

/** A generated humanoid skeleton, ready to bind to a mesh */
export interface HumanoidSkeleton {
  root: THREE.Bone
  bones: THREE.Bone[]
  skeleton: THREE.Skeleton
}

/** A two-bone limb chain (shoulder/elbow/hand, hip/knee/foot) an analytic IK solve reaches with */
export interface TwoBoneIkChain {
  root: THREE.Bone
  mid: THREE.Bone
  end: THREE.Bone
}
