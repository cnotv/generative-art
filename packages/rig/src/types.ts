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

/** Which hand a hand pose preset or a selected bone belongs to */
export type HandSide = 'Left' | 'Right'

/** Per-finger local-X curl angles (radians), one per joint from the palm outward */
export interface HandPoseDefinition {
  thumb: [number, number, number]
  index: [number, number, number]
  middle: [number, number, number]
  ring: [number, number, number]
  pinky: [number, number, number]
}

/**
 * A hand's own orientation in world space, as two independent directions: along the fingers
 * (wrist toward the middle-finger base) and across the knuckle row (the index-finger base
 * toward the pinky-finger base). Two directions, not one, because a hand's roll around the
 * "along" axis (palm up versus palm down) is real signal a single direction cannot capture.
 */
export interface HandOrientation {
  along: THREE.Vector3
  across: THREE.Vector3
}
