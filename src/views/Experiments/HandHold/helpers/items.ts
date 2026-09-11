import * as THREE from 'three'
import { disposeObject } from '@webgamekit/threejs'
import {
  SWORD_BLADE_LENGTH,
  ITEM_POSITION_SMOOTHING,
  ITEM_ROTATION_SMOOTHING,
  ITEM_SCALE_SMOOTHING
} from '../config'

export interface Point2D {
  x: number
  y: number
}

/**
 * Project a mirrored normalized image-space point (as shown in the mirrored video preview)
 * onto the world-space plane at z=0, for a camera sitting on the z axis looking at the origin.
 * Writes into `target` rather than returning a new vector, so callers can reuse one allocation
 * across every landmark read each frame.
 */
export const mirroredImagePointToWorld = (
  point: Point2D,
  cameraDistance: number,
  verticalFovDegrees: number,
  aspect: number,
  target: THREE.Vector3
): void => {
  const halfHeight = cameraDistance * Math.tan((verticalFovDegrees * Math.PI) / 360)
  const halfWidth = halfHeight * aspect
  target.set((0.5 - point.x) * 2 * halfWidth, (0.5 - point.y) * 2 * halfHeight, 0)
}

/**
 * A tapered blade silhouette (wide at the guard, drawn to a point at the tip) extruded to a
 * thin diamond-ish cross-section, rather than a flat-sided box: the shape alone is what reads
 * as an actual blade instead of a metal ruler.
 */
const createBladeGeometry = (length: number): THREE.BufferGeometry => {
  const baseHalfWidth = 0.03
  const tipHalfWidth = baseHalfWidth * 0.35
  const tipShoulder = length * 0.94

  const outline = new THREE.Shape()
  outline.moveTo(-baseHalfWidth, 0)
  outline.lineTo(baseHalfWidth, 0)
  outline.lineTo(tipHalfWidth, tipShoulder)
  outline.lineTo(0, length)
  outline.lineTo(-tipHalfWidth, tipShoulder)
  outline.lineTo(-baseHalfWidth, 0)

  const thickness = 0.012
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.25,
    bevelSize: thickness * 0.25,
    bevelSegments: 2,
    curveSegments: 1
  })
  geometry.translate(0, 0, -thickness / 2)
  geometry.computeVertexNormals()
  return geometry
}

const createSword = (): THREE.Group => {
  const group = new THREE.Group()

  const handleHeight = 0.22
  const guardHeight = 0.05

  // Centred on the group's own origin, which the hand system places exactly at the hand's
  // grip point, so the fist wraps around the handle rather than sitting beside it.
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, handleHeight, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.8 })
  )
  group.add(handle)

  const guardY = handleHeight / 2
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, guardHeight, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.4, roughness: 0.5 })
  )
  guard.position.y = guardY
  group.add(guard)

  // Polished steel: metalness this high only reads correctly with an environment light for it
  // to reflect, which the setup config provides for the whole scene.
  const blade = new THREE.Mesh(
    createBladeGeometry(SWORD_BLADE_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.18 })
  )
  blade.position.y = guardY + guardHeight / 2
  group.add(blade)

  return group
}

/** Each builder returns a group whose local +Y points from the grip toward the item's tip, so
 * a hand's own forward direction can be applied as a single rotation. Only the sword for now;
 * add more builders here to bring back finger-count selection between several items. */
export const ITEM_BUILDERS = [createSword] as const
export const ITEM_NAMES = ['Sword'] as const
export const SWORD_ITEM_INDEX = 0

const UP = new THREE.Vector3(0, 1, 0)

export interface HeldItemsSystem {
  update: (
    handWorldPositions: readonly (THREE.Vector3 | null)[],
    handForwardDirections: readonly THREE.Vector3[],
    handIsGripping: readonly boolean[],
    handItemIndex: readonly number[],
    handScale: readonly number[]
  ) => void
  dispose: () => void
}

/** One group of every item in ITEM_BUILDERS per hand slot, only one shown at a time: cheaper
 * and simpler than swapping meshes in and out of the scene every time the held item changes. */
export const createHeldItemsSystem = (scene: THREE.Scene, handSlots: number): HeldItemsSystem => {
  const hands = Array.from({ length: handSlots }, () => {
    const handGroup = new THREE.Group()
    const itemGroups = ITEM_BUILDERS.map((build) => {
      const itemGroup = build()
      itemGroup.visible = false
      handGroup.add(itemGroup)
      return itemGroup
    })
    scene.add(handGroup)
    return { handGroup, itemGroups, wasVisible: false }
  })
  const targetQuaternion = new THREE.Quaternion()

  const update = (
    handWorldPositions: readonly (THREE.Vector3 | null)[],
    handForwardDirections: readonly THREE.Vector3[],
    handIsGripping: readonly boolean[],
    handItemIndex: readonly number[],
    handScale: readonly number[]
  ): void => {
    hands.forEach((hand, handIndex) => {
      const { handGroup, itemGroups } = hand
      const position = handWorldPositions[handIndex]
      const visible = handIsGripping[handIndex] && position !== null
      handGroup.visible = visible
      if (!visible || !position) {
        hand.wasVisible = false
        return
      }
      targetQuaternion.setFromUnitVectors(UP, handForwardDirections[handIndex])
      if (hand.wasVisible) {
        // Ease toward the new pose each frame rather than snapping to it, so webcam jitter
        // and a fast swing both read as smooth motion instead of a shaky, teleporting item.
        handGroup.position.lerp(position, ITEM_POSITION_SMOOTHING)
        handGroup.quaternion.slerp(targetQuaternion, ITEM_ROTATION_SMOOTHING)
        handGroup.scale.setScalar(
          THREE.MathUtils.lerp(handGroup.scale.x, handScale[handIndex], ITEM_SCALE_SMOOTHING)
        )
      } else {
        // The hand just started gripping (or came back from being lost): snap straight to
        // its current pose instead of easing in from wherever the item last was.
        handGroup.position.copy(position)
        handGroup.quaternion.copy(targetQuaternion)
        handGroup.scale.setScalar(handScale[handIndex])
      }
      hand.wasVisible = true
      itemGroups.forEach((itemGroup, itemIndex) => {
        itemGroup.visible = itemIndex === handItemIndex[handIndex]
      })
    })
  }

  const dispose = (): void => {
    hands.forEach(({ handGroup, itemGroups }) => {
      itemGroups.forEach((itemGroup) => disposeObject(itemGroup))
      scene.remove(handGroup)
    })
  }

  return { update, dispose }
}
