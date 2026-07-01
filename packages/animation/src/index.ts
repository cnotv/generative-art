import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { Timeline, ComplexModel, Model } from './types'
import type { TimelineManager } from './TimelineManager'

export * from './types'

/** Compute interval cycle state for a timeline action */
const computeIntervalState = (
  interval: [number, number],
  frame: number,
  delay: number | undefined,
  start: number | undefined
): { cycle: number; frameCycle: number; loop: number } => {
  const [length, pause] = interval
  const cycle = length + pause
  const frameCycle = (frame - (delay ?? 0) + (start ?? 0)) % cycle
  const loop = frame / cycle
  return { cycle, frameCycle, loop }
}

/** Determine if a timeline action has completed */
const computeActualEnd = (
  duration: number | undefined,
  start: number | undefined,
  end: number | undefined
): number | undefined => (duration !== undefined && start !== undefined ? start + duration : end)

/** Check if an interval action should be skipped for the current frame */
const shouldSkipIntervalFrame = (
  interval: [number, number],
  frame: number,
  delay: number | undefined,
  start: number | undefined
): boolean => {
  const [length] = interval
  const cycleLength = length + interval[1]
  const currentFrameCycle = (frame - (delay ?? 0) + (start ?? 0)) % cycleLength
  return currentFrameCycle >= length
}

type ActionCallbacksParameters<T> = {
  timelineAction: Timeline
  frame: number
  args: T | undefined
  frameCycle: number
  loop: number
  isComplete: boolean
}

/** Execute action callbacks if frequency and interval conditions are met */
const executeActionCallbacks = <T>({
  timelineAction,
  frame,
  args,
  frameCycle,
  loop,
  isComplete
}: ActionCallbacksParameters<T>): void => {
  const { frequency, action, actionStart } = timelineAction
  if (frequency && frame % frequency !== 0) return
  if (actionStart && frameCycle === 0) {
    actionStart(loop, args)
  }
  if (action && !isComplete) action(args)
}

/** Handle completion: fire onComplete and schedule autoRemove */
const handleCompletion = <T>(
  timelineAction: Timeline,
  args: T | undefined,
  toRemove: string[],
  timeline: TimelineManager
): void => {
  const { onComplete, autoRemove, id } = timelineAction
  if (!onComplete) return
  onComplete(args)
  if (autoRemove && id) {
    toRemove.push(id)
    timeline._markCompleted(id)
  }
}

const isActionComplete = (actualEnd: number | undefined, frame: number): boolean =>
  !!(actualEnd && frame > actualEnd)

const shouldSkipAction = (
  timelineAction: Timeline,
  frame: number,
  actualEnd: number | undefined
): boolean => {
  const { start, delay, interval, onComplete } = timelineAction
  const complete = isActionComplete(actualEnd, frame)
  const conditions = [
    timelineAction.enabled === false,
    !!(start && frame < start),
    complete && !onComplete,
    !!(delay && frame < delay),
    !!(interval && shouldSkipIntervalFrame(interval, frame, delay, start))
  ]
  return conditions.some(Boolean)
}

/** Execute and handle a single timeline action for the given frame */
const processTimelineAction = <T>(
  timelineAction: Timeline,
  frame: number,
  args: T | undefined,
  toRemove: string[],
  timeline: TimelineManager
): void => {
  const { end, delay, interval, duration, start, onComplete: _onComplete } = timelineAction
  const actualEnd = computeActualEnd(duration, start, end)
  if (shouldSkipAction(timelineAction, frame, actualEnd)) return

  const isComplete = isActionComplete(actualEnd, frame)
  const { frameCycle, loop } = interval
    ? computeIntervalState(interval, frame, delay, start)
    : { frameCycle: 0, loop: 0 }

  executeActionCallbacks<T>({ timelineAction, frame, args, frameCycle, loop, isComplete })

  if (isComplete) {
    handleCompletion(timelineAction, args, toRemove, timeline)
  }
}

/**
 * Animate timeline actions based on the current frame
 * @param timeline TimelineManager instance
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
    enableAutoRemoval?: boolean
    sortByPriority?: boolean
  }
) => {
  const actions = timeline.getTimeline()

  const sortedActions = options?.sortByPriority
    ? [...actions].sort((a, b) => (b.priority || 0) - (a.priority || 0))
    : actions

  const toRemove: string[] = []

  sortedActions.forEach((timelineAction: Timeline) => {
    processTimelineAction(timelineAction, frame, args, toRemove, timeline)
  })

  if (options?.enableAutoRemoval) {
    toRemove.forEach((id) => timeline.removeAction(id))
  }
}

/** Half the collider's vertical extent, used to find the distance from its center to its bottom face */
const getColliderHalfHeight = (collider: RAPIER.Collider): number =>
  collider.shapeType() === RAPIER.ShapeType.Ball ? collider.radius() : collider.halfExtents().y

const GROUND_CHECK_MARGIN = 2

/** Whether the model's collider is resting on (or overlapping) another body directly beneath it */
const isGrounded = (model: ComplexModel, world: RAPIER.World): boolean => {
  const { body: rigidBody, collider } = model.userData
  const origin = rigidBody.translation()
  const maxToi = getColliderHalfHeight(collider) + GROUND_CHECK_MARGIN
  const ray = new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 })

  return world.castRay(ray, maxToi, true, undefined, undefined, undefined, rigidBody) !== null
}

/**
 * Bind physic to models to animate them
 * @param elements
 */
const bindAnimatedElements = (elements: ComplexModel[], world: RAPIER.World, delta: number) => {
  elements.forEach((model: ComplexModel) => {
    const mesh = model
    const { body: rigidBody, helper, type, hasGravity, gravityScale = 1 } = model.userData
    if (type === 'fixed') return
    if (type === 'kinematicPositionBased') {
      const grounded = isGrounded(model, world)
      const gravity = hasGravity && !grounded ? (-9.8 * delta - 1) * gravityScale : 0
      mesh.position.y += gravity
      rigidBody.setNextKinematicTranslation(mesh.position)
    } else {
      const position = rigidBody.translation()
      mesh.position.set(position.x, position.y, position.z)
      const rotation = rigidBody.rotation()
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    }

    if (helper) {
      // @ts-ignore
      helper.update()
    }
  })
}

/**
 * Reset models and bodies to their initial state (position, rotation, forces, and torques)
 * @param elements
 */
const resetAnimation = (elements: ComplexModel[]) => {
  elements.forEach((model) => {
    const rigidBody = model.userData.body
    const {
      position: [x, y, z]
    } = model.userData.initialValues
    rigidBody.resetForces(true)
    rigidBody.resetTorques(true)
    rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    rigidBody.setTranslation({ x, y, z }, true)
  })

  return elements
}

const getAnimationsModel = (
  mixer: THREE.AnimationMixer,
  model: Model,
  gltf: { animations: THREE.AnimationClip[] }
) => {
  // Flip the model
  model.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI)
  const actions: Record<string, THREE.AnimationAction> = gltf.animations.reduce(
    (accumulator: Record<string, THREE.AnimationAction>, animation: THREE.AnimationClip) => {
      accumulator[animation.name] = mixer.clipAction(animation)
      return accumulator
    },
    {}
  )
  return actions
}

/** Animation data for updateAnimation and controllerForward */
interface AnimationData {
  actionName: string
  player: ComplexModel
  delta: number // Threejs counter for frame time
  speed?: number
  backward?: boolean // For adjusting model direction
  distance?: number // Length of action movement
  targetRotation?: number // Heading in degrees to move toward; overrides the model's current facing
}

interface PlayActionOptions {
  allowMovement?: boolean
  allowRotation?: boolean
  allowActions?: string[]
  loop?: THREE.AnimationActionLoopStyles
  onComplete?: () => void
}

/** Fade out previous action if it differs from the current one */
const fadePreviousAction = (player: ComplexModel, nextAction: THREE.AnimationAction): void => {
  const previousAction = player.userData.currentAction
    ? player.userData.actions?.[player.userData.currentAction as string]
    : null

  if (previousAction && previousAction !== nextAction) {
    previousAction.fadeOut(0.2)
  }
}

/** Clear blocking flags on the player (restores movement/rotation) */
const clearBlockingFlags = (player: ComplexModel): void => {
  player.userData.performing = false
  player.userData.allowMovement = true
  player.userData.allowRotation = true
  player.userData.allowedActions = []
}

/** Set blocking flags on the player */
const setBlockingFlags = (
  player: ComplexModel,
  actionName: string,
  allowMovement: boolean,
  allowRotation: boolean,
  allowActions: string[]
): void => {
  player.userData.currentAction = actionName
  player.userData.performing = true
  player.userData.allowMovement = allowMovement
  player.userData.allowRotation = allowRotation
  player.userData.allowedActions = allowActions
}

/** Register a 'finished' listener that clears blocking state and calls onComplete */
const registerFinishedListener = (
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction,
  player: ComplexModel,
  onComplete: (() => void) | undefined
): void => {
  const onFinished = (e: THREE.Event & { action: THREE.AnimationAction }) => {
    if (e.action === action) {
      clearBlockingFlags(player)
      mixer.removeEventListener('finished', onFinished)
      onComplete?.()
    }
  }
  mixer.addEventListener('finished', onFinished)
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
 * });
 */
/** Check if an action is blocked by current performing state */
const isActionBlocked = (player: ComplexModel, actionName: string): boolean =>
  !!(
    player.userData.performing &&
    !(player.userData.allowedActions as string[] | undefined)?.includes(actionName)
  )

/** Resolve action and mixer from player userData */
const resolveActionAndMixer = (
  player: ComplexModel,
  actionName: string
): { action: THREE.AnimationAction | undefined; mixer: THREE.AnimationMixer | undefined } => ({
  action: player.userData.actions?.[actionName] as THREE.AnimationAction | undefined,
  mixer: player.userData.mixer as THREE.AnimationMixer | undefined
})

/** Start an animation action with fade in and configure loop */
const startAction = (
  action: THREE.AnimationAction,
  loop: THREE.AnimationActionLoopStyles
): void => {
  action.reset().fadeIn(0.2).play()
  action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity)
  action.clampWhenFinished = true
}

const playAction = (
  player: ComplexModel,
  actionName: string,
  options: PlayActionOptions = {}
): void => {
  const {
    allowMovement = false,
    allowRotation = false,
    allowActions = [],
    loop = THREE.LoopOnce,
    onComplete
  } = options

  const { action, mixer } = resolveActionAndMixer(player, actionName)
  if (!action || !mixer) return
  if (isActionBlocked(player, actionName)) return

  fadePreviousAction(player, action)
  startAction(action, loop)
  setBlockingFlags(player, actionName, allowMovement, allowRotation, allowActions)

  if (loop === THREE.LoopOnce) {
    registerFinishedListener(mixer, action, player, onComplete)
  }
}

/** Get the clip duration from an animation action (Three.js internal) */
const getClipDuration = (action: THREE.AnimationAction): number => {
  const actionWithClip = action as THREE.AnimationAction & { _clip?: { duration: number } }
  return actionWithClip._clip?.duration ?? 0
}

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
 * @param config Configuration for blocking behavior (movement, rotation, allowed interruptions)
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
interface PlayActionTimelineConfig {
  allowMovement?: boolean
  allowRotation?: boolean
  allowActions?: string[]
  speed?: number
}

type BlockingActionParameters = {
  timelineManager: TimelineManager
  player: ComplexModel
  actionName: string
  mixer: THREE.AnimationMixer
  clipDuration: number
  getDelta: () => number
  speed: number
}

/** Register a blocking timeline action that updates mixer and clears flags when clip finishes */
const registerBlockingTimelineAction = ({
  timelineManager,
  player,
  actionName,
  mixer,
  clipDuration,
  getDelta,
  speed
}: BlockingActionParameters): void => {
  let accumulatedTime = 0
  const actionId = timelineManager.addAction({
    name: `blocking-${actionName}`,
    category: 'animation',
    action: () => {
      const delta = getDelta()
      accumulatedTime += delta
      mixer.update(delta * speed)
      if (accumulatedTime >= clipDuration / speed) {
        clearBlockingFlags(player)
        timelineManager.removeAction(actionId)
      }
    }
  })
}

const canStartActionTimeline = (
  timelineManager: TimelineManager,
  player: ComplexModel,
  actionName: string,
  action: THREE.AnimationAction | undefined,
  mixer: THREE.AnimationMixer | undefined
): boolean => {
  if (!action || !mixer) return false
  if (isActionBlocked(player, actionName)) return false
  if (getClipDuration(action) === 0) return false
  return !timelineManager.getTimeline().some((a) => a.name === `blocking-${actionName}`)
}

const playActionTimeline = (
  timelineManager: TimelineManager,
  player: ComplexModel,
  actionName: string,
  getDelta: () => number,
  config: PlayActionTimelineConfig = {}
): void => {
  const { allowMovement = false, allowRotation = false, allowActions = [], speed = 1 } = config
  const { action, mixer } = resolveActionAndMixer(player, actionName)

  if (!canStartActionTimeline(timelineManager, player, actionName, action, mixer)) return

  const clipDuration = getClipDuration(action!)
  fadePreviousAction(player, action!)

  action!.reset().fadeIn(0.2).play()
  action!.setLoop(THREE.LoopOnce, 1)
  action!.clampWhenFinished = true

  setBlockingFlags(player, actionName, allowMovement, allowRotation, allowActions)
  registerBlockingTimelineAction({
    timelineManager,
    player,
    actionName,
    mixer: mixer!,
    clipDuration,
    getDelta,
    speed
  })
}

/** Switch from previous animation to a new action with crossfade */
const switchAction = (
  player: ComplexModel,
  action: THREE.AnimationAction,
  actionName: string
): void => {
  const previousAction = player.userData.currentAction
    ? (player.userData.actions?.[player.userData.currentAction as string] as
        | THREE.AnimationAction
        | undefined)
    : null
  if (previousAction && previousAction !== action) {
    previousAction.fadeOut(0.2)
  }
  action.reset().fadeIn(0.2).play()
  player.userData.currentAction = actionName
}

/**
 * Update the animation of the model based on given time
 */
const updateAnimation = (data: AnimationData): void => {
  const { player, actionName, delta, speed = 10 } = data
  const mixer = player.userData.mixer as THREE.AnimationMixer | undefined
  const action = player.userData.actions?.[actionName as string] as
    | THREE.AnimationAction
    | undefined
  const coefficient = 0.1

  if (!action || !mixer) return

  if (player.userData.currentAction !== actionName) {
    switchAction(player, action, actionName)
  } else if (!action.isRunning()) {
    action.play()
  }

  if (delta) {
    mixer.update(delta * speed * coefficient)
  } else {
    action.stop()
  }
}

interface ControllerForwardOptions {
  /** Maximum height the character can step up (for stairs/small obstacles) */
  maxStepHeight?: number
  /** Maximum distance to check for ground below the character */
  maxGroundDistance?: number
  /** Whether ground is required to move forward (prevents walking off edges) */
  requireGround?: boolean
  /** Collision detection distance for obstacles */
  collisionDistance?: number
  /** Character radius for ground check offset (checks ground at character's edge, not center) */
  characterRadius?: number
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
  const downward = new THREE.Vector3(0, -1, 0)
  const raycaster = new THREE.Raycaster(position, downward, 0, maxDistance)
  const intersects = raycaster.intersectObjects(bodies, true)

  if (intersects.length > 0) {
    return { hasGround: true, groundHeight: intersects[0].point.y }
  }
  return { hasGround: false, groundHeight: null }
}

/** Result of movement direction calculation */
interface MovementDirectionResult {
  /** The direction vector (scaled by distance) */
  direction: THREE.Vector3
  /** The old position before movement */
  oldPosition: THREE.Vector3
  /** The new target position */
  newPosition: THREE.Vector3
}

/**
 * Calculate movement direction vector based on model orientation
 * @param model The model to get direction from
 * @param distance Movement distance
 * @param backward Whether to move backward
 * @param headingDegrees Optional target heading in degrees; when provided, movement follows this direction (about the Y axis) instead of the model's current facing, so the model heads straight to the target while its visual rotation catches up
 * @returns Direction vector and positions
 */
const getMovementDirection = (
  model: ComplexModel,
  distance: number,
  backward: boolean = false,
  headingDegrees?: number
): MovementDirectionResult => {
  const oldPosition = model.position.clone()
  const direction = new THREE.Vector3()
  if (headingDegrees === undefined) {
    model.getWorldDirection(direction)
  } else {
    const radians = THREE.MathUtils.degToRad(headingDegrees)
    direction.set(Math.sin(radians), 0, Math.cos(radians))
  }

  if (backward) {
    direction.negate()
  }
  direction.multiplyScalar(distance)

  const newPosition = oldPosition.clone().add(direction)

  return { direction, oldPosition, newPosition }
}

/** Result of obstacle check */
interface ObstacleCheckResult {
  /** Whether the path is clear of obstacles */
  canMove: boolean
  /** Array of intersection points if any */
  intersections: THREE.Intersection[]
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
  const normalizedDirection = direction.clone().normalize()
  const raycaster = new THREE.Raycaster(oldPosition, normalizedDirection, 0, collisionDistance)
  const intersections = raycaster.intersectObjects(bodies, true)

  return {
    canMove: intersections.length === 0,
    intersections
  }
}

/** Options for ground movement check */
interface GroundCheckOptions {
  /** Maximum height the character can step up */
  maxStepHeight: number
  /** Maximum distance to check for ground */
  maxGroundDistance: number
  /** Character radius for ground check offset */
  characterRadius: number
}

/** Result of ground movement validation */
interface GroundMovementResult {
  /** Whether movement is allowed */
  canMove: boolean
  /** The final position after ground adjustments */
  finalPosition: THREE.Vector3
  /** Debug info about which path was taken */
  debugInfo?: string
}

/**
 * Check ground with character radius offset
 */
const checkGroundWithRadius = (
  position: THREE.Vector3,
  forwardDirection: THREE.Vector3,
  bodies: ComplexModel[],
  options: GroundCheckOptions
): { hasGround: boolean; groundHeight: number | null } => {
  const { maxStepHeight, maxGroundDistance, characterRadius } = options
  const checkPosition = position.clone()
  checkPosition.y += maxStepHeight

  const horizontalForward = new THREE.Vector3(forwardDirection.x, 0, forwardDirection.z).normalize()
  checkPosition.add(horizontalForward.multiplyScalar(characterRadius))

  return checkGroundAtPosition(checkPosition, bodies, maxGroundDistance + maxStepHeight)
}

type AxisFallbackOptions = {
  axisCheck: { hasGround: boolean; groundHeight: number | null }
  axisMovement: number
  newX: number
  oldX: number
  newZ: number
  oldZ: number
  isXAxis: boolean
  debugLabel: string
}

/** Determine movement result for a single axis fallback */
const resolveAxisFallback = ({
  axisCheck,
  axisMovement,
  newX,
  oldX,
  newZ,
  oldZ,
  isXAxis,
  debugLabel
}: AxisFallbackOptions): GroundMovementResult | null => {
  if (!axisCheck.hasGround || axisMovement <= 0.001) return null
  const finalPosition = new THREE.Vector3(
    isXAxis ? newX : oldX,
    axisCheck.groundHeight ?? 0,
    isXAxis ? oldZ : newZ
  )
  return { canMove: true, finalPosition, debugInfo: debugLabel }
}

/** Resolve axis fallback when full movement has no ground */
const resolveAxisFallbacks = (
  oldPosition: THREE.Vector3,
  newPosition: THREE.Vector3,
  direction: THREE.Vector3,
  bodies: ComplexModel[],
  options: GroundCheckOptions
): GroundMovementResult => {
  const xOnlyPosition = oldPosition.clone()
  xOnlyPosition.x = newPosition.x
  const xOnlyCheck = checkGroundWithRadius(
    xOnlyPosition,
    new THREE.Vector3(Math.sign(direction.x), 0, 0),
    bodies,
    options
  )

  const zOnlyPosition = oldPosition.clone()
  zOnlyPosition.z = newPosition.z
  const zOnlyCheck = checkGroundWithRadius(
    zOnlyPosition,
    new THREE.Vector3(0, 0, Math.sign(direction.z)),
    bodies,
    options
  )

  const xMovement = Math.abs(newPosition.x - oldPosition.x)
  const zMovement = Math.abs(newPosition.z - oldPosition.z)

  if (xOnlyCheck.hasGround && zOnlyCheck.hasGround) {
    const finalPosition = newPosition.clone()
    if (xMovement >= zMovement) {
      finalPosition.x = newPosition.x
      finalPosition.z = oldPosition.z
      if (xOnlyCheck.groundHeight !== null) finalPosition.y = xOnlyCheck.groundHeight
    } else {
      finalPosition.x = oldPosition.x
      finalPosition.z = newPosition.z
      if (zOnlyCheck.groundHeight !== null) finalPosition.y = zOnlyCheck.groundHeight
    }
    return { canMove: true, finalPosition, debugInfo: 'Using axis with more movement' }
  }

  const xResult = resolveAxisFallback({
    axisCheck: xOnlyCheck,
    axisMovement: xMovement,
    newX: newPosition.x,
    oldX: oldPosition.x,
    newZ: newPosition.z,
    oldZ: oldPosition.z,
    isXAxis: true,
    debugLabel: 'Sliding on X axis'
  })
  if (xResult) return xResult

  const zResult = resolveAxisFallback({
    axisCheck: zOnlyCheck,
    axisMovement: zMovement,
    newX: newPosition.x,
    oldX: oldPosition.x,
    newZ: newPosition.z,
    oldZ: oldPosition.z,
    isXAxis: false,
    debugLabel: 'Sliding on Z axis'
  })
  if (zResult) return zResult

  return { canMove: false, finalPosition: oldPosition.clone(), debugInfo: 'No ground on any axis' }
}

/**
 * Validate ground for movement and handle axis fallback for edge walking
 */
const checkGroundForMovement = (
  oldPosition: THREE.Vector3,
  newPosition: THREE.Vector3,
  direction: THREE.Vector3,
  bodies: ComplexModel[],
  options: GroundCheckOptions
): GroundMovementResult => {
  const { maxStepHeight } = options
  const finalPosition = newPosition.clone()
  const forwardNormalized = direction.clone().normalize()
  const groundCheck = checkGroundWithRadius(newPosition, forwardNormalized, bodies, options)

  if (groundCheck.hasGround && groundCheck.groundHeight !== null) {
    const heightDifference = groundCheck.groundHeight - oldPosition.y

    if (heightDifference > maxStepHeight) {
      return { canMove: false, finalPosition: oldPosition.clone(), debugInfo: 'Step too high' }
    }

    finalPosition.y = groundCheck.groundHeight
    return { canMove: true, finalPosition, debugInfo: 'Full movement with ground' }
  }

  return resolveAxisFallbacks(oldPosition, newPosition, direction, bodies, options)
}

/**
 * Apply movement to model and rigid body
 */
const moveCharacter = (model: ComplexModel, position: THREE.Vector3): void => {
  const rigidBody = model.userData.body
  model.position.copy(position)
  rigidBody.setTranslation(position, true)
}

/** Log debug information for ground check result */
const logGroundDebug = (
  groundResult: GroundMovementResult,
  groundBodies: ComplexModel[],
  groundOptions: GroundCheckOptions
): void => {
  console.warn('[controllerForward] Ground check:', groundResult.debugInfo)
  console.warn('[controllerForward] Ground bodies checked:', groundBodies.length)
  console.warn('[controllerForward] Ground options:', groundOptions)
  if (groundBodies.length > 0) {
    console.warn(
      '[controllerForward] First ground body position:',
      groundBodies[0].position?.toArray?.() ?? 'N/A'
    )
  }
}

/** Perform ground validation and return updated canMove + finalPosition */
type GroundCheckMovementOptions = ControllerForwardOptions & { debug?: boolean }

const applyGroundCheck = (
  oldPosition: THREE.Vector3,
  newPosition: THREE.Vector3,
  direction: THREE.Vector3,
  groundBodies: ComplexModel[],
  options: GroundCheckMovementOptions
): { canMove: boolean; finalPosition: THREE.Vector3 } => {
  const { debug = false } = options
  const groundOptions: GroundCheckOptions = {
    maxStepHeight: options.maxStepHeight ?? 0.5,
    maxGroundDistance: options.maxGroundDistance ?? 2,
    characterRadius: options.characterRadius ?? 0.5
  }
  const groundResult = checkGroundForMovement(
    oldPosition,
    newPosition,
    direction,
    groundBodies,
    groundOptions
  )

  if (debug) {
    logGroundDebug(groundResult, groundBodies, groundOptions)
  }

  return { canMove: groundResult.canMove, finalPosition: groundResult.finalPosition }
}

/**
 * Move forward or backward if no collision is detected
 * Optionally checks for ground ahead and handles step climbing
 * @param obstacles Array of obstacle bodies to check horizontal collisions against
 * @param groundBodies Array of ground bodies to check for ground detection (vertical raycast)
 * @param animationData Animation data containing player, action, delta, etc.
 * @param options Controller forward options for ground and collision checks
 */
type ForwardMovementInput = {
  oldPosition: THREE.Vector3
  newPosition: THREE.Vector3
  direction: THREE.Vector3
  obstacles: ComplexModel[]
  groundBodies: ComplexModel[]
  options: ControllerForwardOptions & { debug: boolean }
}

const resolveForwardMovement = ({
  oldPosition,
  newPosition,
  direction,
  obstacles,
  groundBodies,
  options
}: ForwardMovementInput): { canMove: boolean; finalPosition: THREE.Vector3 } => {
  const { requireGround = false, collisionDistance = 10, debug } = options
  const obstacleResult = checkObstacles(oldPosition, direction, obstacles, collisionDistance)
  if (!obstacleResult.canMove) return { canMove: false, finalPosition: oldPosition.clone() }
  if (!requireGround) return { canMove: true, finalPosition: newPosition.clone() }
  return applyGroundCheck(oldPosition, newPosition, direction, groundBodies, { ...options, debug })
}

const resolveControllerOptions = (raw: ControllerForwardOptions) => ({
  maxStepHeight: raw.maxStepHeight ?? 0.5,
  maxGroundDistance: raw.maxGroundDistance ?? 2,
  requireGround: raw.requireGround ?? false,
  collisionDistance: raw.collisionDistance ?? 10,
  characterRadius: raw.characterRadius ?? 0.5,
  debug: raw.debug ?? false
})

const applyControllerMovement = (
  model: ComplexModel,
  canMove: boolean,
  finalPosition: THREE.Vector3,
  debug: boolean
): void => {
  if (canMove) {
    moveCharacter(model, finalPosition)
    if (debug) console.warn('[controllerForward] Final position:', finalPosition.toArray())
  } else if (debug) {
    console.warn('[controllerForward] Movement blocked')
  }
}

const controllerForward = (
  obstacles: ComplexModel[],
  groundBodies: ComplexModel[],
  animationData: AnimationData,
  rawOptions: ControllerForwardOptions = {}
): void => {
  const options = resolveControllerOptions(rawOptions)
  const { debug } = options
  const {
    actionName,
    player: model,
    backward = false,
    distance = 0,
    targetRotation
  } = animationData

  if (model.userData.performing && model.userData.allowMovement === false) return

  const { actions, mixer } = model.userData
  const { direction, oldPosition, newPosition } = getMovementDirection(
    model,
    distance,
    backward,
    targetRotation
  )

  const { canMove, finalPosition } = resolveForwardMovement({
    oldPosition,
    newPosition,
    direction,
    obstacles,
    groundBodies,
    options
  })

  applyControllerMovement(model, canMove, finalPosition, debug)

  const action = (actions as Record<string, THREE.AnimationAction | undefined>)?.[actionName]
  if (action && mixer) updateAnimation(animationData)
}

const controllerJump = (
  model: ComplexModel,
  _bodies: ComplexModel[],
  _distance: number,
  height: number
) => {
  const mesh = model
  mesh.position.y = mesh.position.y + height
}

/**
 * Rotate model on defined angle
 * @param model
 * @param angle angle in degrees
 * @returns true if rotation was applied, false if blocked
 */
const controllerTurn = (model: ComplexModel, angle: number): boolean => {
  if (model.userData.performing && model.userData.allowRotation === false) {
    return false
  }
  const radians = THREE.MathUtils.degToRad(angle)
  model.rotateOnAxis(new THREE.Vector3(0, 1, 0), radians)
  return true
}

/**
 * Set the model's rotation to face a specific direction
 * @param model The model to rotate
 * @param degrees The target rotation in degrees
 * @param modelOffset Offset in degrees to correct for models facing wrong direction
 * @returns true if rotation was applied, false if blocked
 */
const setRotation = (model: ComplexModel, degrees: number, modelOffset: number = 0): boolean => {
  if (model.userData.performing && model.userData.allowRotation === false) {
    return false
  }
  const radians = THREE.MathUtils.degToRad(degrees + modelOffset)
  model.rotation.y = radians
  return true
}

/** Default maximum rotation applied per step, in degrees, for 8-axis player turning */
const DEFAULT_ROTATION_STEP_DEGREES = 25

/**
 * Smoothly rotate a model toward a target Y rotation, capping the change per step.
 *
 * Interpolates along the shortest angular path so the model turns the natural way
 * (e.g. 350°→10° rotates +20°, not -340°). This drives only the visual turn; pair it
 * with a target-driven movement direction (see getMovementDirection's headingDegrees)
 * so the model heads straight to the target while its rotation visually catches up.
 * @param model The model to rotate
 * @param degrees Target rotation in degrees
 * @param stepDegrees Maximum degrees to rotate this step (default 25)
 * @param modelOffset Offset in degrees to correct for models facing wrong direction
 * @returns true if the model is now facing the target within this step, false if still turning or blocked
 */
const rotateTowards = (
  model: ComplexModel,
  degrees: number,
  stepDegrees: number = DEFAULT_ROTATION_STEP_DEGREES,
  modelOffset: number = 0
): boolean => {
  if (model.userData.performing && model.userData.allowRotation === false) {
    return false
  }
  const target = THREE.MathUtils.degToRad(degrees + modelOffset)
  const current = model.rotation.y
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  const maxStep = THREE.MathUtils.degToRad(Math.abs(stepDegrees))
  const aligned = Math.abs(difference) <= maxStep
  model.rotation.y = current + (aligned ? difference : Math.sign(difference) * maxStep)
  return aligned
}

/** Rotation mapping for directional input combinations */
const ROTATION_MAP: Record<string, number> = {
  up: 0,
  'up-right': 45,
  right: 90,
  'down-right': 135,
  down: 180,
  'down-left': 225,
  left: 270,
  'up-left': 315
}

const ROTATION_MAP_MIRRORED: Record<string, number> = {
  up: 0,
  'up-left': 45,
  left: 90,
  'down-left': 135,
  down: 180,
  'down-right': 225,
  right: 270,
  'up-right': 315
}

/**
 * Calculate target rotation based on directional input actions
 * @param currentActions Record of active control actions
 * @returns Target rotation in degrees (0, 45, 90, 135, 180, 225, 270, 315) or null if no movement
 */
const getRotation = (
  currentActions: Record<string, unknown>,
  mirrored: boolean = false
): number | null => {
  const map = mirrored ? ROTATION_MAP_MIRRORED : ROTATION_MAP
  const getAxisKey = (
    positive: unknown,
    negative: unknown,
    posLabel: string,
    negLabel: string
  ): string => {
    if (positive && !negative) return posLabel
    if (negative && !positive) return negLabel
    return ''
  }
  const key = [
    getAxisKey(currentActions['move-up'], currentActions['move-down'], 'up', 'down'),
    getAxisKey(currentActions['move-left'], currentActions['move-right'], 'left', 'right')
  ]
    .filter(Boolean)
    .join('-')

  return key ? (map[key] ?? null) : null
}

const bodyJump = (
  model: ComplexModel,
  bodies: ComplexModel[],
  distance: number,
  height: number
) => {
  const mesh = model
  const rigidBody = model.userData.body
  const collision = 27
  const oldPosition = mesh.position.clone()

  // Calculate the forward vector
  const forward = new THREE.Vector3()
  mesh.getWorldDirection(forward)
  forward.multiplyScalar(distance)

  // Create an upward vector
  const upward = new THREE.Vector3(0, height, 0)

  // Create a new position by adding the forward and upward vectors to the old position
  const newPosition = oldPosition.clone().add(upward)

  // Check for collisions with the new position
  const isColliding = bodies.some((body) => {
    const difference = body.position.distanceTo(newPosition)
    return difference < collision // Adjust this value based on your collision detection needs
  })

  if (!isColliding) {
    // Update the model's position and the rigid body's translation if no collision is detected
    mesh.position.copy(newPosition)
    rigidBody.setTranslation(newPosition, true)
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
  rotateTowards,
  DEFAULT_ROTATION_STEP_DEGREES,
  getRotation,
  bodyJump,
  checkGroundAtPosition,
  getMovementDirection,
  checkObstacles,
  checkGroundWithRadius,
  checkGroundForMovement,
  moveCharacter
}

export type {
  AnimationData,
  ControllerForwardOptions,
  MovementDirectionResult,
  ObstacleCheckResult,
  GroundCheckOptions,
  GroundMovementResult
}

// NEW: Timeline management exports
export { createTimelineManager } from './TimelineManager'
export type { TimelineManager } from './TimelineManager'

export { createTimelineLogger } from './TimelineLogger'
export type { TimelineLogger, TimelineLogEntry } from './TimelineLogger'

export {
  generateTimelineId,
  createDurationAction,
  createOneShotAction,
  createIntervalAction,
  canAddAction,
  getTimelineActionSpan,
  getTimelineSegmentOccurrences,
  getTimelineChartBars
} from './actions'

export type { TimelineChartBar, TimelineChartRange } from './actions'

export {
  createPopUpBounce,
  createPopUpFade,
  createPopUpScale,
  createSlideInFromSides,
  easing,
  sortOrder,
  calculateSequentialDelays
} from './pop-up-animations'
