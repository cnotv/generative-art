import * as THREE from 'three';

export const getAnimationsModel = (mixer: THREE.AnimationMixer, model: Model, gltf: any) => {
  // Flip the model
  model.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI)
  // action.play()
  return {
    run: mixer.clipAction(gltf.animations[0]),
  }
}

/**
 * Update the animation of the model based on given time
 */
export const updateAnimation = (
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction,
  delta: number = 0,
  speed: number = 0,
) => {
  const coefficient = 0.1
  if (!action) return
  if (delta) {
    mixer.update(delta * speed * coefficient)
    action.play()
  } else {
    action.stop()
  }
}

/**
 * Move forward or backward if no collision is detected
 * @param player
 * @param dynamicBodies
 * @param distance
 * @param backwards
 */
export const moveForward = (
  element: AnimatedComplexModel,
  bodies: ComplexModel[],
  distance: number,
  backwards: boolean = false
) => {
  const collision = 2.5
  const oldPosition = element.mesh.position.clone() // Clone the current position

  // Calculate the forward vector
  const forward = new THREE.Vector3()
  element.mesh.getWorldDirection(forward)
  if (backwards) {
    forward.negate()
  }
  forward.multiplyScalar(distance)

  // Create a new position by adding the forward vector to the old position
  const newPosition = oldPosition.clone().add(forward)

  // Check for collisions with the new position
  const isColliding = bodies.some(({ mesh }) => {
    const difference = mesh.position.distanceTo(newPosition)
    return difference < collision // Adjust this value based on your collision detection needs
  })

  if (!isColliding) {
    // Update the model's position and the rigid body's translation if no collision is detected
    element.mesh.position.copy(newPosition)
    element.rigidBody.setTranslation(newPosition, true)
  }
}

export const moveJump = (
  element: AnimatedComplexModel,
  bodies: ComplexModel[],
  distance: number,
  height: number,
) => {
  const collision = 2.5
  const oldPosition = element.mesh.position.clone() // Clone the current position

  // Calculate the forward vector
  const forward = new THREE.Vector3()
  element.mesh.getWorldDirection(forward)
  forward.multiplyScalar(distance)

  // Create an upward vector
  const upward = new THREE.Vector3(0, height, 0)

  // Create a new position by adding the forward and upward vectors to the old position
  const newPosition = oldPosition.clone().add(upward)

  // Check for collisions with the new position
  const isColliding = bodies.some(({ mesh }) => {
    const difference = mesh.position.distanceTo(newPosition)
    return difference < collision // Adjust this value based on your collision detection needs
  })

  if (!isColliding) {
    // Update the model's position and the rigid body's translation if no collision is detected
    element.mesh.position.copy(newPosition)
    element.rigidBody.setTranslation(newPosition, true)
  }
}
