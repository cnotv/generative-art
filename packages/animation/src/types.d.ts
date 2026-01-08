import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
export type CoordinateTuple = [number, number, number];
export type Model = THREE.Group<THREE.Object3DEventMap>;
export type ModelType = 'fixed' | 'dynamic' | 'kinematicVelocityBased' | 'kinematicPositionBased';
export interface Timeline {
  name?: string;
  action?: (element?: any) => void;
  actionStart?: (loop: number, element?: any) => void;
  start?: number;
  end?: number;
  frequency?: number;
  interval?: [number, number];
  delay?: number;
}
export type Direction = "forward" | "right" | "left" | "backward" | "jump";
