import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export type CoordinateTuple = [number, number, number];

export type Model = THREE.Object3D<THREE.Object3DEventMap>;
export type ModelType = 'fixed' | 'dynamic' | 'kinematicVelocityBased' | 'kinematicPositionBased';

export interface Timeline {
  name?: string;
  action?: (element?: any) => void;
  actionStart?: (loop: number, element?: any) => void;
  start?: number;
  end?: number;
  frequency?: number;
  interval?: [number, number]; // Interval as a range [start, end]
  delay?: number;
}

export interface ComplexModel extends Model {
  userData: Record<string, any> & {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    initialValues: {
      size: number | CoordinateTuple;
      rotation: CoordinateTuple;
      position: CoordinateTuple;
      color: number | undefined;
    };
    type: ModelType;
    characterController?: RAPIER.KinematicCharacterController;
    helper?: THREE.SkeletonHelper;
    hasGravity?: boolean;
    actions?: Record<string, THREE.AnimationAction>;
    mixer?: THREE.AnimationMixer;
  };
}

export type Direction = "forward" | "right" | "left" | "backward" | "jump";
