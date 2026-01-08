import * as THREE from 'three';
import { CoordinateTuple, ModelType } from '@webgamekit/animation';

// Re-export for convenience
export type { CoordinateTuple, ModelType } from '@webgamekit/animation';

export interface CommonOptions {
  boundary?: number;
  damping?: number;
  angular?: number;
  density?: number;
  dominance?: number;
  friction?: number;
  mass?: number;
  position?: CoordinateTuple;
  restitution?: number;
  rotation?: CoordinateTuple;
  size?: number | CoordinateTuple;
  type?: ModelType;
  weight?: number;
  enabledRotations?: [boolean, boolean, boolean];
}

export interface ModelOptions extends CommonOptions {
  color?: number;
  opacity?: number;
  reflectivity?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  transparent?: boolean;
  material?: typeof THREE.Material | string | boolean;
  rotation?: CoordinateTuple;
  scale?: CoordinateTuple;
  shape?: 'cuboid' | 'ball';
  castShadow?: boolean;
  receiveShadow?: boolean;
  hasGravity?: boolean;
  showHelper?: boolean;
  texture?: string;
  textures?: {
    random: boolean;
    list: THREE.Texture[];
  };
  origin?: { x?: number; y?: number; z?: number };
  clearcoat?: number;
  clearcoatRoughness?: number;
  ior?: number;
  thickness?: number;
  envMapIntensity?: number;
  animations?: string;
  materialColors?: number[];
}

export interface PhysicOptions extends CommonOptions {
  shape?: 'cuboid' | 'ball';
}

export interface ToolsConfig {
  stats?: {
    init: any,
    start: any,
    end: any
  };
  route?: any;
  canvas: HTMLCanvasElement;
}

export interface LightsConfig {
  ambient?: {
    color?: number;
    intensity?: number;
  };
  directional?: {
    color?: number;
    intensity?: number;
    position?: CoordinateTuple;
    castShadow?: boolean;
    shadow?: {
      mapSize?: { width: number; height: number };
      camera?: {
        near?: number;
        far?: number;
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
      };
      bias?: number;
      radius?: number;
    };
  };
  hemisphere?: {
    colors?: [number, number];
  };
}

export interface PostProcessingConfig {
  pixelate?: {
    size?: number;
  };
  bloom?: {
    strength?: number;
    threshold?: number;
    radius?: number;
  };
  fxaa?: Record<string, unknown>;
  dotScreen?: {
    scale?: number;
    angle?: number;
    center?: [number, number];
  };
  rgbShift?: {
    amount?: number;
  };
  film?: {
    noiseIntensity?: number;
    grayscale?: boolean;
  };
  glitch?: Record<string, unknown>;
  afterimage?: Record<string, unknown>;
  ssao?: Record<string, unknown>;
  vignette?: {
    offset?: number;
    darkness?: number;
    color?: number | [number, number, number];
  };
  colorCorrection?: {
    contrast?: number;
    saturation?: number;
    brightness?: number;
  };
}

export interface CameraConfig {
  position?: CoordinateTuple | THREE.Vector3;
  fov?: number;
  rotation?: CoordinateTuple | THREE.Vector3;
  lookAt?: CoordinateTuple | THREE.Vector3;
  near?: number;
  far?: number;
  up?: THREE.Vector3;
  aspect?: number;
  zoom?: number;
  focus?: number;
};

export interface GroundConfig {
  size?: number | CoordinateTuple;
  color?: number;
  texture?: string;
  textureRepeat?: [number, number];
  textureOffset?: [number, number];
};
    
export interface SetupConfig {
  global?: {
    frameRate?: number;
  };
  scene?: {
    backgroundColor?: number;
  };
  camera?: CameraConfig;
  ground?: GroundConfig | false;
  sky?: {
    texture?: string;
    size?: number;
    color?: number;
  } | false;
  lights?: LightsConfig | false;
  orbit?: {
    target?: THREE.Vector3;
    disabled?: boolean;
  } | false;
  postprocessing?: PostProcessingConfig | false;
}

export interface InstanceConfig {
  show?: boolean;
  amount?: number;
  size?: CoordinateTuple;
  sizeVariation?: CoordinateTuple;
  position?: CoordinateTuple;
  positionVariation?: CoordinateTuple;
  rotation?: CoordinateTuple;
  rotationVariation?: CoordinateTuple;
  area?: number;
  ratio?: number;
  spacing?: number;
  opacity?: number;
}

export type GeneratedInstanceConfig = Array<{ position: number[]; rotation: number[]; scale: number[]; }>
