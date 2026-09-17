import * as THREE from 'three'
import { disposeObject } from '@webgamekit/threejs'
import {
  BAT_LENGTH,
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
 * A tapered cylinder standing along local +Y, base at the origin: thin at the grip end,
 * flaring out toward the barrel at the tip, the way a real bat's turned profile does.
 */
const createBatGeometry = (length: number): THREE.BufferGeometry => {
  const gripRadius = 0.018
  const barrelRadius = 0.045
  const geometry = new THREE.CylinderGeometry(barrelRadius, gripRadius, length, 16)
  geometry.translate(0, length / 2, 0)
  return geometry
}

const createBat = (): THREE.Group => {
  const group = new THREE.Group()

  const bat = new THREE.Mesh(
    createBatGeometry(BAT_LENGTH),
    new THREE.MeshStandardMaterial({ color: 0xd8b98c, roughness: 0.75 })
  )
  group.add(bat)

  return group
}

/** Each builder returns a group whose local +Y points from the grip toward the item's tip, so
 * a hand's own forward direction can be applied as a single rotation. Only the bat for now;
 * add more builders here to bring back finger-count selection between several items. */
export const ITEM_BUILDERS = [createBat] as const
export const ITEM_NAMES = ['Bat'] as const
export const BAT_ITEM_INDEX = 0

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
