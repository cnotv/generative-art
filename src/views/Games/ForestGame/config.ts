import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, PostProcessingConfig } from "@webgamekit/threejs";
import * as THREE from "three";

import { getInstanceConfig } from "@webgamekit/threejs";

// Assets
import jumpSound from "@/assets/audio/jump.wav";
import groundImg from "@/assets/images/illustrations/ground.webp";
import illustrationTree11Img from "@/assets/images/illustrations/Tree1-1.webp";
import illustrationTree12Img from "@/assets/images/illustrations/Tree1-2.webp";
import illustrationTree13Img from "@/assets/images/illustrations/Tree1-3.webp";
import illustrationTree14Img from "@/assets/images/illustrations/Tree1-4.webp";
import illustrationTree15Img from "@/assets/images/illustrations/Tree1-5.webp";
import illustrationTree21Img from "@/assets/images/illustrations/Tree2-1.webp";
import illustrationTree22Img from "@/assets/images/illustrations/Tree2-2.webp";
import illustrationRock1Img from "@/assets/images/illustrations/Rock.webp";
import illustrationFlower1Img from "@/assets/images/illustrations/flowers1.webp";

const groundSize: CoordinateTuple = [1000, 100, 50]

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
    color: 0xaaaaaa,
  },
  movement: {
    requireGround: true,
    maxGroundDistance: 5,
    maxStepHeight: 0.5,
    characterRadius: 4,
    debug: false,
  },
  game: {
    distance: 0.08,
    speed: {
      movement: 1,
      turning: 4,
      jump: 3,
    },
    maxJump: 2,
  },
};

const genericFlatConfig = {
  receiveShadow: false,
  castShadow: false,
  color: 0xcccccc,
  opacity: 0.95,
  material: "MeshBasicMaterial",
  physic: false,
};

export const illustrations = {
  // background: {
  //   texture: illustrationBackgroundImg,
  //   size: [200, 200, 0],
  //   position: [-0, -15, -20],
  //   ...genericFlatConfig,
  //   opacity: 0.5,
  // },
  'tree1-1': {
    texture: illustrationTree12Img,
    size: [30, 60, 0],
    position: [200, 0, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 15,
      spacing: 1,
      position: [0, -5, -20],
      positionVariation: [500, 0, 10],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
  'tree1-2': {
    texture: illustrationTree12Img,
    size: [30, 60, 0],
    position: [200, 0, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 15,
      spacing: 1,
      position: [0, -5, -20],
      positionVariation: [500, 0, 10],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
  'tree1-3': {
    texture: illustrationTree13Img,
    size: [30, 60, 0],
    position: [200, 0, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 15,
      spacing: 1,
      position: [0, -5, -20],
      positionVariation: [500, 0, 10],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
  'tree1-4': {
    texture: illustrationTree14Img,
    size: [30, 60, 0],
    position: [200, 0, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 15,
      spacing: 1,
      position: [0, -5, -20],
      positionVariation: [500, 0, 10],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
  'tree1-5': {
    texture: illustrationTree15Img,
    size: [30, 60, 0],
    position: [200, 0, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 15,
      spacing: 1,
      position: [0, -5, -20],
      positionVariation: [500, 0, 10],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
  tree02: {
    texture: illustrationTree11Img,
    size: [30, 60, 0],
    position: [200, 0, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 50,
      spacing: 1,
      position: [0, -5, 0],
      positionVariation: [500, 0, 20],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
  // tree2: {
  //   texture: illustrationTree2Img,
  //   size: [30, 60, 0],
  //   position: [100, 0, -20],
  //   ...genericFlatConfig,
  //   instances: getInstanceConfig({
  //     show: true,
  //     amount: 100,
  //     spacing: 5,
  //     position: [0, -5, -100],
  //     positionVariation: [400, 0, 100],
  //     sizeVariation: [0.5, 0.5, 0],
  //     area: 10,
  //   }, groundSize)
  // },
  flower1: {
    texture: illustrationFlower1Img,
    size: [10, 5, 0],
    position: [100, 0, 10],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 200,
      spacing: 0.2,
      position: [0, -3, 5],
      positionVariation: [300, 0, 40],
      sizeVariation: [0.5, 0, 0],
    }, groundSize)
  },
  rock1: {
    texture: illustrationRock1Img,
    size: [10, 5, 0],
    position: [100, -1.5, 10],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 200,
      spacing: 0.2,
      position: [0, -1.5, 5],
      positionVariation: [300, 0, 40],
      sizeVariation: [0.5, 0.5, 0],
    }, groundSize)
  },
};

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
    size: groundSize,
    texture: groundImg,
    textureRepeat: [500, 30] as [number, number],
    color: 0xffffff,
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
    colorCorrection: { contrast: 1, saturation: 1, brightness: 1.0 },
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
    },
  },
  axisThreshold: 0.5,
};

export const assets = {
  jumpSound,
};
