import type { CoordinateTuple, AreaConfig } from '@webgamekit/threejs';

export interface TextureEditorConfig {
  preset?: string;
  area: {
    center: CoordinateTuple;
    size: CoordinateTuple;
  };
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
}



// Preset configurations matching ForestGame patterns
export const presets = {
  clouds: {
    name: 'Billboard Clouds',
    config: {
      area: {
        center: [0, 38, -195] as CoordinateTuple,
        size: [670, 33, 230] as CoordinateTuple,
      },
      textures: {
        baseSize: [90, 40, 0] as CoordinateTuple,
        sizeVariation: [50, 50, 0] as CoordinateTuple,
        rotationVariation: [0, 0, 0] as CoordinateTuple,
      },
      instances: {
        count: 25,
        pattern: 'random' as const,
        seed: 1000,
      },
    },
  },
  decals: {
    name: 'Scattered Decals',
    config: {
      area: {
        center: [0, -1, 20] as CoordinateTuple,
        size: [1000, 0, 0] as CoordinateTuple,
      },
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
    },
  },
  grass: {
    name: 'Dense Grass',
    config: {
      area: {
        center: [0, 0, 10] as CoordinateTuple,
        size: [50, 0, 50] as CoordinateTuple,
      },
      textures: {
        baseSize: [10, 10, 0] as CoordinateTuple,
        sizeVariation: [0, 0, 0] as CoordinateTuple,
        rotationVariation: [0, 0, 0] as CoordinateTuple,
      },
      instances: {
        count: 300,
        pattern: 'grid-jitter' as const,
        seed: 6000,
      },
    },
  },
};

// Default configuration
export const defaultConfig: TextureEditorConfig = {
  area: {
    center: [0, 0, 0] as CoordinateTuple,
    size: [50, 0, 50] as CoordinateTuple,
  },
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
};

// Config panel controls schema
export const configControls = {
  preset: {
    label: 'Preset',
    options: ['clouds', 'decals', 'grass'],
  },
  area: {
    center: {
      label: 'Center Position',
      component: 'CoordinateInput',
      min: { x: -500, y: -100, z: -500 },
      max: { x: 500, y: 100, z: 500 },
      step: { x: 1, y: 1, z: 1 },
    },
    size: {
      label: 'Area Size',
      component: 'CoordinateInput',
      min: { x: 1, y: 0, z: 0 },
      max: { x: 2000, y: 200, z: 2000 },
      step: { x: 1, y: 1, z: 1 },
    },
  },
  textures: {
    baseSize: {
      label: 'Base Size',
      component: 'CoordinateInput',
      min: { x: 1, y: 1, z: 0 },
      max: { x: 500, y: 500, z: 10 },
      step: { x: 1, y: 1, z: 0.1 },
    },
    sizeVariation: {
      label: 'Size Variation',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 200, y: 200, z: 10 },
      step: { x: 1, y: 1, z: 0.1 },
    },
    rotationVariation: {
      label: 'Rotation Variation',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: Math.PI * 2, y: Math.PI * 2, z: Math.PI * 2 },
      step: { x: 0.1, y: 0.1, z: 0.1 },
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
};

// Scene panel controls schema
export const sceneControls = {
  camera: {
    position: {
      label: 'Camera Position',
      component: 'CoordinateInput',
      min: { x: -200, y: 0, z: 10 },
      max: { x: 200, y: 200, z: 200 },
      step: { x: 5, y: 5, z: 5 },
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
