import * as THREE from 'three'
import { getModel } from '@webgamekit/threejs'
import type { ComplexModel } from '@webgamekit/threejs'
import { RUNNER_HEIGHT, RUNNER_MODEL_PATH } from '../config'

type World = Parameters<typeof getModel>[1]

/**
 * The stickman, scaled to a runner's height, with how far its origin sits above its feet. It
 * never touches the physics world: the loop writes its position straight onto the mesh, so its
 * collider is made a sensor that nothing can bump into.
 */
export const spawnRunner = async (
  scene: THREE.Scene,
  world: World
): Promise<{ runner: ComplexModel; footLift: number }> => {
  const runner = await getModel(scene, world, RUNNER_MODEL_PATH, {
    name: 'runner',
    position: [0, 0, 0],
    type: 'kinematicPositionBased',
    hasGravity: false,
    castShadow: true
  })
  runner.userData.collider?.setSensor(true)
  const bounds = new THREE.Box3().setFromObject(runner)
  const scale = RUNNER_HEIGHT / (bounds.max.y - bounds.min.y)
  runner.scale.multiplyScalar(scale)
  return { runner, footLift: -bounds.min.y * scale }
}
