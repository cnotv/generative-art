import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Timeline, Direction, ComplexModel, ComplexModel, Model } from './types';
export * from './types';
/**
 *
 * @param element THREE mesh
 * @param timeline List of actions to perform
 * @param frame Current frame (to do not confuse with delta as for animation)
 * @example
 * // Sequence of 3 animations
  { start: 0, end: 100, action: (mesh) => { mesh.rotation.x += 0.01; } },
  { start: 100, end: 200, action: (mesh) => { mesh.rotation.y += 0.01; } },
  { start: 200, end: 300, action: (mesh) => { mesh.rotation.z += 0.01; } },
  
  // Alternated animations
  { interval: [100, 100], action: (mesh) => { mesh.rotation.y += 0.01; } },
  { delay: 100, interval: [100, 100], action: (mesh) => { mesh.rotation.z += 0.01; } },
 */
declare const animateTimeline: <T>(timeline: Timeline[], frame: number, args?: T) => void;
/**
  * Generate a Timeline from a given loop
  * Example:
    const myLoop = {
      loop: 0,
      length: 30,
      action: (direction) => console.log(direction),
      list: [
        [3, forward'],
        [3, left'],
        [1, jump'],
        [3, right'],
        [3, forward'],
      ]
    }
  * @param loop
  */
declare const getTimelineLoopModel: ({ loop, length, action, list }: {
    loop: number;
    length: number;
    action: (args: any) => void;
    list: [number, Direction][];
}) => Timeline[];
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
declare const updateAnimation: (mixer: THREE.AnimationMixer, action: THREE.AnimationAction, delta?: number, speed?: number) => void;
/**
 * Move forward or backward if no collision is detected
 * @param player
 * @param dynamicBodies
 * @param distance
 * @param backwards
 */
declare const controllerForward: (model: ComplexModel, bodies: ComplexModel[], distance: number, delta: number, backwards?: boolean) => void;
declare const controllerJump: (model: ComplexModel, _bodies: ComplexModel[], _distance: number, height: number) => void;
/**
 * Rotate model on defined angle
 * @param model
 * @param angle angle in degrees
 */
declare const controllerTurn: (model: ComplexModel, angle: number) => void;
declare const bodyJump: (model: ComplexModel, bodies: ComplexModel[], distance: number, height: number) => void;
export { animateTimeline, getTimelineLoopModel, bindAnimatedElements, resetAnimation, getAnimationsModel, updateAnimation, controllerForward, controllerJump, controllerTurn, bodyJump, };
