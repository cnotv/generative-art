import type { ComplexModel, Vec3 } from './types'

const ZERO_VEC: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * Move a kinematic model using its character controller.
 * Computes collider movement, updates collider translation, and syncs the Three.js mesh.
 *
 * @param model - A ComplexModel with characterController and collider in userData
 * @param direction - Movement vector to apply
 * @param filterPredicate
 * @returns The computed movement vector after physics resolution
 */
export const moveController = (
  model: ComplexModel,
  direction: Vec3,
  filterPredicate?: (collider: object) => boolean
): Vec3 => {
  const { characterController, collider } = model.userData
  if (!characterController || !collider) return ZERO_VEC

  if (filterPredicate) {
    characterController.computeColliderMovement(
      collider,
      direction,
      undefined,
      undefined,
      filterPredicate
    )
  } else {
    characterController.computeColliderMovement(collider, direction)
  }
  const translation = characterController.computedMovement()
  const position = collider.translation()

  const nextPosition: Vec3 = {
    x: position.x + translation.x,
    y: position.y + translation.y,
    z: position.z + translation.z
  }

  collider.setTranslation(nextPosition)
  model.position.set(nextPosition.x, nextPosition.y, nextPosition.z)

  return translation
}
