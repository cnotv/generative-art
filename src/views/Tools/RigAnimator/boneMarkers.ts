import * as THREE from 'three'
import {
  BONE_MARKER_COLOR_DEFAULT,
  BONE_MARKER_COLOR_SELECTED,
  BONE_MARKER_DEPTH_FALLOFF,
  BONE_MARKER_MIN_SCALE,
  BONE_MARKER_RADIUS_FRACTION
} from './config'

const MARKER_NAME_PREFIX = 'bone-marker:'
const MARKER_SEGMENTS = 8

/**
 * How far the rig's bones spread in world space, so markers and the position panel field can
 * scale to match any model.
 * @param bones The rig's bones, with up-to-date world matrices
 */
export const computeRigDiagonal = (bones: THREE.Bone[]): number => {
  const box = new THREE.Box3()
  bones.forEach((bone) => box.expandByPoint(bone.getWorldPosition(new THREE.Vector3())))
  return box.getSize(new THREE.Vector3()).length()
}

/** How many Bone ancestors sit between this bone and the skeleton's root (root itself is 0). */
const boneDepth = (bone: THREE.Bone): number =>
  bone.parent instanceof THREE.Bone ? boneDepth(bone.parent) + 1 : 0

/**
 * Add a small clickable marker to every bone, parented to the bone itself so it tracks the
 * bone's pose automatically without any per-frame syncing. Sized as a fraction of the rig's
 * own spread so it reads at any model scale, and shrinking with hierarchy depth so a root
 * joint reads larger than the fingertip several bones below it.
 * @param bones The rig's bones to mark, with up-to-date world matrices
 * @returns The created markers, in the same order as the bones
 */
export const createBoneMarkers = (bones: THREE.Bone[]): THREE.Mesh[] => {
  const baseRadius = computeRigDiagonal(bones) * BONE_MARKER_RADIUS_FRACTION

  return bones.map((bone) => {
    const depthScale = Math.max(BONE_MARKER_MIN_SCALE, BONE_MARKER_DEPTH_FALLOFF ** boneDepth(bone))
    const geometry = new THREE.SphereGeometry(
      baseRadius * depthScale,
      MARKER_SEGMENTS,
      MARKER_SEGMENTS
    )
    const material = new THREE.MeshBasicMaterial({
      color: BONE_MARKER_COLOR_DEFAULT,
      depthTest: false
    })
    const marker = new THREE.Mesh(geometry, material)
    marker.name = `${MARKER_NAME_PREFIX}${bone.name}`
    marker.renderOrder = 999
    bone.add(marker)
    return marker
  })
}

/**
 * Recolour every marker so only the selected bone's marker stands out.
 * @param markers The rig's bone markers
 * @param selectedBoneName The bone currently selected, or an empty string for none
 */
export const highlightBoneMarker = (markers: THREE.Mesh[], selectedBoneName: string): void => {
  markers.forEach((marker) => {
    const material = marker.material as THREE.MeshBasicMaterial
    const isSelected = marker.name === `${MARKER_NAME_PREFIX}${selectedBoneName}`
    material.color.setHex(isSelected ? BONE_MARKER_COLOR_SELECTED : BONE_MARKER_COLOR_DEFAULT)
  })
}

/**
 * Resolve a raycast against the rig's markers to the bone it hit.
 * @param markers The rig's bone markers
 * @param raycaster A raycaster already set from the pointer and camera
 * @returns The hit bone's name, or null when the ray missed every marker
 */
export const pickBoneMarker = (
  markers: THREE.Mesh[],
  raycaster: THREE.Raycaster
): string | null => {
  const [hit] = raycaster.intersectObjects(markers, false)
  if (!hit) return null
  return hit.object.name.replace(MARKER_NAME_PREFIX, '')
}
