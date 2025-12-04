import * as THREE from 'three';
import { CoordinateTuple, ModelType } from '@webgametoolkit/animation';

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
  clearcoat?: number;
  clearcoatRoughness?: number;
  ior?: number;
  thickness?: number;
  envMapIntensity?: number;
  animations?: string;
}

export interface PhysicOptions extends CommonOptions {
  shape?: 'cuboid' | 'ball';
}

export interface SetupConfig {
  global?: { frameRate?: number };
  scene?: {
    backgroundColor?: number;
  };
  camera?: {
    position?: CoordinateTuple | THREE.Vector3;
    fov?: number;
    rotation?: CoordinateTuple | THREE.Vector3;
    lookAt?: CoordinateTuple | THREE.Vector3;
  };
  ground?: {
    size?: number;
    color?: number;
    texture?: string;
  } | false;
  sky?: {
    texture?: string;
    size?: number;
  } | false;
  lights?: {
    directional?: {
      intensity?: number;
    };
  } | false;
  orbit?: {
    target?: THREE.Vector3;
  } | false;
}

export interface InstanceConfig {
    amount: number;
    size: number;
    sizeDelta: number;
    area: number;
}
