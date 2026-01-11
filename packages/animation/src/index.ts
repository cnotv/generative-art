import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Timeline, Direction, ComplexModel, Model } from './types';

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
const animateTimeline = <T>(timeline: Timeline[], frame: number, args?: T) => {
  timeline.forEach(({ start, end, frequency, delay, interval, action, actionStart }) => {
    let cycle = 0;
    let frameCycle = 0;
    let loop = 0;
    if (start && frame < start) return;
    if (end && frame > end) return;
    if (delay && frame < delay) return;
    if (interval) {
      const [length, pause] = interval;
      cycle = length + pause;
      frameCycle = (frame - (delay ?? 0) + (start ?? 0)) % cycle;
      loop = frame / cycle;
      if (frameCycle >= length) return;
    }

    if (!frequency || (frequency && frame % frequency === 0)) {
      if (actionStart && frameCycle === 0) {
        actionStart(loop, args);
      }
      if (action) action(args)
    }
  });
}

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
const getTimelineLoopModel = ({ loop, length, action, list }: {
    loop: number, // 0 === infinite
    length: number,
    action: (args: any) => void,
    list: [number, Direction][] // [steps, direction]
}): Timeline[] => {
  const total = list.reduce((acc, [step]) => acc + step * length, 0);
  return list.reduce((timeline, [step, args], index) => {
    const partial = loop > 0
      ? {
        from: total,
        to: total + step * length,
      }
      : {
        interval: [step * length, total],
        delay: timeline[index - 1] ? timeline[index - 1].interval![0] : 0,
      };
    
      return [
      ...timeline,
      {
        ...partial,
        action: () => action(args),
      }
    ] as Timeline[];
  }, [] as Timeline[]);
}

const isGrounded = (rigidBody: RAPIER.RigidBody, world: RAPIER.World, elements: ComplexModel[]): boolean => {
  const originPosition = rigidBody.translation();
  const maxToi = 4.0;
  const solid = true;
  
  return elements.some((model) => {
    const rigidBody = model.userData.body;
    const position = rigidBody.translation();
    const ray = new RAPIER.Ray(
      { x: originPosition.x, y: 3, z: originPosition.z }, // Origin
      position, // Direction (ground)
    );

    const hit = world.castRay(ray, maxToi, solid);
    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      const distance = originPosition.y - hitPoint.y;
      return distance < 0.00
    }

    return false
  })
}

/**
 * Bind physic to models to animate them
 * @param elements 
 */
const bindAnimatedElements = (elements: ComplexModel[], world: RAPIER.World, delta: number) => {
  elements.forEach((model: ComplexModel) => {
    const mesh = model;
    const { body: rigidBody, helper, type, hasGravity } = model.userData;
    if (type === 'fixed') return;
    if (type === 'kinematicPositionBased') {
      const grounded = isGrounded(rigidBody, world, elements);
      const gravity = hasGravity && !grounded ? -9.8 * delta -1 : 0;
      mesh.position.y += gravity;
      rigidBody.setNextKinematicTranslation(mesh.position);
    } else {
      const position = rigidBody.translation();
      mesh.position.set(position.x, position.y, position.z);
      const rotation = rigidBody.rotation();
      mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    }

    if (helper) {
      // @ts-ignore
      helper.update();
    }
  });
}

/**
 * Reset models and bodies to their initial state (position, rotation, forces, and torques)
 * @param elements 
 */
const resetAnimation = (elements: ComplexModel[]) => {
  elements.forEach((model) => {
    const rigidBody = model.userData.body;
    const { position: [x, y, z] } = model.userData.initialValues;
    rigidBody.resetForces(true);
    rigidBody.resetTorques(true);
    rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    rigidBody.setTranslation({ x, y, z }, true);
  });

  return elements;
}

const getAnimationsModel = (mixer: THREE.AnimationMixer, model: Model, gltf: any) => {
  // Flip the model
  model.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI)
  const actions: Record<string, THREE.AnimationAction> = gltf.animations.reduce((acc: Record<string, THREE.AnimationAction>, animation: THREE.AnimationClip) => {
    acc[animation.name] = mixer.clipAction(animation);
    return acc;
  }, {});
  return actions
}

/**
 * Update the animation of the model based on given time
 */
const updateAnimation = (
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction,
  delta: number = 0,
  speed: number = 0,
  player?: ComplexModel,
  actionName?: string,
) => {
  const coefficient = 0.1
  if (!action) return
  
  // Handle animation switching if player and actionName provided
  if (player && actionName && player.userData.currentAction !== actionName) {
    const previousAction = player.userData.currentAction 
      ? player.userData.actions?.[player.userData.currentAction]
      : null;
    
    if (previousAction && previousAction !== action) {
      previousAction.fadeOut(0.2);
    }
    
    action.reset().fadeIn(0.2).play();
    player.userData.currentAction = actionName;
  } else if (player && actionName && player.userData.currentAction === actionName) {
    // Ensure the action is playing
    if (!action.isRunning()) {
      action.play();
    }
  }
  
  if (delta) {
    mixer.update(delta * speed * coefficient)
  } else {
    action.stop()
  }
}

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
const checkGroundAtPosition = (
  position: THREE.Vector3,
  bodies: ComplexModel[],
  maxDistance: number
): { hasGround: boolean; groundHeight: number | null } => {
  const downward = new THREE.Vector3(0, -1, 0);
  const raycaster = new THREE.Raycaster(position, downward, 0, maxDistance);
  const intersects = raycaster.intersectObjects(bodies, true);
  
  if (intersects.length > 0) {
    return { hasGround: true, groundHeight: intersects[0].point.y };
  }
  return { hasGround: false, groundHeight: null };
};

/**
 * Move forward or backward if no collision is detected
 * Optionally checks for ground ahead and handles step climbing
 * @param model The model to move
 * @param bodies Array of bodies to check collisions against
 * @param distance Movement distance
 * @param delta Time delta for animation
 * @param actionName Animation action name
 * @param backwards Whether to move backwards
 * @param options Additional options for ground checking and step climbing
 */
const controllerForward = (
  model: ComplexModel,
  bodies: ComplexModel[],
  distance: number,
  delta: number,
  actionName: string = 'run',
  backwards: boolean = false,
  options: ControllerForwardOptions = {}
) => {
  const {
    maxStepHeight = 0.5,
    maxGroundDistance = 2,
    requireGround = false,
    collisionDistance = 10,
    characterRadius = 0.5,
    debug = {}
  } = options;
  
  const { logRaycast = false, logMovement = false, logPositions = false } = debug;
  
  const mesh = model;
  const { body: rigidBody, actions, mixer } = model.userData;
  const oldPosition = mesh.position.clone();

  // Calculate the forward vector
  const forward = new THREE.Vector3();
  mesh.getWorldDirection(forward);
  if (backwards) {
    forward.negate();
  }
  forward.multiplyScalar(distance);

  // Create a new position by adding the forward vector to the old position
  const newPosition = oldPosition.clone().add(forward);

  if (logPositions) {
    console.log('[controllerForward] Old position:', oldPosition.toArray());
    console.log('[controllerForward] New position:', newPosition.toArray());
    console.log('[controllerForward] Forward vector:', forward.toArray());
  }

  // Create a raycaster for horizontal collision detection
  const raycaster = new THREE.Raycaster(oldPosition, forward.normalize(), 0, collisionDistance);

  // Check for intersections with the new position
  const intersects = raycaster.intersectObjects(bodies.map(body => body), true);

  let canMove = intersects.length === 0;
  const finalPosition = newPosition.clone();

  // Helper function to check ground with character radius offset
  const checkGroundWithRadius = (position: THREE.Vector3, forwardDir: THREE.Vector3): { hasGround: boolean; groundHeight: number | null } => {
    // Offset the check position in the forward direction by character radius
    const checkPosition = position.clone();
    checkPosition.y += maxStepHeight;
    
    // Add character radius offset in the movement direction (horizontal only)
    const horizontalForward = new THREE.Vector3(forwardDir.x, 0, forwardDir.z).normalize();
    checkPosition.add(horizontalForward.multiplyScalar(characterRadius));
    
    return checkGroundAtPosition(checkPosition, bodies, maxGroundDistance + maxStepHeight);
  };

  // If ground is required, check for ground at the new position
  if (canMove && requireGround) {
    const forwardNormalized = forward.clone().normalize();
    const groundCheck = checkGroundWithRadius(newPosition, forwardNormalized);
    
    if (logRaycast) {
      console.log('[controllerForward] Ground check result:', groundCheck);
      console.log('[controllerForward] Bodies checked:', bodies.length);
    }
    
    if (!groundCheck.hasGround) {
      // No ground at full movement position - try axis fallback
      // Check if moving only on X axis has ground
      const xOnlyPosition = oldPosition.clone();
      xOnlyPosition.x = newPosition.x;
      const xOnlyCheck = checkGroundWithRadius(xOnlyPosition, new THREE.Vector3(Math.sign(forward.x), 0, 0));
      
      // Check if moving only on Z axis has ground
      const zOnlyPosition = oldPosition.clone();
      zOnlyPosition.z = newPosition.z;
      const zOnlyCheck = checkGroundWithRadius(zOnlyPosition, new THREE.Vector3(0, 0, Math.sign(forward.z)));
      
      if (logRaycast) {
        console.log('[controllerForward] X-only fallback:', xOnlyCheck);
        console.log('[controllerForward] Z-only fallback:', zOnlyCheck);
      }
      
      // Determine which axis movement is valid
      const xMovement = Math.abs(newPosition.x - oldPosition.x);
      const zMovement = Math.abs(newPosition.z - oldPosition.z);
      
      if (xOnlyCheck.hasGround && zOnlyCheck.hasGround) {
        // Both axes have ground - use the one with more movement
        if (xMovement >= zMovement) {
          finalPosition.x = newPosition.x;
          finalPosition.z = oldPosition.z;
          if (xOnlyCheck.groundHeight !== null) finalPosition.y = xOnlyCheck.groundHeight;
        } else {
          finalPosition.x = oldPosition.x;
          finalPosition.z = newPosition.z;
          if (zOnlyCheck.groundHeight !== null) finalPosition.y = zOnlyCheck.groundHeight;
        }
        canMove = true;
        if (logMovement) console.log('[controllerForward] Using axis with more movement');
      } else if (xOnlyCheck.hasGround && xMovement > 0.001) {
        // Only X axis has ground
        finalPosition.x = newPosition.x;
        finalPosition.z = oldPosition.z;
        if (xOnlyCheck.groundHeight !== null) finalPosition.y = xOnlyCheck.groundHeight;
        canMove = true;
        if (logMovement) console.log('[controllerForward] Sliding on X axis');
      } else if (zOnlyCheck.hasGround && zMovement > 0.001) {
        // Only Z axis has ground
        finalPosition.x = oldPosition.x;
        finalPosition.z = newPosition.z;
        if (zOnlyCheck.groundHeight !== null) finalPosition.y = zOnlyCheck.groundHeight;
        canMove = true;
        if (logMovement) console.log('[controllerForward] Sliding on Z axis');
      } else {
        // No ground on any axis
        canMove = false;
        if (logMovement) console.log('[controllerForward] No ground on any axis - blocked');
      }
    } else if (groundCheck.groundHeight !== null) {
      // Ground found at full movement - check step height
      const heightDifference = groundCheck.groundHeight - oldPosition.y;
      
      if (heightDifference > maxStepHeight) {
        // Step is too high to climb
        canMove = false;
      } else {
        // Adjust Y to ground height
        finalPosition.y = groundCheck.groundHeight;
      }
    }
  }

  if (logMovement) {
    console.log('[controllerForward] canMove:', canMove, requireGround ? '(ground required)' : '(no ground check)');
  }
  
  if (canMove) {
    // Update the model's position and the rigid body's translation if movement is allowed
    mesh.position.copy(finalPosition);
    rigidBody.setTranslation(finalPosition, true);
    
    if (logPositions) {
      console.log('[controllerForward] Final position:', finalPosition.toArray());
    }
  } else if (logMovement) {
    console.log('[controllerForward] Movement blocked');
  }

  const action = actions?.[actionName];
  if (action && mixer) {
    updateAnimation(mixer, action, delta, 10, model, actionName);
  }
}

const controllerJump = (
  model: ComplexModel,
  _bodies: ComplexModel[],
  _distance: number,
  height: number,
) => {
  const mesh = model;
  mesh.position.y = mesh.position.y + height;
}

/**
 * Rotate model on defined angle
 * @param model 
 * @param angle angle in degrees
 */
const controllerTurn = (
  model: ComplexModel,
  angle: number,
) => {
  const mesh = model;
  const radians = THREE.MathUtils.degToRad(angle);
  mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), radians);
};

const bodyJump = (
  model: ComplexModel,
  bodies: ComplexModel[],
  distance: number,
  height: number,
) => {
  const mesh = model;
  const rigidBody = model.userData.body;
  const collision = 27;
  const oldPosition = mesh.position.clone();

  // Calculate the forward vector
  const forward = new THREE.Vector3();
  mesh.getWorldDirection(forward);
  forward.multiplyScalar(distance);

  // Create an upward vector
  const upward = new THREE.Vector3(0, height, 0);

  // Create a new position by adding the forward and upward vectors to the old position
  const newPosition = oldPosition.clone().add(upward);

  // Check for collisions with the new position
  const isColliding = bodies.some((body) => {
    const difference = body.position.distanceTo(newPosition);
    return difference < collision; // Adjust this value based on your collision detection needs
  });

  if (!isColliding) {
    // Update the model's position and the rigid body's translation if no collision is detected
    mesh.position.copy(newPosition);
    rigidBody.setTranslation(newPosition, true);
  }
}

export {
  animateTimeline,
  getTimelineLoopModel,
  bindAnimatedElements,
  resetAnimation,
  getAnimationsModel,
  updateAnimation,
  controllerForward,
  controllerJump,
  controllerTurn,
  bodyJump,
  checkGroundAtPosition,
};

export type { ControllerForwardOptions };
