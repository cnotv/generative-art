import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export type CoordinateTuple = [number, number, number];
export type Model = THREE.Object3D<THREE.Object3DEventMap>;
export type ModelType = 'fixed' | 'dynamic' | 'kinematicVelocityBased' | 'kinematicPositionBased';

export interface Timeline {
  // Existing fields
  name?: string;
  action?: (element?: any) => void;
  actionStart?: (loop: number, element?: any) => void;
  start?: number;
  end?: number;
  frequency?: number;
  interval?: [number, number]; // Interval as a range [start, end]
  delay?: number;

  // Enhanced fields (all optional for backward compatibility)
  id?: string;                    // Unique identifier (auto-generated if not provided)
  category?: string;              // For logging/filtering ("user-input", "ai-behavior", "physics")
  duration?: number;              // Duration in frames (calculates end = start + duration)
  autoRemove?: boolean;           // Auto-remove when complete
  onComplete?: (element?: any) => void; // Callback on completion
  priority?: number;              // Execution priority (higher = earlier, default: 0)
  enabled?: boolean;              // Can be toggled on/off (default: true)
  metadata?: Record<string, any>; // Custom data
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
    actions: Record<string, THREE.AnimationAction | undefined>;
    mixer?: THREE.AnimationMixer;
  };
}

export type Direction = "forward" | "right" | "left" | "backward" | "jump";

export type EasingFunction = (t: number) => number;

export interface PopUpAnimationConfig {
  object: Model;
  startY: number;
  endY: number;
  duration: number; // in frames
  easing?: EasingFunction;
  delay?: number; // in frames
  onComplete?: () => void;
}
