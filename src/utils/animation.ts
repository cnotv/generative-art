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
  actions: Record<string, THREE.AnimationAction>,
  delta: number = 0,
  speed: number = 0,
) => {
  const coefficient = 0.1
  if (delta) {
    mixer.update(delta * speed * coefficient)
    actions.run.play()
  } else {
    actions.run.stop()
  }
}
