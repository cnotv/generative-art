import cloudTexture from "@/assets/images/goomba/cloud.png";
import hillTexture from "@/assets/images/goomba/hill.png";
import fireTexture from "@/assets/images/goomba/fire.png";
import type { SetupConfig } from "@webgamekit/threejs";

export const config = {
  camera: {
    position: {
      x: 40,
      y: 20,
      z: 150,
    },
    fov: 80,
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  game: {
    helper: false,
    speed: 2,
  },
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
  blocks: {
    helper: false,
    size: 30,
    spacing: 150,
  },
  player: {
    helper: true,
    speed: 25,
    maxJump: 100,
    heightOffset: 10,
    collisionThreshold: 38,
    jump: {
      height: 100,
      duration: 1000,
      isActive: false,
      velocity: 0,
      startTime: 0,
    },
  },
  backgrounds: {
    textureAreaLayers: [
      {
        name: 'cloud',
        texture: cloudTexture,
        baseSize: [200, 80, 0] as [number, number, number],
        center: [0, 130, -300] as [number, number, number],
        size: [4800, 40, 0] as [number, number, number],
        density: 3,
        seed: 1000,
        speed: 2,
        opacity: 0.5,
      },
      {
        name: 'cloud',
        texture: cloudTexture,
        baseSize: [200, 80, 0] as [number, number, number],
        center: [0, 150, -100] as [number, number, number],
        size: [4800, 40, 0] as [number, number, number],
        density: 2.5,
        seed: 2000,
        speed: 2,
        opacity: 0.5,
      },
      {
        name: 'cloud',
        texture: cloudTexture,
        baseSize: [200, 80, 0] as [number, number, number],
        center: [0, 140, 20] as [number, number, number],
        size: [4800, 20, 0] as [number, number, number],
        density: 2.5,
        seed: 3000,
        speed: 2,
        opacity: 0.7,
      },
      {
        name: 'hill',
        texture: hillTexture,
        baseSize: [1000, 1000, 0] as [number, number, number],
        sizeVariation: [0, 140, 0] as [number, number, number],
        center: [0, -400, -800] as [number, number, number],
        size: [8000, 140, 0] as [number, number, number],
        density: 0.875,
        seed: 4000,
        speed: 2,
        opacity: 0.5,
      },
    ],
    layers: [
      {
        texture: fireTexture,
        speed: 2,
        size: 12,
        ratio: 1,
        xVariation: 100,
        yPosition: 0,
        yVariation: 0,
        zVariation: 50,
        zPosition: -70,
        count: 10,
        spacing: 100,
        opacity: 0.4,
      },
      {
        texture: fireTexture,
        speed: 2,
        size: 12,
        ratio: 1,
        xVariation: 100,
        yPosition: 0,
        yVariation: 0,
        zVariation: 30,
        zPosition: 100,
        count: 10,
        spacing: 300,
        opacity: 0.4,
      },
    ],
  },
};

export const configControls = {
  camera: {
    fov: {},
    position: {
      x: {},
      y: {},
      z: {},
    },
    rotation: {
      x: {step: 0.01},
      y: {step: 0.01},
      z: {step: 0.01},
    },
  },
  game: {
    helper: { boolean: false },
    speed: { min: 0.5, max: 3 },
  },
  player: {
    helper: { boolean: false },
    speed: { min: 1, max: 50 },
    maxJump: {},
    jump: {
      height: {},
      duration: {},
    },
  },
};

export const setupConfig = {
  camera: config.camera as any,
  scene: {
    backgroundColor: 0x87ceeb,
  },
  ground: false,
  sky: false, // Disable sky sphere to avoid hiding UI elements
  lights: {
    directional: {
      intensity: config.directional.intensity * 1.5,
    },
  },
  orbit: false,
} as SetupConfig;
