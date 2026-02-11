import type { CoordinateTuple, AreaConfig } from '@webgamekit/threejs';

export interface TextureEditorConfig {
  textures: {
    baseSize: CoordinateTuple;
    sizeVariation: CoordinateTuple;
    rotationVariation: CoordinateTuple;
  };
  instances: {
    count: number;
    pattern: 'random' | 'grid' | 'grid-jitter';
    seed: number;
  };
  area: {
    center: CoordinateTuple;
    size: CoordinateTuple;
  };
  material: {
    type: string;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    alphaTest: number;
  };
}

// Preset configurations matching ForestGame patterns
export const presets = {
  clouds: {
    name: 'Billboard Clouds',
    config: {
      textures: {
        baseSize: [200, 100, 0] as CoordinateTuple,
        sizeVariation: [100, 50, 0] as CoordinateTuple,
        rotationVariation: [0, 0, 0] as CoordinateTuple,
      },
      instances: {
        count: 5,
        pattern: 'random' as const,
        seed: 1000,
      },
      area: {
        center: [0, 85, -80] as CoordinateTuple,
        size: [1000, 60, 100] as CoordinateTuple,
      },
      material: {
        type: 'MeshBasicMaterial',
        opacity: 0.95,
        transparent: true,
        depthWrite: false,
        alphaTest: 0,
      },
    },
  },
  decals: {
    name: 'Scattered Decals',
    config: {
      textures: {
        baseSize: [10, 7, 0] as CoordinateTuple,
        sizeVariation: [5, 3, 0] as CoordinateTuple,
        rotationVariation: [0, 0, 0] as CoordinateTuple,
      },
      instances: {
        count: 30,
        pattern: 'grid-jitter' as const,
        seed: 8000,
      },
      area: {
        center: [0, -1, 20] as CoordinateTuple,
        size: [1000, 0, 0] as CoordinateTuple,
      },
      material: {
        type: 'MeshBasicMaterial',
        opacity: 0.95,
        transparent: true,
        depthWrite: false,
        alphaTest: 0,
      },
    },
  },
  grass: {
    name: 'Dense Grass',
    config: {
      textures: {
        baseSize: [10, 17, 0] as CoordinateTuple,
        sizeVariation: [0, 0, 0] as CoordinateTuple,
        rotationVariation: [0, 0, 0] as CoordinateTuple,
      },
      instances: {
        count: 500,
        pattern: 'random' as const,
        seed: 6000,
      },
      area: {
        center: [0, -16, 10] as CoordinateTuple,
        size: [1000, 0, 30] as CoordinateTuple,
      },
      material: {
        type: 'MeshBasicMaterial',
        opacity: 0.95,
        transparent: true,
        depthWrite: false,
        alphaTest: 0,
      },
    },
  },
};

// Default configuration
export const defaultConfig: TextureEditorConfig = {
  textures: {
    baseSize: [20, 20, 0] as CoordinateTuple,
    sizeVariation: [10, 10, 0] as CoordinateTuple,
    rotationVariation: [0, 0, 0] as CoordinateTuple,
  },
  instances: {
    count: 20,
    pattern: 'random',
    seed: 1000,
  },
  area: {
    center: [0, 0, 0] as CoordinateTuple,
    size: [50, 0, 50] as CoordinateTuple,
  },
  material: {
    type: 'MeshBasicMaterial',
    opacity: 1,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.5,
  },
};

// Config panel controls schema
export const configControls = {
  textures: {
    baseSize: {
      x: { min: 1, max: 500, step: 1, label: 'Width' },
      y: { min: 1, max: 500, step: 1, label: 'Height' },
      z: { min: 0, max: 10, step: 0.1, label: 'Depth' },
    },
    sizeVariation: {
      x: { min: 0, max: 200, step: 1, label: 'Size Var X' },
      y: { min: 0, max: 200, step: 1, label: 'Size Var Y' },
      z: { min: 0, max: 10, step: 0.1, label: 'Size Var Z' },
    },
    rotationVariation: {
      x: { min: 0, max: Math.PI * 2, step: 0.1, label: 'Rot Var X' },
      y: { min: 0, max: Math.PI * 2, step: 0.1, label: 'Rot Var Y' },
      z: { min: 0, max: Math.PI * 2, step: 0.1, label: 'Rot Var Z' },
    },
  },
  instances: {
    count: { min: 1, max: 1000, step: 1 },
    pattern: {
      label: 'Distribution Pattern',
      options: ['random', 'grid', 'grid-jitter'],
    },
    seed: { min: 0, max: 10000, step: 1 },
  },
  area: {
    center: {
      x: { min: -500, max: 500, step: 10 },
      y: { min: -100, max: 100, step: 10 },
      z: { min: -500, max: 500, step: 10 },
    },
    size: {
      x: { min: 1, max: 2000, step: 10 },
      y: { min: 0, max: 200, step: 10 },
      z: { min: 1, max: 2000, step: 10 },
    },
  },
  material: {
    type: {
      label: 'Material Type',
      options: ['MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshStandardMaterial'],
    },
    opacity: { min: 0, max: 1, step: 0.05 },
    transparent: { label: 'Transparent' },
    depthWrite: { label: 'Depth Write' },
    alphaTest: { min: 0, max: 1, step: 0.05 },
  },
};

// Scene panel controls schema
export const sceneControls = {
  camera: {
    position: {
      x: { min: -200, max: 200, step: 5 },
      y: { min: 0, max: 200, step: 5 },
      z: { min: 10, max: 200, step: 5 },
    },
    fov: { min: 30, max: 120, step: 5 },
  },
  ground: {
    color: { color: true },
  },
  background: {
    color: { color: true },
  },
};
