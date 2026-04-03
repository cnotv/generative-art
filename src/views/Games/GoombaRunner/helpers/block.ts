import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getModel, moveController } from '@webgamekit/threejs'
import { config } from '../config'
import { getSpeed, type RapierPhysicsObject } from './setup'

interface ObstacleState {
  counter: number
  group: THREE.Group | null
}

const obstacleState: ObstacleState = { counter: 0, group: null }

export interface Obstacle {
  mesh: THREE.Mesh
  characterController: RAPIER.KinematicCharacterController
  collider: RAPIER.Collider
}

export const resetObstacleCounter = () => {
  obstacleState.counter = 0
}

export const createObstaclesGroup = (scene: THREE.Scene): THREE.Group => {
  obstacleState.group = new THREE.Group()
  obstacleState.group.name = 'Obstacles'
  scene.add(obstacleState.group)
  return obstacleState.group
}

export const addBlock = async (
  scene: THREE.Scene,
  position: [number, number],
  world: RAPIER.World,
  physics?: RapierPhysicsObject
) => {
  // Load sand block model
  const sandBlockModel = await getModel(scene, world, 'sand_block.glb', {
    scale: [0.15, 0.15, 0.15],
    restitution: 0,
    position: [position[0], position[1], 0],
    type: 'kinematicPositionBased', // Changed from "fixed" to allow movement
    hasGravity: false
  })

  const mesh = sandBlockModel
  mesh.name = `obstacle-${obstacleState.counter}`
  obstacleState.counter += 1
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  mesh.position.set(position[0], position[1], 0)

  // Move from scene root into obstacles group
  if (obstacleState.group) {
    scene.remove(mesh)
    obstacleState.group.add(mesh)
  }

  if (physics) {
    // Create character controller for controlled movement
    const characterController = physics.world.createCharacterController(0.01)
    characterController.setApplyImpulsesToDynamicBodies(true)

    // Create collider for the block
    const colliderDesc = physics.RAPIER.ColliderDesc.cuboid(15, 15, 15).setTranslation(
      position[0],
      position[1],
      0
    )
    const collider = physics.world.createCollider(colliderDesc)

    // Store collider reference in mesh userData
    mesh.userData.collider = collider
    mesh.userData.characterController = characterController

    return { mesh, characterController, collider }
  }

  return { mesh }
}

export const moveBlock = (obstacle: Obstacle, gameScore: number) => {
  const speed = getSpeed(config.game.speed, gameScore)
  moveController(obstacle.mesh, { x: -speed, y: 0, z: 0 })
}

export const removeBlock = (
  obstacle: Obstacle,
  obstacles: Obstacle[],
  index: number,
  physics: RapierPhysicsObject
) => {
  const { mesh, collider } = obstacle

  // Remove from group (or scene) and physics world
  if (obstacleState.group) {
    obstacleState.group.remove(mesh)
  }
  physics.world.removeCollider(collider, true)

  // Remove from obstacles array
  obstacles.splice(index, 1)
}

interface MoveBlocksOptions {
  obstacles: Obstacle[]
  physics: RapierPhysicsObject
  gameScore: number
  player: THREE.Mesh
  onScore: (points: number) => void
}

export const moveBlocks = ({
  obstacles,
  physics,
  gameScore,
  player,
  onScore
}: MoveBlocksOptions) => {
  obstacles.reduceRight((_, obstacle, index) => {
    // Move the block
    moveBlock(obstacle, gameScore)

    // Award score when block passes behind Goomba (only once per block)
    if (!obstacle.mesh.userData.scored && obstacle.mesh.position.x < player.position.x - 20) {
      obstacle.mesh.userData.scored = true // Mark as scored
      onScore(10)
    }

    // Check if block should be removed and remove it
    if (obstacle.mesh.position.x < -300 - config.blocks.size) {
      removeBlock(obstacle, obstacles, index, physics)
    }
    return null
  }, null)
}

export const resetObstacles = (
  obstacles: Obstacle[],
  _scene: THREE.Scene,
  physics: RapierPhysicsObject
) => {
  // Remove all obstacles from group and physics
  obstacles.reduceRight((_, obstacle, index) => {
    if (obstacleState.group) {
      obstacleState.group.remove(obstacle.mesh)
    }
    physics.world.removeCollider(obstacle.collider, true)
    obstacles.splice(index, 1)
    return null
  }, null)
  resetObstacleCounter()
}

export const createCubes = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  physics: RapierPhysicsObject,
  obstacles: Obstacle[]
) => {
  const position: [number, number] = [
    config.blocks.size * 10,
    (config.blocks.size / 2) * Math.floor(Math.random() * 3) + 15
  ]
  const { mesh, characterController, collider } = await addBlock(scene, position, world, physics)
  obstacles.push({ mesh, characterController, collider } as Obstacle)
}
