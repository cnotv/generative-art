import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, PostProcessingConfig } from "@webgamekit/threejs";
import * as THREE from "three";

import { getInstanceConfig } from "@webgamekit/threejs";

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
  color: 0xcccccc,
  opacity: 0.95,
  material: "MeshBasicMaterial",
  physic: false,
  transparent: true,
};

// Fixes presets
// const strictLayeringFix = {
//   depthWrite: false,
//   // renderOrder: i,
// };

// const hardEdgesFix = {
//   alphaTest: 0.5,
//   depthWrite: true,
// };

// const sameZFix = {
//   polygonOffset: true,
//   polygonOffsetFactor: -1,
// };

// const messyOverlapsFix = {
//   alphaHash: true,
// };

const glitchFix = {
  depthWrite: false,
  alphaTest: 0,
}

export const illustrations = {
  ...([
    illustrationCloud1Img,
    illustrationCloud2Img,
    illustrationCloud3Img,
    illustrationCloud4Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [texture]: {
      ...genericFlatConfig,
      // ...glitchFix,
      texture,
      size: [200, 100, 0],
      position: [0, -200, 0],
      instances: getInstanceConfig({
        show: true,
        amount: 1,
        spacing: 1,
        position: [0, 60, -80],
        positionVariation: [1000, 30, 50],
        sizeVariation: [0.5, 0.5, 0],
      })
    }
  }), {})),
  ...([
    illustrationMountain21Img,
    illustrationMountain22Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [texture]: {
      ...genericFlatConfig,
      ...glitchFix,
      texture,
      size: [120, 60, 0],
      position: [-1000, -20, -50],
      instances: getInstanceConfig({
        show: true,
        amount: 2,
        spacing: 1,
        position: [0, -20, -50],
        positionVariation: [1000, 0, 0],
        sizeVariation: [0.5, 0.5, 0],
      })
    }
  }), {})),
  ...([
    illustrationMountain11Img,
    illustrationMountain12Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [texture]: {
      ...glitchFix,
      ...genericFlatConfig,
      texture,
      size: [240, 120, 0],
      position: [-1000, -20, -100],
      instances: getInstanceConfig({
        show: true,
        amount: 2,
        spacing: 1,
        position: [0, -20, -100],
        positionVariation: [1000, 0, 0],
        sizeVariation: [0.5, 0.5, 0],
      })
    }
  }), {})),
  ...([
    illustrationTree11Img,
    illustrationTree12Img,
    illustrationTree13Img,
    illustrationTree14Img,
    illustrationTree15Img,
    illustrationTree16Img,
    illustrationTree17Img,
    illustrationTree18Img,
    illustrationTree19Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [texture]: {
      ...genericFlatConfig,
      ...glitchFix,
      texture,
      size: [30, 50, 0],
      position: [200, -1, -22],
      instances: getInstanceConfig({
        show: true,
        amount: 2,
        spacing: 10,
        position: [0, -1, -22],
        positionVariation: [500, 0, 0],
        sizeVariation: [0.5, 0.5, 0],
      })
    }
  }), {})),
  ...([
    illustrationTree21Img,
    illustrationTree22Img,
    illustrationTree23Img,
    illustrationTree24Img,
    illustrationTree25Img,
    illustrationTree26Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [texture]: {
      ...genericFlatConfig,
      ...glitchFix,
      texture,
      size: [20, 40, 0],
      position: [-200, -1, -10],
      instances: getInstanceConfig({
        show: true,
        amount: 3,
        spacing: 4,
        position: [0, -1, -10],
        positionVariation: [500, 0, 0],
        sizeVariation: [0.5, 0.5, 0],
      })
    }
  }), {})),
  grass: {
    texture: illustrationTree23Img,
    size: [10, 17, 0],
    position: [-200, -16, 10],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 200,
      spacing: 1,
      position: [0, -16, 10],
      positionVariation: [300, 0, 30],
      sizeVariation: [0.5, 0, 0],
    })
  },
  rock1: {
    texture: illustrationRock1Img,
    size: [7, 3, 0],
    position: [-200, -1, 5],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 20,
      spacing: 2,
      position: [0, -1, 0],
      positionVariation: [500, 0, 30],
      sizeVariation: [0.5, 0, 0],
    })
  },
  flower1: {
    texture: illustrationFlower1Img,
    size: [10, 6, 0],
    position: [-200, -1, 20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 20,
      spacing: 2,
      position: [0, -1, 20],
      positionVariation: [500, 0, 14],
      sizeVariation: [0.5, 0, 0],
    })
  },
  ...([
    illustrationBush11Img,
    illustrationBush12Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [texture]: {
      texture,
    size: [10, 5, 0],
    position: [-200, -1, 21],
      ...genericFlatConfig,
      instances: getInstanceConfig({
      show: true,
      amount: 3,
      spacing: 1,
      position: [0, -1, 21],
      positionVariation: [300, 0, 0],
      sizeVariation: [0.5, 0.2, 0],
      })
    }
  }), {})),
  flower2: {
    texture: illustrationFlower1Img,
    size: [10, 6, 0],
    position: [-200, -1, -18],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 10,
      spacing: 1,
      position: [0, -1, -18],
      positionVariation: [300, 0, 0],
      sizeVariation: [0.5, 0, 0],
    })
  },
  ...([
    illustrationBush11Img,
    illustrationBush12Img,
  ].reduce((acc, texture) => ({
    ...acc,
    [`${texture}-2`]: {
      texture,
    size: [15, 7, 0],
    position: [-200, -1, -18],
      ...genericFlatConfig,
      instances: getInstanceConfig({
      show: true,
      amount: 4,
      spacing: 2,
      position: [0, -1, -18],
      positionVariation: [300, 0, 10],
      sizeVariation: [0.5, 0.2, 0],
      })
    }
  }), {}))
};

// export const undergroundConfig = {
//   ...genericFlatConfig,
//   texture: illustrationUndergroundImg,
//   size: [10, 10, 0],
// };

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

// Dynamic area population example
export const dynamicFlowerConfig = {
  texture: illustrationFlower1Img,
  size: [8, 5, 0] as CoordinateTuple,
  ...genericFlatConfig,
  area: {
    center: [50, -1, 15] as CoordinateTuple,
    size: [80, 0, 20] as CoordinateTuple,
    count: 15,
    pattern: 'grid-jitter' as const,
    seed: 54321
  }
};
