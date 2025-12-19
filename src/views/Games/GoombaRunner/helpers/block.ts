import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getModel } from "@webgamekit/threejs";
import { config } from "../config";
import { getSpeed } from "./setup";

export const addBlock = async (
  scene: THREE.Scene,
  position: [number, number],
  world: RAPIER.World,
  physics?: any
) => {
  // Load sand block model
  const sandBlockModel = await getModel(scene, world, "sand_block.glb", {
    scale: [0.15, 0.15, 0.15],
    restitution: 0,
    position: [position[0], position[1], 0],
    type: "kinematicPositionBased", // Changed from "fixed" to allow movement
    hasGravity: false,
  });

  const mesh = sandBlockModel;
  mesh.castShadow = true;
  mesh.position.set(position[0], position[1], 0);

  if (physics) {
    // Create character controller for controlled movement
    const characterController = physics.world.createCharacterController(0.01);
    characterController.setApplyImpulsesToDynamicBodies(true);

    // Create collider for the block
    const colliderDesc = physics.RAPIER.ColliderDesc.cuboid(15, 15, 15).setTranslation(
      position[0],
      position[1],
      0
    );
    const collider = physics.world.createCollider(colliderDesc);

    // Store collider reference in mesh userData
    mesh.userData.collider = collider;
    mesh.userData.characterController = characterController;

    return { mesh, characterController, collider };
  }

  return { mesh };
};

export const moveBlock = (
  obstacle: { mesh: THREE.Mesh; characterController: any; collider: any },
  physics: any,
  gameScore: number
) => {
  const { mesh, characterController, collider } = obstacle;

  // Use character controller to move the block
  const speed = getSpeed(config.game.speed, gameScore);
  const moveVector = new physics.RAPIER.Vector3(-speed, 0, 0);

  characterController.computeColliderMovement(collider, moveVector);
  const translation = characterController.computedMovement();
  const position = collider.translation();

  position.x += translation.x;
  position.y += translation.y;
  position.z += translation.z;

  collider.setTranslation(position);

  // Sync Three.js mesh with Rapier collider
  mesh.position.set(position.x, position.y, position.z);
};

export const removeBlock = (
  obstacle: { mesh: THREE.Mesh; characterController: any; collider: any },
  obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[],
  index: number,
  scene: THREE.Scene,
  physics: any
) => {
  const { mesh, collider } = obstacle;

  // Remove from scene and physics world (scoring now happens when block passes behind player)
  scene.remove(mesh);
  physics.world.removeCollider(collider, true);

  // Remove from obstacles array
  obstacles.splice(index, 1);
};

export const moveBlocks = (
  obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[],
  physics: any,
  gameScore: number,
  player: THREE.Mesh,
  scene: THREE.Scene,
  onScore: (points: number) => void
) => {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];

    // Move the block
    moveBlock(obstacle, physics, gameScore);

    // Award score when block passes behind Goomba (only once per block)
    if (
      !obstacle.mesh.userData.scored &&
      obstacle.mesh.position.x < player.position.x - 20
    ) {
      obstacle.mesh.userData.scored = true; // Mark as scored
      onScore(10);
    }

    // Check if block should be removed and remove it
    if (obstacle.mesh.position.x < -300 - config.blocks.size) {
      removeBlock(obstacle, obstacles, i, scene, physics);
    }
  }
};

export const resetObstacles = (
  obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[],
  scene: THREE.Scene,
  physics: any
) => {
  // Remove all obstacles from scene and physics
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    scene.remove(obstacle.mesh);
    physics.world.removeCollider(obstacle.collider, true);
  }
  obstacles.length = 0;
};

export const createCubes = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  physics: any,
  obstacles: { mesh: THREE.Mesh; characterController: any; collider: any }[]
) => {
  const position: [number, number] = [
    config.blocks.size * 10,
    (config.blocks.size / 2) * Math.floor(Math.random() * 3) + 15,
  ];
  const { mesh, characterController, collider } = await addBlock(
    scene,
    position,
    world,
    physics
  );
  obstacles.push({ mesh, characterController, collider });
};
