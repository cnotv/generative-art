import * as THREE from 'three'
import {
  GROUND_COLOR,
  GROUND_RADIUS_MULTIPLIER,
  GROUND_SEGMENTS,
  GROUND_SHADOW_SPAN_MULTIPLIER
} from './config'
import type { RigGroundPlacement } from './types'

/**
 * Where the ground goes under a model: level with its lowest point, which for a model loaded in its
 * rest pose is the soles of its feet, centred under it and sized to it, since an uploaded model can
 * be a hundred times the scale of the default one.
 * @param model The model, still in its rest pose
 * @returns The placement, or null for a model with no geometry
 */
export const rigGroundPlacement = (model: THREE.Object3D): RigGroundPlacement | null => {
  const box = new THREE.Box3().setFromObject(model)
  if (box.isEmpty()) return null
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  return {
    center: new THREE.Vector3(sphere.center.x, box.min.y, sphere.center.z),
    radius: sphere.radius
  }
}

/**
 * A flat disc the model stands on, which takes its shadow.
 * @param placement From `rigGroundPlacement`
 * @returns The ground mesh, ready to add to the scene
 */
export const createRigGround = (placement: RigGroundPlacement): THREE.Mesh => {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(placement.radius * GROUND_RADIUS_MULTIPLIER, GROUND_SEGMENTS),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.copy(placement.center)
  ground.receiveShadow = true
  return ground
}

/**
 * Release a ground mesh's geometry and material once it is taken out of the scene.
 * @param ground The mesh from `createRigGround`
 */
export const disposeRigGround = (ground: THREE.Mesh): void => {
  ground.geometry.dispose()
  if (ground.material instanceof THREE.Material) ground.material.dispose()
}

/**
 * Make the model cast its shadow onto the ground. The scene's key light keeps its direction but
 * moves to look at the model, with a shadow camera sized to it: its default shadow camera is a few
 * units across, which a model authored in centimetres never falls inside.
 * @param light The scene's key light
 * @param model The model to cast shadows
 * @param placement From `rigGroundPlacement`
 */
export const fitShadowToModel = (
  light: THREE.DirectionalLight,
  model: THREE.Object3D,
  placement: RigGroundPlacement
): void => {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true
  })
  const span = placement.radius * GROUND_SHADOW_SPAN_MULTIPLIER
  const direction = light.position.clone().sub(light.target.position).normalize()
  light.target.position.copy(placement.center)
  light.target.updateMatrixWorld()
  light.position.copy(placement.center).addScaledVector(direction, span)
  Object.assign(light.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0,
    far: span * 2
  })
  light.shadow.camera.updateProjectionMatrix()
}
