import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getCube } from "@webgamekit/threejs";
import { config } from "../config";
import { preventGlitches, getSpeed } from "./setup";
import type { ComplexModel } from "@webgamekit/animation";

/**
 * Background element with mesh and movement properties
 */
export interface BackgroundElement {
  mesh: ComplexModel;
  speed: number;
  fallAnimation?: {
    isActive: boolean;
    startTime: number;
    delay: number;
    fallSpeed: number;
    rotationSpeed: number;
  };
}

/**
 * Calculate Out of Sight (OoS) status for background elements
 * @param camera
 * @param background
 */
const isOoS = (camera: THREE.PerspectiveCamera, background: {
  mesh: THREE.Mesh;
}) => {
  // Calculate removal distance based on camera cone vision and element depth
  const cameraPos = camera.position;
  const elementDepth = Math.abs(background.mesh.position.z - cameraPos.z);

  // Account for camera field of view cone - wider cone for farther elements
  const fov = camera.fov * (Math.PI / 180); // Convert to radians
  const aspect = window.innerWidth / window.innerHeight;
  const coneWidth = 2 * Math.tan(fov / 2) * elementDepth * aspect;

  // Add significant offset for safe removal (element width + cone width + buffer)
  let elementWidth = 200; // Default fallback
  if (background.mesh.geometry?.boundingBox) {
    elementWidth = background.mesh.geometry.boundingBox.max.x - background.mesh.geometry.boundingBox.min.x;
  } else {
    // Compute bounding box if not available
    background.mesh.geometry.computeBoundingBox();
    if (background.mesh.geometry.boundingBox) {
      elementWidth = background.mesh.geometry.boundingBox.max.x - background.mesh.geometry.boundingBox.min.x;
    }
  }
  const removalOffset = (coneWidth / 2) + elementWidth + 500; // Extra 500 units buffer

  return background.mesh.position.x < cameraPos.x - removalOffset
}

export const addBackground = (
  scene: THREE.Scene,
  world: RAPIER.World,
  options: any,
  initialX?: number
): ComplexModel => {
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
  backgrounds: BackgroundElement[]
) => {
  const viewportWidth = window.innerWidth;
  const extendedWidth = viewportWidth * 2; // Cover more area initially

  config.backgrounds.layers.forEach((background) => {
    const totalElements = Math.ceil(extendedWidth / background.spacing) + 1;

    for (let i = 0; i < totalElements; i++) {
      const initialX = i * background.spacing - extendedWidth / 2;
      const mesh = addBackground(scene, world, background, initialX);
      backgrounds.push({ mesh, speed: background.speed });
    }
  });
};

export const startBackgroundFalling = (
  backgrounds: BackgroundElement[]
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
  backgrounds: BackgroundElement[],
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
  backgrounds: BackgroundElement[],
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
      const mesh = addBackground(scene, world, backgroundConfig);
      backgrounds.push({ mesh, speed: backgroundConfig.speed });
    }
  });
};

export const moveBackgrounds = (
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  backgrounds: BackgroundElement[],
  gameScore: number
) => {
  // Move backgrounds and remove off-screen ones
  for (let i = backgrounds.length - 1; i >= 0; i--) {
    const background = backgrounds[i];

    // Safety check - skip if mesh is undefined
    if (!background || !background.mesh) {
      backgrounds.splice(i, 1);
      continue;
    }

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

export const resetBackgrounds = (
  scene: THREE.Scene,
  world: RAPIER.World,
  backgrounds: BackgroundElement[]
) => {
  for (let i = backgrounds.length - 1; i >= 0; i--) {
    const background = backgrounds[i];
    scene.remove(background.mesh);
  }
  backgrounds.length = 0;

  // Repopulate backgrounds for restart
  populateInitialBackgrounds(scene, world, backgrounds);
};
