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
const animateTimeline = <T>(
  timeline: TimelineManager,
  frame: number,
  args?: T,
  options?: {
    enableAutoRemoval?: boolean;
    sortByPriority?: boolean;
  }
) => {
  const actions = timeline.getTimeline();

  // Sort by priority if enabled
  const sortedActions = options?.sortByPriority
    ? [...actions].sort((a, b) => (b.priority || 0) - (a.priority || 0))
    : actions;

  // Track completed actions for auto-removal
  const toRemove: string[] = [];

  sortedActions.forEach((timelineAction: Timeline) => {
    // Skip if disabled
    if (timelineAction.enabled === false) return;

    const {
      start, end, frequency, delay, interval,
      action, actionStart, duration, id, onComplete
    } = timelineAction;

    // Calculate actual end from duration if provided
    const actualEnd = duration !== undefined && start !== undefined
      ? start + duration
      : end;

    let cycle = 0;
    let frameCycle = 0;
    let loop = 0;
    let isComplete = false;

    if (start && frame < start) return;
    if (actualEnd && frame > actualEnd) {
      isComplete = true;
      if (!onComplete) return;
    }
    if (delay && frame < delay) return;

    // Handle interval logic
    if (interval) {
      const [length, pause] = interval;
      cycle = length + pause;
      frameCycle = (frame - (delay ?? 0) + (start ?? 0)) % cycle;
      loop = frame / cycle;
      if (frameCycle >= length) return;
    }

    // Execute action
    if (!frequency || (frequency && frame % frequency === 0)) {
      if (actionStart && frameCycle === 0) {
        actionStart(loop, args);
      }
      if (action && !isComplete) action(args);
    }

    // Handle completion
    if (isComplete && onComplete) {
      onComplete(args);
      if (timelineAction.autoRemove && id) {
        toRemove.push(id);
        timeline._markCompleted(id);
      }
    }
  });

  // Auto-remove completed actions
  if (options?.enableAutoRemoval) {
    toRemove.forEach(id => timeline.removeAction(id));
  }
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

/** Animation data for updateAnimation and controllerForward */
interface AnimationData {
  actionName: string;
  player: ComplexModel;
  delta: number; // Threejs counter for frame time
  speed?: number;
  backward?: boolean; // For adjusting model direction
  distance?: number; // Length of action movement
}

/**
 * Play an animation action with blocking behavior (event-driven approach)
 *
 * This approach leverages Three.js AnimationMixer's 'finished' event for automatic cleanup.
 * Use this when you prefer event-driven animation management without manual timeline tracking.
 * The mixer handles cleanup automatically when the animation completes.
 *
 * **When to use:**
 * - Simple one-off animations (attacks, jumps, emotes)
 * - When you want automatic cleanup via mixer events
 * - When you don't need frame-by-frame control
 *
 * **Comparison with playActionTimeline:**
 * - playAction: Event-driven, automatic cleanup, minimal boilerplate
 * - playActionTimeline: Frame-based, manual control, timeline integration
 *
 * @param player ComplexModel with animation mixer and actions
 * @param actionName Name of the animation to play
 * @param options Configuration for blocking behavior and lifecycle
 *
 * @example
 * playAction(player, 'attack', {
 *   loop: THREE.LoopOnce,
 *   allowMovement: false,
 *   onComplete: () => console.log('Attack finished!')
 * });
 */
const playAction = (
  player: ComplexModel,
  actionName: string,
  options: {
    allowMovement?: boolean;
    allowRotation?: boolean;
    allowActions?: string[];
    loop?: THREE.AnimationActionLoopStyles;
    onComplete?: () => void;
  } = {}
): void => {
  const { allowMovement = false, allowRotation = false, allowActions = [], loop = THREE.LoopOnce, onComplete } = options;
  const mixer = player.userData.mixer;
  const action = player.userData.actions?.[actionName];

  if (!action || !mixer) return;
  if (player.userData.performing && !player.userData.allowedActions?.includes(actionName)) return;

  const previousAction = player.userData.currentAction
    ? player.userData.actions?.[player.userData.currentAction]
    : null;

  if (previousAction && previousAction !== action) {
    previousAction.fadeOut(0.2);
  }

  action.reset().fadeIn(0.2).play();
  action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
  action.clampWhenFinished = true;

  player.userData.currentAction = actionName;
  player.userData.performing = true;
  player.userData.allowMovement = allowMovement;
  player.userData.allowRotation = allowRotation;
  player.userData.allowedActions = allowActions;

  if (loop === THREE.LoopOnce) {
    const onFinished = (e: any) => {
      if (e.action === action) {
        player.userData.performing = false;
        player.userData.allowMovement = true;
        player.userData.allowRotation = true;
        player.userData.allowedActions = [];
        mixer.removeEventListener('finished', onFinished);
        if (onComplete) onComplete();
      }
    };
    mixer.addEventListener('finished', onFinished);
  }
};

/**
 * Play an animation action with blocking behavior (timeline-based approach)
 *
 * This approach uses the TimelineManager for frame-based tracking and cleanup.
 * Use this when you need timeline integration or manual control over animation lifecycle.
 * Requires calling animateTimeline in your render loop.
 *
 * **When to use:**
 * - Complex animations requiring frame-perfect timing
 * - When you need to coordinate with other timeline actions
 * - When you want manual control over cleanup timing
 * - When using the TimelineManager as your animation orchestrator
 *
 * **Comparison with playAction:**
 * - playAction: Event-driven, automatic cleanup, minimal boilerplate
 * - playActionTimeline: Frame-based, manual control, timeline integration
 *
 * @param timelineManager Timeline manager instance that orchestrates all timeline actions
 * @param player ComplexModel with animation mixer and actions
 * @param actionName Name of the animation to play
 * @param getDelta Function that returns delta time per frame (from Three.js clock)
 * @param options Configuration for blocking behavior (movement, rotation, allowed interruptions)
 *
 * @example
 * const manager = createTimelineManager();
 * playActionTimeline(manager, player, 'kick', getDelta, {
 *   allowMovement: false,
 *   allowRotation: false,
 *   allowActions: [] // No interruptions
 * });
 *
 * // In your render loop:
 * animate({
 *   timeline: manager
 * });
 */
const playActionTimeline = (
  timelineManager: TimelineManager,
  player: ComplexModel,
  actionName: string,
  getDelta: () => number,
  options: {
    allowMovement?: boolean;
    allowRotation?: boolean;
    allowActions?: string[];
  } = {}
): void => {
  const { allowMovement = false, allowRotation = false, allowActions = [] } = options;
  const action = player.userData.actions?.[actionName];
  const mixer = player.userData.mixer;

  if (!action || !mixer) return;
  if (player.userData.performing && !player.userData.allowedActions?.includes(actionName)) return;

  const clipDuration = (action as any)._clip?.duration || 0;
  if (clipDuration === 0) return;

  // Check if timeline action already exists for this animation
  const existingAction = timelineManager.getTimeline().find(
    (a) => a.name === `blocking-${actionName}`
  );
  if (existingAction) return;

  // Fade out previous action
  const previousAction = player.userData.currentAction
    ? player.userData.actions?.[player.userData.currentAction]
    : null;

  if (previousAction && previousAction !== action) {
    previousAction.fadeOut(0.2);
  }

  // Start the animation
  action.reset().fadeIn(0.2).play();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;

  // Set blocking flags immediately
  player.userData.performing = true;
  player.userData.allowMovement = allowMovement;
  player.userData.allowRotation = allowRotation;
  player.userData.allowedActions = allowActions;
  player.userData.currentAction = actionName;

  // Track accumulated time
  let accumulatedTime = 0;

  // Add timeline action
  const actionId = timelineManager.addAction({
    name: `blocking-${actionName}`,
    category: 'animation',
    action: () => {
      const delta = getDelta();
      accumulatedTime += delta;

      // Update mixer
      mixer.update(delta);

      // Check if animation completed
      if (accumulatedTime >= clipDuration) {
        // Clear blocking flags
        player.userData.performing = false;
        player.userData.allowMovement = true;
        player.userData.allowRotation = true;
        player.userData.allowedActions = [];

        // Remove this timeline action
        timelineManager.removeAction(actionId);
      }
    },
  });
};

/**
 * Update the animation of the model based on given time
 */
const updateAnimation = (data: AnimationData): void => {
  const { player, actionName, delta, speed = 10 } = data;
  const mixer = player.userData.mixer;
  const action = player.userData.actions?.[actionName];
  const coefficient = 0.1;

  if (!action || !mixer) return;

  if (player.userData.currentAction !== actionName) {
    const previousAction = player.userData.currentAction
      ? player.userData.actions?.[player.userData.currentAction]
      : null;

    if (previousAction && previousAction !== action) {
      previousAction.fadeOut(0.2);
    }

    action.reset().fadeIn(0.2).play();
    player.userData.currentAction = actionName;
  } else {
    if (!action.isRunning()) {
      action.play();
    }
  }

  if (delta) {
    mixer.update(delta * speed * coefficient);
  } else {
    action.stop();
  }
};

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
  debug?: boolean
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

/** Result of movement direction calculation */
interface MovementDirectionResult {
  /** The direction vector (scaled by distance) */
  direction: THREE.Vector3;
  /** The old position before movement */
  oldPosition: THREE.Vector3;
  /** The new target position */
  newPosition: THREE.Vector3;
}

/**
 * Calculate movement direction vector based on model orientation
 * @param model The model to get direction from
 * @param distance Movement distance
 * @param backward Whether to move backward
 * @returns Direction vector and positions
 */
const getMovementDirection = (
  model: ComplexModel,
  distance: number,
  backward: boolean = false
): MovementDirectionResult => {
  const oldPosition = model.position.clone();
  const direction = new THREE.Vector3();
  model.getWorldDirection(direction);
  
  if (backward) {
    direction.negate();
  }
  direction.multiplyScalar(distance);
  
  const newPosition = oldPosition.clone().add(direction);
  
  return { direction, oldPosition, newPosition };
};

/** Result of obstacle check */
interface ObstacleCheckResult {
  /** Whether the path is clear of obstacles */
  canMove: boolean;
  /** Array of intersection points if any */
  intersections: THREE.Intersection[];
}

/**
 * Check for obstacles in the movement path using raycasting
 * @param oldPosition Starting position
 * @param direction Movement direction (will be normalized internally)
 * @param bodies Bodies to check collisions against
 * @param collisionDistance Maximum distance to check for collisions
 * @returns Whether movement is possible and intersection data
 */
const checkObstacles = (
  oldPosition: THREE.Vector3,
  direction: THREE.Vector3,
  bodies: ComplexModel[],
  collisionDistance: number
): ObstacleCheckResult => {
  const normalizedDirection = direction.clone().normalize();
  const raycaster = new THREE.Raycaster(oldPosition, normalizedDirection, 0, collisionDistance);
  const intersections = raycaster.intersectObjects(bodies, true);
  
  return {
    canMove: intersections.length === 0,
    intersections
  };
};

/** Options for ground movement check */
interface GroundCheckOptions {
  /** Maximum height the character can step up */
  maxStepHeight: number;
  /** Maximum distance to check for ground */
  maxGroundDistance: number;
  /** Character radius for ground check offset */
  characterRadius: number;
}

/** Result of ground movement validation */
interface GroundMovementResult {
  /** Whether movement is allowed */
  canMove: boolean;
  /** The final position after ground adjustments */
  finalPosition: THREE.Vector3;
  /** Debug info about which path was taken */
  debugInfo?: string;
}

/**
 * Check ground with character radius offset
 * @param position Position to check
 * @param forwardDir Direction of movement
 * @param bodies Bodies to check against
 * @param options Ground check options
 * @returns Ground check result
 */
const checkGroundWithRadius = (
  position: THREE.Vector3,
  forwardDir: THREE.Vector3,
  bodies: ComplexModel[],
  options: GroundCheckOptions
): { hasGround: boolean; groundHeight: number | null } => {
  const { maxStepHeight, maxGroundDistance, characterRadius } = options;
  const checkPosition = position.clone();
  checkPosition.y += maxStepHeight;
  
  // Add character radius offset in the movement direction (horizontal only)
  const horizontalForward = new THREE.Vector3(forwardDir.x, 0, forwardDir.z).normalize();
  checkPosition.add(horizontalForward.multiplyScalar(characterRadius));
  
  return checkGroundAtPosition(checkPosition, bodies, maxGroundDistance + maxStepHeight);
};

/**
 * Validate ground for movement and handle axis fallback for edge walking
 * @param oldPosition Current position
 * @param newPosition Target position
 * @param direction Movement direction
 * @param bodies Bodies to check ground against
 * @param options Ground check options
 * @returns Movement result with final position
 */
const checkGroundForMovement = (
  oldPosition: THREE.Vector3,
  newPosition: THREE.Vector3,
  direction: THREE.Vector3,
  bodies: ComplexModel[],
  options: GroundCheckOptions
): GroundMovementResult => {
  const { maxStepHeight } = options;
  const finalPosition = newPosition.clone();
  const forwardNormalized = direction.clone().normalize();
  const groundCheck = checkGroundWithRadius(newPosition, forwardNormalized, bodies, options);
  
  if (groundCheck.hasGround && groundCheck.groundHeight !== null) {
    // Ground found at full movement - check step height
    const heightDifference = groundCheck.groundHeight - oldPosition.y;
    
    if (heightDifference > maxStepHeight) {
      return { canMove: false, finalPosition: oldPosition.clone(), debugInfo: 'Step too high' };
    }
    
    finalPosition.y = groundCheck.groundHeight;
    return { canMove: true, finalPosition, debugInfo: 'Full movement with ground' };
  }
  
  // No ground at full movement position - try axis fallback
  const xOnlyPosition = oldPosition.clone();
  xOnlyPosition.x = newPosition.x;
  const xOnlyCheck = checkGroundWithRadius(
    xOnlyPosition, 
    new THREE.Vector3(Math.sign(direction.x), 0, 0), 
    bodies, 
    options
  );
  
  const zOnlyPosition = oldPosition.clone();
  zOnlyPosition.z = newPosition.z;
  const zOnlyCheck = checkGroundWithRadius(
    zOnlyPosition, 
    new THREE.Vector3(0, 0, Math.sign(direction.z)), 
    bodies, 
    options
  );
  
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
    return { canMove: true, finalPosition, debugInfo: 'Using axis with more movement' };
  }
  
  if (xOnlyCheck.hasGround && xMovement > 0.001) {
    finalPosition.x = newPosition.x;
    finalPosition.z = oldPosition.z;
    if (xOnlyCheck.groundHeight !== null) finalPosition.y = xOnlyCheck.groundHeight;
    return { canMove: true, finalPosition, debugInfo: 'Sliding on X axis' };
  }
  
  if (zOnlyCheck.hasGround && zMovement > 0.001) {
    finalPosition.x = oldPosition.x;
    finalPosition.z = newPosition.z;
    if (zOnlyCheck.groundHeight !== null) finalPosition.y = zOnlyCheck.groundHeight;
    return { canMove: true, finalPosition, debugInfo: 'Sliding on Z axis' };
  }
  
  return { canMove: false, finalPosition: oldPosition.clone(), debugInfo: 'No ground on any axis' };
};

/**
 * Apply movement to model and rigid body
 * @param model The model to move
 * @param position The target position
 */
const moveCharacter = (
  model: ComplexModel,
  position: THREE.Vector3
): void => {
  const rigidBody = model.userData.body;
  model.position.copy(position);
  rigidBody.setTranslation(position, true);
};

/**
 * Move forward or backward if no collision is detected
 * Optionally checks for ground ahead and handles step climbing
 * @param obstacles Array of obstacle bodies to check horizontal collisions against
 * @param groundBodies Array of ground bodies to check for ground detection (vertical raycast)
 * @param distance Movement distance
 * @param animationData Animation data containing player, action, delta, etc.
 * @param options Controller forward options for ground and collision checks
 */
const controllerForward = (
  obstacles: ComplexModel[],
  groundBodies: ComplexModel[],
  animationData: AnimationData,
  {
    maxStepHeight = 0.5,
    maxGroundDistance = 2,
    requireGround = false,
    collisionDistance = 10,
    characterRadius = 0.5,
    debug = false
  }: ControllerForwardOptions = {}
): void => {
  const { actionName, player: model, backward = false, distance = 0 } = animationData;

  if (model.userData.performing && model.userData.allowMovement === false) {
    return;
  }

  const { actions, mixer } = model.userData;
  const { direction, oldPosition, newPosition } = getMovementDirection(model, distance, backward);

  if (debug) {
    console.log('[controllerForward] Old position:', oldPosition.toArray());
    console.log('[controllerForward] New position:', newPosition.toArray());
    console.log('[controllerForward] Forward vector:', direction.toArray());
  }

  // Check for obstacles (horizontal collision)
  const obstacleResult = checkObstacles(oldPosition, direction, obstacles, collisionDistance);
  let canMove = obstacleResult.canMove;
  let finalPosition = newPosition.clone();

  if (debug) {
    console.log('[controllerForward] Obstacle check - canMove:', obstacleResult.canMove);
    if (obstacleResult.intersections.length > 0) {
      console.log('[controllerForward] Hit obstacle:', obstacleResult.intersections[0].object.name || obstacleResult.intersections[0].object.type);
      console.log('[controllerForward] Hit point:', obstacleResult.intersections[0].point.toArray());
      console.log('[controllerForward] Hit distance:', obstacleResult.intersections[0].distance);
    }
  }

  // If ground is required, validate ground and adjust position (vertical raycast)
  if (canMove && requireGround) {
    const groundOptions: GroundCheckOptions = { maxStepHeight, maxGroundDistance, characterRadius };
    const groundResult = checkGroundForMovement(oldPosition, newPosition, direction, groundBodies, groundOptions);
    
    canMove = groundResult.canMove;
    finalPosition = groundResult.finalPosition;
    
    if (debug) {
      console.log('[controllerForward] Ground check:', groundResult.debugInfo);
      console.log('[controllerForward] Ground bodies checked:', groundBodies.length);
      console.log('[controllerForward] Ground options:', groundOptions);
      if (groundBodies.length > 0) {
        console.log('[controllerForward] First ground body position:', groundBodies[0].position?.toArray?.() ?? 'N/A');
      }
    }
  }

  if (debug) {
    console.log('[controllerForward] canMove:', canMove, requireGround ? '(ground required)' : '(no ground check)');
  }
  
  if (canMove) {
    moveCharacter(model, finalPosition);
    
    if (debug) {
      console.log('[controllerForward] Final position:', finalPosition.toArray());
    }
  } else if (debug) {
    console.log('[controllerForward] Movement blocked');
  }

  // Update animation
  const action = actions?.[actionName];
  if (action && mixer) {
    updateAnimation(animationData);
  }
};

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
 * @returns true if rotation was applied, false if blocked
 */
const controllerTurn = (
  model: ComplexModel,
  angle: number,
): boolean => {
  if (model.userData.performing && model.userData.allowRotation === false) {
    return false;
  }
  const radians = THREE.MathUtils.degToRad(angle);
  model.rotateOnAxis(new THREE.Vector3(0, 1, 0), radians);
  return true;
};

/**
 * Set the model's rotation to face a specific direction
 * @param model The model to rotate
 * @param degrees The target rotation in degrees
 * @param modelOffset Offset in degrees to correct for models facing wrong direction
 * @returns true if rotation was applied, false if blocked
 */
const setRotation = (
  model: ComplexModel,
  degrees: number,
  modelOffset: number = 0,
): boolean => {
  if (model.userData.performing && model.userData.allowRotation === false) {
    return false;
  }
  const radians = THREE.MathUtils.degToRad(degrees + modelOffset);
  model.rotation.y = radians;
  return true;
};

/** Rotation mapping for directional input combinations */
const ROTATION_MAP: Record<string, number> = {
  'down': 0,
  'down-right': 45,
  'right': 90,
  'up-right': 135,
  'up': 180,
  'up-left': 225,
  'left': 270,
  'down-left': 315,
};

const ROTATION_MAP_MIRRORED: Record<string, number> = {
  'down': 0,
  'down-left': 45,
  'left': 90,
  'up-left': 135,
  'up': 180,
  'up-right': 225,
  'right': 270,
  'down-right': 315,
};

/**
 * Calculate target rotation based on directional input actions
 * @param currentActions Record of active control actions
 * @returns Target rotation in degrees (0, 45, 90, 135, 180, 225, 270, 315) or null if no movement
 */
const getRotation = (
  currentActions: Record<string, unknown>,
  mirrored: boolean = false
): number | null => {
  const map = mirrored ? ROTATION_MAP_MIRRORED : ROTATION_MAP;
  const up = !!currentActions["move-up"];
  const down = !!currentActions["move-down"];
  const left = !!currentActions["move-left"];
  const right = !!currentActions["move-right"];

  const key = [
    up && !down ? 'up' : down && !up ? 'down' : '',
    left && !right ? 'left' : right && !left ? 'right' : '',
  ].filter(Boolean).join('-');

  return key ? (map[key] ?? null) : null;
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
  bindAnimatedElements,
  resetAnimation,
  getAnimationsModel,
  updateAnimation,
  playAction,
  playActionTimeline,
  controllerForward,
  controllerJump,
  controllerTurn,
  setRotation,
  getRotation,
  bodyJump,
  checkGroundAtPosition,
  getMovementDirection,
  checkObstacles,
  checkGroundWithRadius,
  checkGroundForMovement,
  moveCharacter,
};

export type {
  AnimationData,
  ControllerForwardOptions,
  MovementDirectionResult,
  ObstacleCheckResult,
  GroundCheckOptions,
  GroundMovementResult,
};

// NEW: Timeline management exports
export { createTimelineManager } from './TimelineManager';
export type { TimelineManager } from './TimelineManager';

export { createTimelineLogger } from './TimelineLogger';
export type { TimelineLogger, TimelineLogEntry } from './TimelineLogger';

export {
  generateTimelineId,
  createDurationAction,
  createOneShotAction,
  createIntervalAction,
  canAddAction,
} from './helpers';
