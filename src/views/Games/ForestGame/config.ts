import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, PostProcessingConfig } from "@webgamekit/threejs";
import * as THREE from "three";

import { getInstanceConfig } from "@webgamekit/threejs";

// Assets
import jumpSound from "@/assets/audio/jump.wav";
import groundImg from "@/assets/images/illustrations/ground.png";
import illustrationTreeImg from "@/assets/images/illustrations/trees/evergreen_tree_3.png";
import illustrationGrassImg from "@/assets/images/illustrations/grass/grass_cluster_1.png";
import illustrationRockDudeImg from "@/assets/images/illustrations/rock_dude.png";

const groundSize: CoordinateTuple = [1000, 100, 1000]

export const chameleonConfig = {
  position: [0, -1, 0] as CoordinateTuple,
  scale: [0.03, 0.03, 0.03] as CoordinateTuple,
  restitution: -10,
  boundary: 0.5,
  // type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  animations: "chameleon_animations.fbx",
  material: "MeshLambertMaterial",
  materialColors: [0x99cc99],
};

export const mushroomConfig = {
  position: [0, -1, 0] as CoordinateTuple,
  rotation: [0, -180, 0] as CoordinateTuple,
  scale: [1, 1, 1] as CoordinateTuple,
  restitution: -10,
  boundary: 0.5,
  // type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  material: "MeshLambertMaterial",
  color: 0xaaaaaa,
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
  tree: {
    texture: illustrationTreeImg,
    size: [30, 60, 0],
    position: [100, 25, -20],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 100,
      spacing: 5,
      position: [0, 32, -100],
      positionVariation: [400, 0, 100],
      sizeVariation: [0.5, 0.5, 0],
      area: 10,
    }, groundSize)
  },
  grass: {
    texture: illustrationGrassImg,
    size: [5, 2.5, 0],
    position: [100, 0, -10],
    ...genericFlatConfig,
    instances: getInstanceConfig({
      show: true,
      amount: 1000,
      spacing: 2,
      position: [0, 0, -10],
      positionVariation: [400, 0, 50],
      sizeVariation: [0.5, 1, 0],
      area: 10,
    }, groundSize)
  },
  rockDude: {
    texture: illustrationRockDudeImg,
    size: [30, 35, 0],
    position: [-40, 14, 0],
    ...genericFlatConfig,
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
    textureRepeat: [500, 200] as [number, number],
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
    colorCorrection: { contrast: 1.2, saturation: 1.1, brightness: 1.0 },
  } as PostProcessingConfig,
};

export const gameSettings = {
  distance: 0.08,
  speed: {
    movement: 1,
    turning: 4,
    jump: 3,
  },
  maxJump: 2,
};

export const controlBindings = {
  mapping: {
    keyboard: {
      " ": "jump",
      a: "turn-left",
      d: "turn-right",
      w: "moving",
      s: "moving",
      p: "print-log",
    },
    gamepad: {
      // Buttons
      cross: "jump",
      "dpad-left": "turn-left",
      "dpad-right": "turn-right",
      "dpad-down": "moving",
      "dpad-up": "moving",
      "axis0-left": "turn-left",
      "axis0-right": "turn-right",
      "axis1-up": "moving",
      "axis1-down": "moving",
    },
    touch: {
      tap: "jump",
    },
  },
  axisThreshold: 0.5,
};

export const assets = {
  jumpSound,
};
