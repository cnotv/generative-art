import type { CoordinateTuple } from '@webgamekit/animation';

export const GLOBAL_SCENE_DEFAULTS = {
  global: {
    frameRate: 60,
  },
  orbit: {
    disabled: false,
  },
  postprocessing: {
    bloom: {
      enabled: false,
      strength: 1.5,
      threshold: 0.5,
      radius: 0.5,
    },
    vignette: {
      enabled: false,
      offset: 0.5,
      darkness: 0.5,
    },
  },
};

export const SCENE_DEFAULTS = {
  camera: {
    position: [0, 20, 150] as CoordinateTuple,
    fov: 75,
    distance: 75,
    orbitTarget: [0, 0, 0] as CoordinateTuple,
  },
  ground: {
    size: [1000, 0.01, 1000] as CoordinateTuple,
    position: [1, -1, 1] as CoordinateTuple,
    color: 0x333333,
    textureRepeat: [10, 10] as [number, number],
    textureOffset: [0, 0] as [number, number],
  },
  lights: {
    ambient: {
      color: 0xffffff,
      intensity: 2,
    },
    directional: {
      color: 0xffffff,
      intensity: 4.0,
      position: [20, 30, 20] as CoordinateTuple,
      castShadow: true,
    },
  },
  sky: {
    color: 0xaaaaff,
    size: 1000,
  },
  scene: {
    background: 0xbfd1e5,
  },
};
