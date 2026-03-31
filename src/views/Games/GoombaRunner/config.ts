import cloudTexture from '@/assets/images/goomba/cloud.png'
import hillTexture from '@/assets/images/goomba/hill.png'
import fireTexture from '@/assets/images/goomba/fire.png'
import type { SetupConfig } from '@webgamekit/threejs'

export const config = {
  camera: {
    position: {
      x: 0,
      y: 20,
      z: 150
    },
    fov: 80,
    rotation: {
      x: 0,
      y: 0,
      z: 0
    }
  },
  game: {
    helper: false,
    speed: 2
  },
  directional: {
    enabled: true,
    helper: false,
    intensity: 2
  },
  blocks: {
    helper: false,
    size: 30,
    spacing: 150
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
      startTime: 0
    }
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
        opacity: 0.5
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
        opacity: 0.5
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
        opacity: 0.7
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
        opacity: 0.5
      }
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
        opacity: 0.4
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
        opacity: 0.4
      }
    ]
  }
}

export const configControls = {
  game: {
    helper: { boolean: false },
    speed: { min: 0.5, max: 3 }
  },
  player: {
    helper: { boolean: false },
    speed: { min: 1, max: 50 },
    maxJump: {},
    jump: {
      height: {},
      duration: {}
    }
  }
}

export const textureAreaControls = {
  area: {
    center: {
      label: 'Center Position',
      component: 'CoordinateInput',
      min: { x: -5000, y: -500, z: -1000 },
      max: { x: 5000, y: 500, z: 1000 },
      step: { x: 10, y: 1, z: 10 }
    },
    size: {
      label: 'Area Size',
      component: 'CoordinateInput',
      min: { x: 1, y: 0, z: 0 },
      max: { x: 10000, y: 500, z: 1000 },
      step: { x: 10, y: 1, z: 10 }
    }
  },
  textures: {
    baseSize: {
      label: 'Base Size',
      component: 'CoordinateInput',
      min: { x: 1, y: 1, z: 0 },
      max: { x: 2000, y: 2000, z: 10 },
      step: { x: 10, y: 10, z: 0.1 }
    }
  },
  instances: {
    density: { min: 0, max: 50, step: 0.5, label: 'Density' },
    seed: { min: 0, max: 10000, step: 1, label: 'Seed' }
  },
  rendering: {
    opacity: { min: 0, max: 1, step: 0.05, label: 'Opacity' },
    speed: { min: 0, max: 10, step: 0.5, label: 'Speed' }
  }
}

export const setupConfig = {
  camera: config.camera as any,
  scene: {
    backgroundColor: 0x87ceeb
  },
  ground: false,
  sky: false, // Disable sky sphere to avoid hiding UI elements
  lights: {
    directional: {
      intensity: config.directional.intensity * 1.5
    }
  },
  orbit: { disabled: true }
} as SetupConfig
