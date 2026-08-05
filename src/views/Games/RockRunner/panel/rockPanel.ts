import { reactive, ref, type Ref } from 'vue'
import * as THREE from 'three'
import { useDebugSceneStore } from '@/stores/debugScene'
import { registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { attachRockStroke } from '../elements/rockStroke'
import { RR_STICKMAN_CONTROLS } from './stickmanPanel'
import type { CharacterType, RockConfig, StickmanConfig } from '../types'
import {
  BASE_MAX_SPEED,
  FORWARD_IMPULSE,
  JUMP_COOLDOWN_SECONDS,
  JUMP_IMPULSE,
  MAX_LATERAL_SPEED,
  MAX_SPEED_CEILING,
  ROCK_ANGULAR_DAMPING,
  ROCK_ELEMENT_NAME,
  ROCK_FRICTION,
  ROCK_GRAVITY_SCALE,
  ROCK_LINEAR_DAMPING,
  ROCK_RADIUS,
  ROCK_RESTITUTION,
  ROCK_STROKE_WIDTH,
  ROCK_STROKE_COLOR,
  ROCK_STROKE_WOBBLE,
  ROCK_MASS,
  ROCK_TINT,
  SPEED_RAMP_DISTANCE,
  STEER_IMPULSE,
  STICKMAN_BASE_MAX_SPEED,
  STICKMAN_FORWARD_IMPULSE,
  STICKMAN_GRAVITY_SCALE,
  STICKMAN_JUMP_IMPULSE,
  STICKMAN_MAX_SPEED_CEILING
} from '../config'

/**
 * The handful of the shared sphere's own physics figures that read wrong
 * unchanged across characters — a running figure pushed and gravity-pulled
 * as hard as a boulder looks like it's being flung, not running.
 */
const characterPhysicsPreset = (
  characterType: CharacterType
): Pick<
  RockConfig,
  'forwardImpulse' | 'baseMaxSpeed' | 'maxSpeedCeiling' | 'jumpImpulse' | 'gravityScale'
> =>
  characterType === 'stickman'
    ? {
        forwardImpulse: STICKMAN_FORWARD_IMPULSE,
        baseMaxSpeed: STICKMAN_BASE_MAX_SPEED,
        maxSpeedCeiling: STICKMAN_MAX_SPEED_CEILING,
        jumpImpulse: STICKMAN_JUMP_IMPULSE,
        gravityScale: STICKMAN_GRAVITY_SCALE
      }
    : {
        forwardImpulse: FORWARD_IMPULSE,
        baseMaxSpeed: BASE_MAX_SPEED,
        maxSpeedCeiling: MAX_SPEED_CEILING,
        jumpImpulse: JUMP_IMPULSE,
        gravityScale: ROCK_GRAVITY_SCALE
      }

/**
 * The rock's tunables, grouped as they are felt rather than as they are stored:
 * what drives it, what holds it to the ground, and what it looks like.
 *
 * Restitution goes below zero on purpose. A ball that returns none of an impact
 * still bounces slightly off a seam; a negative value absorbs the impact
 * instead, which is what makes the rock read as heavy stone rather than rubber.
 */
export const RR_ROCK_CONTROLS = {
  forwardImpulse: { min: 0, max: 1000, step: 1, label: 'Drive force' },
  baseMaxSpeed: { min: 1, max: 80, step: 1, label: 'Starting top speed' },
  maxSpeedCeiling: { min: 1, max: 120, step: 1, label: 'Final top speed' },
  speedRampDistance: { min: 100, max: 20000, step: 100, label: 'Distance to reach it' },
  steerImpulse: { min: 0, max: 120, step: 1, label: 'Steering force', sectionStart: true },
  maxLateralSpeed: { min: 1, max: 60, step: 1, label: 'Steering top speed' },
  jumpImpulse: { min: 0, max: 15000, step: 50, label: 'Jump force' },
  jumpCooldown: { min: 0, max: 2, step: 0.05, label: 'Jump cooldown' },
  radius: { min: 0.5, max: 8, step: 0.1, label: 'Size', sectionStart: true },
  // Resistance to being pushed, and nothing else: a body's fall rate does not
  // depend on its mass, so raising this will never make the rock drop faster.
  mass: { min: 1, max: 400, step: 5, label: 'Mass' },
  // Gravity is a multiplier on the world's, not an acceleration: Rapier has one
  // world gravity and a body's weight is expressed against it.
  gravityScale: { min: 0.1, max: 100, step: 0.1, label: 'Gravity' },
  // Reaches far higher than the rising figure because it only governs the drop.
  // Stops short of where the rock starts sinking into the deck on landing.
  friction: { min: 0, max: 40, step: 0.5, label: 'Grip' },
  restitution: { min: -1, max: 1, step: 0.05, label: 'Bounce' },
  linearDamping: { min: 0, max: 5, step: 0.05, label: 'Rolling drag' },
  angularDamping: { min: 0, max: 5, step: 0.05, label: 'Spin drag' },
  tint: { label: 'Tint', color: true, sectionStart: true },
  // Relative to the rock's radius, so resizing the rock keeps its outline in
  // proportion. Zero removes the line rather than drawing a hairline.
  strokeWidth: { min: 0, max: 0.3, step: 0.005, label: 'Outline width' },
  strokeWobble: { min: 0, max: 2, step: 0.05, label: 'Outline wobble' },
  strokeColor: { label: 'Outline colour', color: true },
  autopilot: { boolean: true, label: 'Self driving' }
}

/**
 * The body's own settings, as opposed to what drives it.
 *
 * Registered twice over: as part of the rock's row in the elements panel, and
 * on its own in the config panel, where the values worth reaching for mid-run
 * are. Both edit one object, so neither can drift from the other.
 */
export const RR_ROCK_PHYSICS_CONTROLS = {
  radius: RR_ROCK_CONTROLS.radius,
  mass: RR_ROCK_CONTROLS.mass,
  gravityScale: RR_ROCK_CONTROLS.gravityScale,
  friction: RR_ROCK_CONTROLS.friction,
  restitution: RR_ROCK_CONTROLS.restitution,
  linearDamping: RR_ROCK_CONTROLS.linearDamping,
  angularDamping: RR_ROCK_CONTROLS.angularDamping,
  autopilot: RR_ROCK_CONTROLS.autopilot
}

export type RockPanelOptions = {
  /** Route the config panel keys its entry by. */
  routeName: string
  /** The live rock, absent until it spawns and replaced on every restart. */
  getRock: () => THREE.Object3D | undefined
  /** Which character is riding the sphere, which picks its physics preset. */
  characterType: CharacterType
  /**
   * The stickman's own cosmetic config, present only when it is the one
   * riding the sphere. Folded into the rock's own panel entry as a nested
   * "Stickman" group rather than a row of its own — one player wearing two
   * different looks, not two separate things to tune — and left out of both
   * the elements and config panels entirely for a plain rock run.
   */
  stickmanConfig: StickmanConfig | null
}

export type RockPanel = {
  config: RockConfig
  /** Pushes the whole config onto a rock, used when one is spawned or replaced. */
  apply: () => void
  teardown: () => void
}

type RockBody = {
  setGravityScale: (scale: number, wake: boolean) => void
  setLinearDamping: (damping: number) => void
  setAngularDamping: (damping: number) => void
}

type RockCollider = {
  setFriction: (friction: number) => void
  setRestitution: (restitution: number) => void
  setRadius?: (radius: number) => void
  setMass?: (mass: number) => void
}

const applyBody = (body: RockBody, config: RockConfig): void => {
  body.setGravityScale(config.gravityScale, true)
  body.setLinearDamping(config.linearDamping)
  body.setAngularDamping(config.angularDamping)
}

const applyCollider = (collider: RockCollider, config: RockConfig): void => {
  collider.setFriction(config.friction)
  collider.setRestitution(config.restitution)
  collider.setRadius?.(config.radius)
  collider.setMass?.(config.mass)
}

const applyTint = (rock: THREE.Object3D, tint: number): void => {
  const material = (rock as THREE.Mesh).material
  if (material instanceof THREE.MeshStandardMaterial) material.color.setHex(tint)
}

// The stickman's own fields nest arbitrarily deep now (parts.head.x), so a
// single-level property lookup no longer reaches them — this walks the
// remainder of the path, same as the config panel's own generic traversal
// already does for its half of the merged schema.
const getStickmanValue = (stickmanConfig: StickmanConfig, remainder: string): unknown =>
  remainder
    .split('.')
    .reduce<unknown>((object, key) => (object as Record<string, unknown>)?.[key], stickmanConfig)

const setStickmanValue = (
  stickmanConfig: StickmanConfig,
  remainder: string,
  value: unknown
): void => {
  const keys = remainder.split('.')
  const target = keys
    .slice(0, -1)
    .reduce<
      Record<string, unknown>
    >((object, key) => object[key] as Record<string, unknown>, stickmanConfig as unknown as Record<string, unknown>)
  target[keys[keys.length - 1]] = value
}

/**
 * Registers the rock in the elements panel with every tunable it is driven by.
 *
 * Physics settings are pushed straight onto the live body, so a slider changes
 * the rock mid-run rather than at the next spawn. The drive, steering and jump
 * figures are not pushed anywhere: the run loop reads this same object every
 * frame, which is what keeps a change felt on the very next input.
 *
 * @param options - Access to the live rock, which is replaced on every restart
 * @returns The shared config, a re-apply hook for new rocks, and a teardown
 */
export const registerRockElements = (options: RockPanelOptions): RockPanel => {
  const debugSceneStore = useDebugSceneStore()
  const preset = characterPhysicsPreset(options.characterType)
  const config = reactive<RockConfig>({
    forwardImpulse: preset.forwardImpulse,
    baseMaxSpeed: preset.baseMaxSpeed,
    maxSpeedCeiling: preset.maxSpeedCeiling,
    speedRampDistance: SPEED_RAMP_DISTANCE,
    steerImpulse: STEER_IMPULSE,
    maxLateralSpeed: MAX_LATERAL_SPEED,
    jumpImpulse: preset.jumpImpulse,
    jumpCooldown: JUMP_COOLDOWN_SECONDS,
    radius: ROCK_RADIUS,
    gravityScale: preset.gravityScale,
    mass: ROCK_MASS,
    friction: ROCK_FRICTION,
    restitution: ROCK_RESTITUTION,
    linearDamping: ROCK_LINEAR_DAMPING,
    angularDamping: ROCK_ANGULAR_DAMPING,
    tint: ROCK_TINT,
    strokeWidth: ROCK_STROKE_WIDTH,
    strokeWobble: ROCK_STROKE_WOBBLE,
    strokeColor: ROCK_STROKE_COLOR,
    autopilot: true
  })

  const apply = (): void => {
    const rock = options.getRock()
    if (!rock) return
    const { body, collider } = rock.userData as { body?: RockBody; collider?: RockCollider }
    if (body) applyBody(body, config)
    if (collider) applyCollider(collider, config)
    rock.scale.setScalar(config.radius / ROCK_RADIUS)
    applyTint(rock, config.tint)
    attachRockStroke(rock, config.strokeWidth, config.strokeWobble, config.strokeColor)
  }

  const stickmanConfig = options.stickmanConfig
  const stickmanPath = 'stickman.'

  debugSceneStore.addSceneElement(
    { name: ROCK_ELEMENT_NAME, type: 'Mesh', label: 'Player', hidden: false },
    {
      title: 'Player',
      type: 'Mesh',
      schema: stickmanConfig
        ? { ...RR_ROCK_CONTROLS, stickman: RR_STICKMAN_CONTROLS }
        : RR_ROCK_CONTROLS,
      getValue: (path: string) => {
        if (stickmanConfig && path.startsWith(stickmanPath)) {
          return getStickmanValue(stickmanConfig, path.slice(stickmanPath.length))
        }
        return config[path as keyof RockConfig]
      },
      updateValue: (path: string, value: unknown) => {
        if (stickmanConfig && path.startsWith(stickmanPath)) {
          setStickmanValue(stickmanConfig, path.slice(stickmanPath.length), value)
          return
        }
        config[path as keyof RockConfig] = value as number
        // The ramp runs from the starting speed to the final one, so a ceiling
        // dragged below the floor would have the rock slow down as it went.
        if (config.maxSpeedCeiling < config.baseMaxSpeed) {
          config.maxSpeedCeiling = config.baseMaxSpeed
        }
        apply()
      }
    }
  )

  // The config panel is one schema per route, so the stickman's cosmetic
  // fields are attached onto the rock's own config object as a nested
  // "stickman" group rather than getting a registration of their own.
  // Runtime-only: RockConfig's own type stays untouched for every other
  // place that reads it.
  if (stickmanConfig) {
    ;(config as RockConfig & { stickman?: StickmanConfig }).stickman = stickmanConfig
  }

  // Handed the same reactive object the elements panel edits, not a copy of it,
  // so the two rows cannot disagree and a change from either reaches the body.
  registerViewConfig(
    options.routeName,
    ref(config) as Ref<Record<string, unknown>>,
    stickmanConfig
      ? { ...RR_ROCK_PHYSICS_CONTROLS, stickman: RR_STICKMAN_CONTROLS }
      : RR_ROCK_PHYSICS_CONTROLS,
    apply
  )

  return {
    config,
    apply,
    teardown: () => {
      unregisterViewConfig(options.routeName)
      debugSceneStore.removeSceneElement(ROCK_ELEMENT_NAME)
    }
  }
}
