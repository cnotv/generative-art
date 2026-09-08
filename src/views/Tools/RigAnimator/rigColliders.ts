import * as THREE from 'three'
import { computeRigDiagonal } from './boneMarkers'
import {
  BONE_COLLIDER_MIN_LENGTH_FRACTION,
  BONE_COLLIDER_MIN_RADIUS_FRACTION,
  BONE_COLLIDER_RADIUS_FRACTION
} from './config'

/** Rapier stands a capsule up its own Y axis, so every segment is aimed relative to that. */
const CAPSULE_AXIS = new THREE.Vector3(0, 1, 0)

export interface BoneColliderSpec {
  boneName: string
  childBoneName: string
  /** Half the capsule's straight section, matching the segment's world length. */
  halfHeight: number
  radius: number
  /** The segment's midpoint, in the parent bone's own local space. */
  localCenter: THREE.Vector3
  /** Aims the capsule's Y axis down the segment, in the parent bone's own local space. */
  localQuaternion: THREE.Quaternion
}

const childBonesOf = (bone: THREE.Bone): THREE.Bone[] =>
  bone.children.filter((child): child is THREE.Bone => child instanceof THREE.Bone)

const worldSegmentLength = (bone: THREE.Bone, child: THREE.Bone): number =>
  bone.getWorldPosition(new THREE.Vector3()).distanceTo(child.getWorldPosition(new THREE.Vector3()))

/** One capsule per bone segment: a bone and one of its bone children, which is what actually
 * has a length and a direction. A bone on its own is only a point, and a branching joint such
 * as the hips is several segments rather than one. */
export const buildBoneColliderSpecs = (bones: THREE.Bone[]): BoneColliderSpec[] => {
  const rigDiagonal = computeRigDiagonal(bones)
  const minimumLength = rigDiagonal * BONE_COLLIDER_MIN_LENGTH_FRACTION
  const minimumRadius = rigDiagonal * BONE_COLLIDER_MIN_RADIUS_FRACTION

  return bones.flatMap((bone) =>
    childBonesOf(bone).flatMap((child) => {
      const length = worldSegmentLength(bone, child)
      if (length <= minimumLength) return []

      return [
        {
          boneName: bone.name,
          childBoneName: child.name,
          halfHeight: length / 2,
          radius: Math.max(length * BONE_COLLIDER_RADIUS_FRACTION, minimumRadius),
          localCenter: child.position.clone().multiplyScalar(0.5),
          localQuaternion: new THREE.Quaternion().setFromUnitVectors(
            CAPSULE_AXIS,
            child.position.clone().normalize()
          )
        }
      ]
    })
  )
}

const scratchPosition = new THREE.Vector3()
const scratchScale = new THREE.Vector3()

/** Writes into the vectors it is handed rather than returning new ones, because this runs once
 * per segment per frame and a humanoid rig has upwards of fifty of them. */
export const readBoneColliderTransform = (
  bone: THREE.Bone,
  spec: BoneColliderSpec,
  outPosition: THREE.Vector3,
  outQuaternion: THREE.Quaternion
): void => {
  outPosition.copy(spec.localCenter).applyMatrix4(bone.matrixWorld)
  bone.matrixWorld.decompose(scratchPosition, outQuaternion, scratchScale)
  outQuaternion.multiply(spec.localQuaternion)
}
