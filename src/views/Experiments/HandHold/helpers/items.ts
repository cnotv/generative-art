import * as THREE from 'three'
import { disposeObject } from '@webgamekit/threejs'

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

const createSword = (): THREE.Group => {
  const group = new THREE.Group()

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.9, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd8dee8, metalness: 0.6, roughness: 0.3 })
  )
  blade.position.y = 0.6
  group.add(blade)

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.4, roughness: 0.5 })
  )
  guard.position.y = 0.13
  group.add(guard)

  // The handle is centred on the group's own origin, which the hand system places exactly at
  // the hand's grip point, so the fist wraps around the handle rather than its lower edge.
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.8 })
  )
  group.add(handle)

  return group
}

const createShield = (): THREE.Group => {
  const group = new THREE.Group()

  // No separate handle mesh: the fist grips the shield's own back-centre, which sits at the
  // group's origin, exactly at the hand's grip point.
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0x8fa3c2, metalness: 0.3, roughness: 0.6 })
  )
  face.rotation.x = Math.PI / 2
  group.add(face)

  const boss = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xc79fc2, metalness: 0.4, roughness: 0.4 })
  )
  boss.position.set(0, 0, 0.05)
  group.add(boss)

  return group
}

const createHammer = (): THREE.Group => {
  const group = new THREE.Group()

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xa8a8a0, metalness: 0.5, roughness: 0.5 })
  )
  head.position.y = 0.4
  group.add(head)

  // Centred on the group's own origin, the hand's grip point.
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 })
  )
  group.add(handle)

  return group
}

const createWand = (): THREE.Group => {
  const group = new THREE.Group()

  // Centred on the group's own origin, the hand's grip point.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8c9f0, roughness: 0.6 })
  )
  group.add(shaft)

  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09),
    new THREE.MeshStandardMaterial({ color: 0x9fd9c2, metalness: 0.2, roughness: 0.2 })
  )
  gem.position.y = 0.4
  group.add(gem)

  return group
}

/** Each builder returns a group whose local +Y points from the grip toward the item's tip, so
 * a hand's own forward direction can be applied as a single rotation. */
export const ITEM_BUILDERS = [createSword, createShield, createHammer, createWand] as const
export const ITEM_NAMES = ['Sword', 'Shield', 'Hammer', 'Wand'] as const

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

/** One group of all four items per hand slot, only one shown at a time: cheaper and simpler
 * than swapping meshes in and out of the scene every time the held item changes. */
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
    return { handGroup, itemGroups }
  })

  const update = (
    handWorldPositions: readonly (THREE.Vector3 | null)[],
    handForwardDirections: readonly THREE.Vector3[],
    handIsGripping: readonly boolean[],
    handItemIndex: readonly number[],
    handScale: readonly number[]
  ): void => {
    hands.forEach(({ handGroup, itemGroups }, handIndex) => {
      const position = handWorldPositions[handIndex]
      const visible = handIsGripping[handIndex] && position !== null
      handGroup.visible = visible
      if (!visible || !position) return
      handGroup.position.copy(position)
      handGroup.quaternion.setFromUnitVectors(UP, handForwardDirections[handIndex])
      handGroup.scale.setScalar(handScale[handIndex])
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
