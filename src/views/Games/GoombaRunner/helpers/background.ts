import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d";
import { getCube } from "@/utils/models";
import { isOoS } from "@/utils/threeJs";
import { config } from "../config";
import { preventGlitches, getSpeed } from "./setup";

export const addBackground = (
  scene: THREE.Scene,
  world: RAPIER.World,
  options: any,
  initialX?: number
) => {
  const getVariation = (variation: number) =>
    (Math.random() - 0.5) * 2 * (variation || 0);

  // Calculate height based on ratio (width / ratio = height)
  const width = options.size;
  const height = options.ratio ? width / options.ratio : width / 2; // fallback to 2:1 ratio

  const xPosition =
    initialX !== undefined
      ? initialX + getVariation(options.xVariation)
      : window.innerWidth / 2 + width + getVariation(options.xVariation);

  const finalPosition: [number, number, number] = [
    xPosition,
    options.yPosition + getVariation(options.yVariation),
    options.zPosition + getVariation(options.zVariation),
  ];

  // Create the main textured layer
  const result = getCube(scene, world, {
    texture: options.texture,
    size: [width, height, 0],
    position: finalPosition,
    castShadow: false,
    receiveShadow: false,
    color: 0xffffff,
    opacity: options.opacity,
    material: "MeshBasicMaterial",
  });

  preventGlitches(result, options);

  return result;
};

export const populateInitialBackgrounds = (
  scene: THREE.Scene,
  world: RAPIER.World,
  backgrounds: {
    mesh: THREE.Mesh;
    speed: number;
    fallAnimation?: {
      isActive: boolean;
      startTime: number;
      delay: number;
      fallSpeed: number;
      rotationSpeed: number;
    };
  }[]
) => {
  const viewportWidth = window.innerWidth;
  const extendedWidth = viewportWidth * 2; // Cover more area initially

  config.backgrounds.layers.forEach((background) => {
    const totalElements = Math.ceil(extendedWidth / background.spacing) + 1;

    for (let i = 0; i < totalElements; i++) {
      const initialX = i * background.spacing - extendedWidth / 2;
      const { mesh } = addBackground(scene, world, background, initialX);
      backgrounds.push({ mesh, speed: background.speed });
    }
  });
};

export const startBackgroundFalling = (
  backgrounds: {
    mesh: THREE.Mesh;
    speed: number;
    fallAnimation?: {
      isActive: boolean;
      startTime: number;
      delay: number;
      fallSpeed: number;
      rotationSpeed: number;
    };
  }[]
) => {
  const currentTime = Date.now();

  backgrounds.forEach((background) => {
    // Add random delay between 0-3 seconds for each background element
    const randomDelay = Math.random() * 3000;
    // Random fall speed between 50-150 pixels per second
    const randomFallSpeed = 50 + Math.random() * 100;
    // Random rotation speed
    const randomRotationSpeed = (Math.random() - 0.5) * 0.02;

    background.fallAnimation = {
      isActive: false, // Will be activated after delay
      startTime: currentTime,
      delay: randomDelay,
      fallSpeed: randomFallSpeed,
      rotationSpeed: randomRotationSpeed,
    };
  });
};

export const updateFallingBackgrounds = (
  deltaTime: number,
  backgrounds: {
    mesh: THREE.Mesh;
    speed: number;
    fallAnimation?: {
      isActive: boolean;
      startTime: number;
      delay: number;
      fallSpeed: number;
      rotationSpeed: number;
    };
  }[],
  scene: THREE.Scene
) => {
  const currentTime = Date.now();

  for (let i = backgrounds.length - 1; i >= 0; i--) {
    const background = backgrounds[i];

    if (background.fallAnimation) {
      const fallData = background.fallAnimation;
      const elapsed = currentTime - fallData.startTime;

      // Check if delay has passed and activate falling
      if (!fallData.isActive && elapsed >= fallData.delay) {
        fallData.isActive = true;
      }

      // Apply falling animation if active
      if (fallData.isActive) {
        // Move downward
        background.mesh.position.y -= fallData.fallSpeed * deltaTime;

        // Add rotation for more dynamic effect
        background.mesh.rotation.z += fallData.rotationSpeed;

        // Remove background when it falls completely off screen
        if (background.mesh.position.y < -window.innerHeight) {
          scene.remove(background.mesh);
          backgrounds.splice(i, 1);
        }
      }
    }
  }
};

export const createBackgrounds = (
  scene: THREE.Scene,
  world: RAPIER.World,
  backgrounds: any[],
  backgroundTimers: number[],
  gameScore: number
) => {
  // Dynamic background generation - create new backgrounds when needed based on speed
  config.backgrounds.layers.forEach((backgroundConfig, layerIndex) => {
    const currentSpeed = getSpeed(backgroundConfig.speed, gameScore);
    const adjustedSpacing = backgroundConfig.spacing / getSpeed(1, gameScore); // Adjust spacing based on overall game speed

    // Check if we need to generate a new background element for this layer
    backgroundTimers[layerIndex] += currentSpeed;

    if (backgroundTimers[layerIndex] >= adjustedSpacing) {
      backgroundTimers[layerIndex] = 0; // Reset timer
      const { mesh } = addBackground(scene, world, backgroundConfig);
      backgrounds.push({ mesh, speed: backgroundConfig.speed });
    }
  });
};

export const moveBackgrounds = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  backgrounds: any[],
  gameScore: number
) => {
  // Move backgrounds and remove off-screen ones
  for (let i = backgrounds.length - 1; i >= 0; i--) {
    const background = backgrounds[i];

    // Only move horizontally if not falling
    if (!background.fallAnimation || !background.fallAnimation.isActive) {
      background.mesh.position.x -= getSpeed(background.speed, gameScore);
    }

    // Remove when element is completely outside the camera cone vision (only if not falling)
    if (
      (!background.fallAnimation || !background.fallAnimation.isActive) &&
      isOoS(camera, background)
    ) {
      scene.remove(background.mesh);
      backgrounds.splice(i, 1);
    }
  }
};
