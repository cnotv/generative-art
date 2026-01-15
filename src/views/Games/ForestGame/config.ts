import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, PostProcessingConfig } from "@webgamekit/threejs";
import * as THREE from "three";

import { getInstanceConfig } from "@webgamekit/threejs";

// Assets
import jumpSound from "@/assets/audio/jump.wav";
import illustrationMountain11Img from "@/assets/images/illustrations/Mountain1-1.webp";
import illustrationMountain12Img from "@/assets/images/illustrations/Mountain1-2.webp";
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
    characterRadius: 4,
    debug: false,
  },
  game: {
    distance: 0.5,
    speed: {
      movement: 2,
      turning: 4,
      jump: 3,
    },
    maxJump: 5,
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
  'mountain1-1': {
    ...genericFlatConfig,
    texture: illustrationMountain11Img,
    size: [120, 120, 0],
    position: [-1000, -20, -50],
    instances: getInstanceConfig({
      show: true,
      amount: 10,
      spacing: 1,
      position: [0, -20, -50],
      positionVariation: [1000, 0, 0],
      sizeVariation: [0.5, 0.5, 0],
    })
  },
  'mountain1-2': {
    ...genericFlatConfig,
    texture: illustrationMountain12Img,
    size: [220, 220, 0],
    position: [-1000, -20, -100],
      instances: getInstanceConfig({
      show: true,
      amount: 10,
      spacing: 1,
      position: [0, -20, -100],
      positionVariation: [1000, 0, 0],
      sizeVariation: [0.5, 0.5, 0],
    })
  },
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
      texture,
      size: [30, 50, 0],
      position: [200, -8, -25],
      ...genericFlatConfig,
      instances: getInstanceConfig({
        show: true,
        amount: 2,
        spacing: 10,
        position: [0, -8, -25],
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
      texture,
      size: [20, 40, 0],
      position: [-200, -8, -10],
      ...genericFlatConfig,
      instances: getInstanceConfig({
        show: true,
        amount: 3,
        spacing: 4,
        position: [0, -8, -10],
        positionVariation: [500, 0, 0],
        sizeVariation: [0.5, 0.5, 0],
      })
    }
  }), {})),
  flower1: {
    texture: illustrationFlower1Img,
    size: [14, 7, 0],
    position: [-200, -4, 5],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 20,
      spacing: 2,
      position: [0, -4, 0],
      positionVariation: [300, 0, 30],
      sizeVariation: [0.5, 0, 0],
    })
  },
  rock1: {
    texture: illustrationRock1Img,
    size: [10, 5, 0],
    position: [-200, -1.5, 5],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 20,
      spacing: 2,
      position: [0, -1.5, 0],
      positionVariation: [300, 0, 30],
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
    size: [20, 10, 0],
    position: [-200, -2, 5],
      ...genericFlatConfig,
      instances: getInstanceConfig({
      show: true,
      amount: 5,
      spacing: 2,
      position: [0, -2, 0],
      positionVariation: [300, 0, 30],
      sizeVariation: [0.5, 0, 0],
      })
    }
  }), {})),
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
    size: [1000, 100, 50],
    textureRepeat: [500, 30] as [number, number],
    color: 0x80b966,
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
    },
  },
  axisThreshold: 0.5,
};

export const assets = {
  jumpSound,
};
