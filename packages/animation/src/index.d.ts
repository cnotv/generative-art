import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Timeline, ComplexModel, Model } from './types';
import type { TimelineManager } from './TimelineManager';
export * from './types';
/**
 * Animate timeline actions based on the current frame
 * @param timeline TimelineManager instance with actions to perform
 * @param frame Current frame (to do not confuse with delta as for animation)
 * @param args Optional arguments to pass to action callbacks
 * @param options Optional configuration for timeline processing
 * @example
 * const manager = createTimelineManager();
 * manager.addAction({ start: 0, duration: 100, action: (mesh) => { mesh.rotation.x += 0.01; } });
 * manager.addAction({ start: 100, duration: 100, action: (mesh) => { mesh.rotation.y += 0.01; } });
 *
 * // In animation loop
 * animateTimeline(manager, frame, mesh, { enableAutoRemoval: true });
 */
declare const animateTimeline: <T>(
  timeline: TimelineManager,
  frame: number,
  args?: T,
  options?: {
    enableAutoRemoval?: boolean;
    sortByPriority?: boolean;
  }
) => void;
/**
 * Bind physic to models to animate them
 * @param elements
 */
declare const bindAnimatedElements: (elements: ComplexModel[], world: RAPIER.World, delta: number) => void;
/**
 * Reset models and bodies to their initial state (position, rotation, forces, and torques)
 * @param elements
 */
declare const resetAnimation: (elements: ComplexModel[]) => ComplexModel[];
declare const getAnimationsModel: (mixer: THREE.AnimationMixer, model: Model, gltf: any) => {
    run: THREE.AnimationAction;
};
/**
 * Update the animation of the model based on given time
 */
declare const updateAnimation: (mixer: THREE.AnimationMixer, action: THREE.AnimationAction, delta?: number, speed?: number, player?: ComplexModel, actionName?: string) => void;

/** Animation data for updateAnimation and controllerForward */
interface AnimationData {
  /** Animation action name */
  actionName: string;
  /** The player/model being animated */
  player: ComplexModel;
  /** Time delta for animation update */
  delta: number;
  /** Animation playback speed */
  speed?: number;
  /** Whether moving backwards */
  backward?: boolean;
}

/**
 * Update the animation of the model based on given time
 */
declare const updateAnimation: (data: AnimationData) => void;

interface ControllerForwardOptions {
  /** Maximum height the character can step up (for stairs/small obstacles) */
  maxStepHeight?: number;
  /** Maximum distance to check for ground below the character */
  maxGroundDistance?: number;
  /** Whether ground is required to move forward (prevents walking off edges) */
  requireGround?: boolean;
  /** Collision detection distance for obstacles */
  collisionDistance?: number;
  /** Character radius for ground check offset (checks ground at character's edge, not center) */
  characterRadius?: number;
  /** Debug options for troubleshooting movement issues */
  debug?: {
    /** Log raycast hit positions and ground detection results */
    logRaycast?: boolean;
    /** Log canMove decision and reasoning */
    logMovement?: boolean;
    /** Log position values (old, new, final) */
    logPositions?: boolean;
  };
}

/**
 * Check if there's ground at a given position
 * @param position Position to check from
 * @param bodies Array of bodies to check against
 * @param maxDistance Maximum distance to check for ground
 * @returns Object containing whether ground was found and at what height
 */
declare const checkGroundAtPosition: (
  position: THREE.Vector3,
  bodies: ComplexModel[],
  maxDistance: number
) => { hasGround: boolean; groundHeight: number | null };

/**
 * Move forward or backward if no collision is detected
 * Optionally checks for ground ahead and handles step climbing
 * @param bodies Array of bodies to check collisions against
 * @param distance Movement distance
 * @param animationData Animation data containing player, action, delta, etc.
 * @param options Additional options for ground checking and step climbing
 */
declare const controllerForward: (
  bodies: ComplexModel[],
  distance: number,
  animationData: AnimationData,
  options?: ControllerForwardOptions
) => void;
declare const controllerJump: (model: ComplexModel, _bodies: ComplexModel[], _distance: number, height: number) => void;
/**
 * Rotate model on defined angle
 * @param model
 * @param angle angle in degrees
 */
declare const controllerTurn: (model: ComplexModel, angle: number) => void;
declare const bodyJump: (model: ComplexModel, bodies: ComplexModel[], distance: number, height: number) => void;
export { animateTimeline, bindAnimatedElements, resetAnimation, getAnimationsModel, updateAnimation, controllerForward, controllerJump, controllerTurn, bodyJump, checkGroundAtPosition };
export type { AnimationData, ControllerForwardOptions };
// Timeline management exports
export { createTimelineManager, createTimelineLogger, generateTimelineId, createDurationAction, createOneShotAction, createIntervalAction, canAddAction };
export type { TimelineManager, TimelineLogger, TimelineLogEntry };
