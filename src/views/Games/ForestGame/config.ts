import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, PostProcessingConfig, AreaConfig } from "@webgamekit/threejs";
import * as THREE from "three";

import { generateAreaPositions } from "@webgamekit/threejs";

// Assets
import jumpSound from "@/assets/audio/jump.wav";

import illustrationCloud1Img from "@/assets/images/illustrations/cloud1.webp";
import illustrationCloud2Img from "@/assets/images/illustrations/cloud2.webp";
import illustrationCloud3Img from "@/assets/images/illustrations/cloud3.webp";
import illustrationCloud4Img from "@/assets/images/illustrations/cloud4.webp";

import illustrationMountain11Img from "@/assets/images/illustrations/Mountain1-1.webp";
import illustrationMountain12Img from "@/assets/images/illustrations/Mountain1-2.webp";
import illustrationMountain21Img from "@/assets/images/illustrations/Mountain2-1.webp";
import illustrationMountain22Img from "@/assets/images/illustrations/Mountain2-2.webp";

import illustrationTree11Img from "@/assets/images/illustrations/Tree1-1.webp";
import illustrationTree12Img from "@/assets/images/illustrations/Tree1-2.webp";
import illustrationTree13Img from "@/assets/images/illustrations/Tree1-3.webp";
import illustrationTree14Img from "@/assets/images/illustrations/Tree1-4.webp";
import illustrationTree15Img from "@/assets/images/illustrations/Tree1-5.webp";
import illustrationTree16Img from "@/assets/images/illustrations/Tree1-6.webp";
import illustrationTree17Img from "@/assets/images/illustrations/Tree1-7.webp";
import illustrationTree18Img from "@/assets/images/illustrations/Tree1-8.webp";
import illustrationTree19Img from "@/assets/images/illustrations/Tree1-9.webp";

import illustrationTree21Img from "@/assets/images/illustrations/Tree2-1.webp";
import illustrationTree22Img from "@/assets/images/illustrations/Tree2-2.webp";
import illustrationTree23Img from "@/assets/images/illustrations/Tree2-3.webp";
import illustrationTree24Img from "@/assets/images/illustrations/Tree2-4.webp";
import illustrationTree25Img from "@/assets/images/illustrations/Tree2-5.webp";
import illustrationTree26Img from "@/assets/images/illustrations/Tree2-6.webp";

import illustrationRock1Img from "@/assets/images/illustrations/Rock.webp";
import illustrationFlower1Img from "@/assets/images/illustrations/flowers1.webp";
import illustrationBush11Img from "@/assets/images/illustrations/Bush1-1.webp";
import illustrationBush12Img from "@/assets/images/illustrations/Bush1-2.webp";

// import illustrationUndergroundImg from "@/assets/images/illustrations/underground.webp";

// import grassTextureImg from "@/assets/images/illustrations/ground.webp";

export const playerSettings = {
  model: {
    position: [0, -1, 0] as CoordinateTuple,
    rotation: [0, 0, 0] as CoordinateTuple,
    scale: [1, 1, 1] as CoordinateTuple,
    restitution: -10,
    boundary: 0.5,
    hasGravity: false,
    castShadow: true,
    material: "MeshLambertMaterial",
    color: 0xffffff,
  },
  movement: {
    requireGround: true,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 20,
    debug: false,
  },
  game: {
    distance: 0.5,
    speed: {
      movement: 2,
      turning: 4,
      jump: 4,
    },
    maxJump: 4,
  },
};

const genericFlatConfig = {
  receiveShadow: false,
  castShadow: false,
  color: 0x000000,
  // opacity: 0.95,
  material: "MeshBasicMaterial",
  physic: false,
  transparent: true,
};

const glitchFix = {
  depthWrite: false,
  alphaTest: 0,
}

export const setupConfig: SetupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 15, 0),
    disabled: true,
  },
  camera: {
    position: [0, 7, 35],
    lookAt: [0, 0, 0],
    fov: 80,
    up: new THREE.Vector3(0, 1, 0),
    near: 0.1,
    far: 1000,
    zoom: 1,
    focus: 10,
  },
  ground: {
    size: [1000, 100, 50],
    // texture: illustrationUndergroundImg,
    // textureRepeat: [50, 4] as [number, number],
    color: 0x98887d,
    // color: 0xcccccc,
  },
  sky: { size: 500, color: 0x00aaff },
  postprocessing: {
    // pixelate: { size: 5 },
    // bloom: { strength: 0.8, threshold: 0.2, radius: 1.0 },
    // fxaa: {},
    // dotScreen: { scale: 5, angle: Math.PI / 3, center: [0.2, 0.2] },
    // rgbShift: { amount: 0.005 },
    // film: { noiseIntensity: 5, grayscale: false },
    // glitch: {},
    // afterimage: {},
    // ssao: {},
    // vignette: { offset: 1.2, darkness: 1.3, color: 0x222222 },
    // colorCorrection: { contrast: 1, saturation: 1, brightness: 1.0 },
  } as PostProcessingConfig,
};

export const controlBindings = {
  mapping: {
    keyboard: {
      " ": "jump",
      a: "move-left",
      d: "move-right",
      w: "move-up",
      s: "move-down",
      p: "print-log",
    },
    gamepad: {
      // Buttons
      cross: "jump",
      "dpad-left": "move-left",
      "dpad-right": "move-right",
      "dpad-down": "move-down",
      "dpad-up": "move-up",
      "axis0-left": "move-left",
      "axis0-right": "move-right",
      "axis1-up": "move-up",
      "axis1-down": "move-down",
    },
    'faux-pad': {
      left: "move-left",
      right: "move-right",
      up: "move-up",
      down: "move-down",
      click: "jump",
    },
  },
  axisThreshold: 0.5,
};

export const assets = {
  jumpSound,
};

// Helper to randomly distribute positions across texture variants
// Generates positions and assigns them randomly to texture variants
const createTextureVariants = (
  textures: string[],
  baseConfig: any,
  area: AreaConfig
) => {
  // Generate positions for total count
  const allPositions = generateAreaPositions(area);
  const { sizeVariation, rotationVariation } = area;

  // Initialize arrays for each texture variant
  const variantData = textures.map(texture => ({
    texture,
    ...baseConfig,
    positions: [] as CoordinateTuple[],
    instances: [] as any[]
  }));

  // Randomly assign each position to a texture variant
  allPositions.forEach((position: CoordinateTuple) => {
    const randomIndex = Math.floor(Math.random() * textures.length);
    variantData[randomIndex].positions.push(position);

    // Generate instance with variations if specified
    if (sizeVariation || rotationVariation) {
      const sizeVariable = sizeVariation || [0, 0, 0] as CoordinateTuple;
      const rotVariable = rotationVariation || [0, 0, 0] as CoordinateTuple;

      variantData[randomIndex].instances.push({
        position,
        scale: [
          baseConfig.size[0] + (Math.random() - 0.5) * sizeVariable[0],
          baseConfig.size[1] + (Math.random() - 0.5) * sizeVariable[1],
          baseConfig.size[2] + (Math.random() - 0.5) * sizeVariable[2]
        ] as CoordinateTuple,
        rotation: [
          (Math.random() - 0.5) * rotVariable[0],
          (Math.random() - 0.5) * rotVariable[1],
          (Math.random() - 0.5) * rotVariable[2]
        ] as CoordinateTuple
      });
    }
  });

  // Clean up empty instances arrays
  return variantData.map(variant => ({
    ...variant,
    instances: variant.instances.length > 0 ? variant.instances : undefined
  }));
};

// Area population configurations for illustrations with pop-up animations
export const illustrationAreas = {
  clouds: createTextureVariants(
    [
      illustrationCloud1Img,
      illustrationCloud2Img,
      illustrationCloud3Img,
      illustrationCloud4Img,
    ],
    {
      size: [200, 100, 0] as CoordinateTuple,
      ...genericFlatConfig
    },
    {
      center: [0, 85, -80] as CoordinateTuple,
      size: [1000, 60, 100] as CoordinateTuple,
      count: 5,
      pattern: 'random' as const,
      seed: 1000,
      sizeVariation: [100, 50, 0] as CoordinateTuple
    }
  ),
  mountains1: createTextureVariants(
    [
      illustrationMountain11Img,
      illustrationMountain12Img,
    ],
    {
      size: [240, 120, 0] as CoordinateTuple,
      ...glitchFix,
      ...genericFlatConfig
    },
    {
      center: [0, -20, -100] as CoordinateTuple,
      size: [1000, 0, 0] as CoordinateTuple,
      count: 4,
      pattern: 'grid-jitter' as const,
      seed: 2000,
      sizeVariation: [120, 60, 0] as CoordinateTuple
    }
  ),
  mountains2: createTextureVariants(
    [
      illustrationMountain21Img,
      illustrationMountain22Img,
    ],
    {
      size: [120, 60, 0] as CoordinateTuple,
      ...glitchFix,
      ...genericFlatConfig
    },
    {
      center: [0, -20, -50] as CoordinateTuple,
      size: [1000, 0, 0] as CoordinateTuple,
      count: 4,
      pattern: 'grid-jitter' as const,
      seed: 3000,
      sizeVariation: [60, 30, 0] as CoordinateTuple
    }
  ),
  treesBack: createTextureVariants(
    [
      illustrationTree11Img,
      illustrationTree12Img,
      illustrationTree13Img,
      illustrationTree14Img,
      illustrationTree15Img,
      illustrationTree16Img,
      illustrationTree17Img,
      illustrationTree18Img,
      illustrationTree19Img,
    ],
    {
      size: [30, 50, 0] as CoordinateTuple,
      ...genericFlatConfig,
      ...glitchFix
    },
    {
      center: [0, -1, -20] as CoordinateTuple,
      size: [1000, 0, 0] as CoordinateTuple,
      count: 30,
      pattern: 'grid-jitter' as const,
      seed: 4000,
      sizeVariation: [15, 25, 0] as CoordinateTuple
    }
  ),
  treesFront: createTextureVariants(
    [
      illustrationTree21Img,
      illustrationTree22Img,
      illustrationTree23Img,
      illustrationTree24Img,
      illustrationTree25Img,
      illustrationTree26Img,
    ],
    {
      size: [20, 40, 0] as CoordinateTuple,
      ...genericFlatConfig,
      ...glitchFix
    },
    {
      center: [0, -1, -10] as CoordinateTuple,
      size: [1000, 0, 0] as CoordinateTuple,
      count: 40,
      pattern: 'grid-jitter' as const,
      seed: 5000,
      sizeVariation: [10, 20, 0] as CoordinateTuple
    }
  ),
  grass: [{
    texture: illustrationTree23Img,
    size: [10, 17, 0] as CoordinateTuple,
    ...genericFlatConfig,
    positions: generateAreaPositions({
      center: [0, -16, 10] as CoordinateTuple,
      size: [1000, 0, 30] as CoordinateTuple,
      count: 500,
      pattern: 'random' as const,
      seed: 6000
    })
  }],
  rocks: [{
    texture: illustrationRock1Img,
    size: [7, 3, 0] as CoordinateTuple,
    ...genericFlatConfig,
    positions: generateAreaPositions({
      center: [0, -1, 5] as CoordinateTuple,
      size: [1000, 0, 40] as CoordinateTuple,
      count: 60,
      pattern: 'random' as const,
      seed: 7000
    })
  }],
  bushesBack: createTextureVariants(
    [
      illustrationBush11Img,
      illustrationBush12Img,
    ],
    {
      size: [15, 10, 0] as CoordinateTuple,
      ...genericFlatConfig,
      ...glitchFix
    },
    {
      center: [0, -1, -15] as CoordinateTuple,
      size: [1000, 0, 0] as CoordinateTuple,
      count: 30,
      pattern: 'grid-jitter' as const,
      seed: 8000,
      sizeVariation: [5, 3, 0] as CoordinateTuple
    }
  ),
  bushesFront: createTextureVariants(
    [
      illustrationBush11Img,
      illustrationBush12Img,
    ],
    {
      size: [10, 7, 0] as CoordinateTuple,
      ...genericFlatConfig,
      ...glitchFix
    },
    {
      center: [0, -1, 20] as CoordinateTuple,
      size: [1000, 0, 0] as CoordinateTuple,
      count: 30,
      pattern: 'grid-jitter' as const,
      seed: 8000,
      sizeVariation: [5, 3, 0] as CoordinateTuple
    }
  ),
  flowersBack: [{
    texture: illustrationFlower1Img,
    size: [10, 7, 0] as CoordinateTuple,
    ...genericFlatConfig,
    positions: generateAreaPositions({
      center: [50, -1, -15] as CoordinateTuple,
      size: [1000, 0, 10] as CoordinateTuple,
      count: 25,
      pattern: 'grid-jitter' as const,
      seed: 9000
    })
  }],
  flowersFront: [{
    texture: illustrationFlower1Img,
    size: [8, 5, 0] as CoordinateTuple,
    ...genericFlatConfig,
    positions: generateAreaPositions({
      center: [50, -1, 20] as CoordinateTuple,
      size: [1000, 0, 10] as CoordinateTuple,
      count: 40,
      pattern: 'grid-jitter' as const,
      seed: 9000
    })
  }]
};
