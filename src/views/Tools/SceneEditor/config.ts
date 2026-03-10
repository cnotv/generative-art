import type { CoordinateTuple } from '@webgamekit/threejs';

export interface TextureProperties {
  baseSize: CoordinateTuple;
  sizeVariation: CoordinateTuple;
  rotationVariation: CoordinateTuple;
  count?: number;
  opacity?: number;
}

export interface SceneEditorConfig {
  preset?: string;
  selectedTexture?: string;
  area: {
    center: CoordinateTuple;
    size: CoordinateTuple;
  };
  textures: TextureProperties;
  textureProperties: {
    [filename: string]: Partial<TextureProperties>;
  };
  instances: {
    density: number;
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
        density: 15,
        pattern: 'random' as const,
        seed: 1000,
      },
    },
  },
  trees: {
    name: 'Scattered Trees',
    config: {
      area: {
        center: [0, -1, -20] as CoordinateTuple,
        size: [200, 0, 1] as CoordinateTuple,
      },
      textures: {
        baseSize: [7, 10, 0] as CoordinateTuple,
        sizeVariation: [5, 3, 0] as CoordinateTuple,
        rotationVariation: [0, 0, 0] as CoordinateTuple,
      },
      instances: {
        density: 20,
        pattern: 'random' as const,
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
        density: 200,
        pattern: 'grid-jitter' as const,
        seed: 6000,
      },
    },
  },
};

// Default configuration
export const defaultConfig: SceneEditorConfig = {
  area: {
    center: [0, 0, 0] as CoordinateTuple,
    size: [0, 0, 0] as CoordinateTuple,
  },
  textures: {
    baseSize: [20, 20, 0] as CoordinateTuple,
    sizeVariation: [10, 10, 0] as CoordinateTuple,
    rotationVariation: [0, 0, 0] as CoordinateTuple,
  },
  textureProperties: {},
  instances: {
    density: 0,
    pattern: 'random',
    seed: 1000,
  },
};

// Config panel controls schema
export const configControls = {
  preset: {
    label: 'Preset',
    options: ['clouds', 'trees', 'grass'],
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
      max: { x: 1000, y: 200, z: 1000 },
      step: { x: 1, y: 1, z: 1 },
    },
  },
  textures: {
    baseSize: {
      label: 'Base Size',
      component: 'CoordinateInput',
      min: { x: 1, y: 1, z: 0 },
      max: { x: 200, y: 200, z: 10 },
      step: { x: 1, y: 1, z: 0.1 },
    },
    sizeVariation: {
      label: 'Size Variation',
      component: 'CoordinateInput',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 50, y: 50, z: 50 },
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
    density: { min: 0, max: 200, step: 1 },
    pattern: {
      label: 'Distribution Pattern',
      options: ['random', 'grid', 'grid-jitter'],
    },
    seed: { min: 0, max: 10000, step: 1 },
  },
};

// Scene panel controls schema
export const sceneControls = {
  ground: {
    color: { color: true },
  },
  sky: {
    color: { color: true, label: 'Sky Color' },
  },
};

// Full element property schemas (used in Properties panel)
export const cameraSchema = {
  position: {
    component: 'CoordinateInput',
    label: 'Position',
    min: { x: -500, y: -500, z: -500 },
    max: { x: 500, y: 500, z: 500 },
    step: { x: 1, y: 1, z: 1 },
  },
  fov: { min: 10, max: 170, step: 1, label: 'FOV' },
  orbitTarget: {
    component: 'CoordinateInput',
    label: 'Orbit Target',
    min: { x: -500, y: -500, z: -500 },
    max: { x: 500, y: 500, z: 500 },
    step: { x: 1, y: 1, z: 1 },
  },
};

export const groundSchema = {
  color: { color: true, label: 'Color' },
  size: {
    component: 'CoordinateInput',
    label: 'Size',
    min: { x: 1, y: 0.001, z: 1 },
    max: { x: 5000, y: 100, z: 5000 },
    step: { x: 10, y: 0.01, z: 10 },
  },
};

export const lightsSchema = {
  ambient: {
    color: { color: true, label: 'Color' },
    intensity: { min: 0, max: 10, step: 0.1, label: 'Intensity' },
  },
  directional: {
    color: { color: true, label: 'Color' },
    intensity: { min: 0, max: 20, step: 0.1, label: 'Intensity' },
    position: {
      component: 'CoordinateInput',
      label: 'Position',
      min: { x: -500, y: 0, z: -500 },
      max: { x: 500, y: 500, z: 500 },
      step: { x: 1, y: 1, z: 1 },
    },
  },
};

export const skySchema = {
  color: { color: true, label: 'Color' },
  size: { min: 100, max: 5000, step: 100, label: 'Size' },
};
