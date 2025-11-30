import * as THREE from "three";
import type { Ref } from "vue";
import { config } from "./config";
import {
  populateInitialBackgrounds,
  updateFallingBackgrounds,
  createBackgrounds,
  moveBackgrounds,
  resetBackgrounds,
} from "./helpers/background";
import { moveBlocks, resetObstacles, createCubes } from "./helpers/block";
import { moveGround, resetGround, getGround } from "./helpers/ground";
import {
  ensurePlayerAboveGround,
  movePlayer,
  handleJump,
  handleArcMovement,
  checkCollisions,
  updateExplosionParticles,
  updatePlayerAnimation,
  resetPlayer,
  type PlayerMovement,
} from "./helpers/player";
import {
  isGameStart,
  isGamePlaying,
  getGameScore,
  incrementGameScore,
} from "./helpers/game";
import { updateAnimation } from "@/utils/animation";
import { getSpeed, initPhysics } from "./helpers/setup";
import { createPlayer } from "./helpers/player";

const addHorizonLine = (scene: THREE.Scene) => {
  // Create a dark grey horizontal bar/line for cartoonish horizon effect
  const horizonGeometry = new THREE.BoxGeometry(4000, 3, 2); // Wide, thin bar
  const horizonMaterial = new THREE.MeshBasicMaterial({
    color: 0x333333, // Dark grey
    transparent: true,
    opacity: 0.8,
  });

  const horizonLine = new THREE.Mesh(horizonGeometry, horizonMaterial);

  // Position the horizon line slightly above the ground level
  horizonLine.position.set(0, 11, -200); // Y=11 for horizon height, Z back a bit for depth
  horizonLine.receiveShadow = false;
  horizonLine.castShadow = false;

  scene.add(horizonLine);
  return horizonLine; // Return the horizon line so we can manipulate it during jumps
};

const createTimeline = async ({
  scene,
  getDelta,
  world,
  shouldClearObstacles,
  camera,
  uiStore,
  endGame,
}: {
  scene: THREE.Scene;
  getDelta: () => number;
  world: any;
  shouldClearObstacles: Ref<boolean>;
  camera: THREE.PerspectiveCamera;
  uiStore: any;
  endGame: () => void;
}) => {
  const { physics, physicsHelper } = await initPhysics(scene);
  const { player, playerController, model } = await createPlayer(
    scene,
    physics,
    world
  );

  const obstacles: any[] = [];
  const backgrounds: any[] = [];
  const groundTexture = getGround(scene, physics);
  const playerMovement: PlayerMovement = { forward: 0, right: 0, up: 0 };
  const backgroundTimers = config.backgrounds.layers.map(() => 0);
  const loggedCollisions = new Set<string>();

  let backgroundsPopulated = false;
  const horizonLine = addHorizonLine(scene);

  return [
    {
      name: "Cleanup and reset",
      action: () => {
        if (physicsHelper) physicsHelper.update();
        updateExplosionParticles(scene, getDelta());
      },
    },
    {
      name: "Reset background",
      action: () => {
        if (isGameStart() && !backgroundsPopulated) {
          populateInitialBackgrounds(scene, world, backgrounds);
          backgroundsPopulated = true;
        }
        updateFallingBackgrounds(getDelta(), backgrounds, scene);
        if (shouldClearObstacles.value) {
          resetObstacles(obstacles, scene, physics);
          resetBackgrounds(scene, world, backgrounds);
          backgroundsPopulated = true;
          resetPlayer(player, scene);
          resetGround(groundTexture);
          shouldClearObstacles.value = false;
        }
      },
    },
    {
      name: "Generate cubes",
      frequency: config.blocks.spacing,
      action: async () => {
        if (!isGamePlaying()) return;
        await createCubes(scene, world, physics, obstacles);
      },
    },
    {
      name: "Move ground",
      action: () => {
        moveGround(groundTexture, isGamePlaying(), getGameScore());
      },
    },
    {
      name: "Move background",
      action: () => {
        if (isGamePlaying()) {
          createBackgrounds(
            scene,
            world,
            backgrounds,
            backgroundTimers,
            getGameScore()
          );
          moveBackgrounds(scene, camera, backgrounds, getGameScore());
        }
      },
    },
    {
      name: "Make Goomba run",
      action: () => {
        ensurePlayerAboveGround(player);
        movePlayer(
          player,
          playerController,
          physics,
          playerMovement,
          isGamePlaying(),
          config
        );
        handleJump(player, isGamePlaying(), uiStore, camera, horizonLine, config);
        handleArcMovement(player);
        checkCollisions(
          player,
          obstacles,
          backgrounds,
          scene,
          endGame,
          loggedCollisions,
          config
        );
        updatePlayerAnimation(
          model,
          isGamePlaying(),
          getGameScore(),
          getDelta,
          updateAnimation,
          getSpeed,
          config
        );
      },
    },

    {
      name: "Move obstacles",
      action: () => {
        if (!isGamePlaying()) return;
        moveBlocks(
          obstacles,
          physics,
          getGameScore(),
          player,
          scene,
          (points) => incrementGameScore(points)
        );
      },
    },
  ];
};

export { createTimeline };
