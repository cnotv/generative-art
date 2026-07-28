import { reactive } from 'vue'
import * as THREE from 'three'
import { useDebugSceneStore } from '@/stores/debugScene'
import type { RockConfig } from './types'
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
  ROCK_FALL_GRAVITY_SCALE,
  ROCK_GRAVITY_SCALE,
  ROCK_LINEAR_DAMPING,
  ROCK_RADIUS,
  ROCK_RESTITUTION,
  ROCK_TINT,
  SPEED_RAMP_DISTANCE,
  STEER_IMPULSE
} from './config'

/**
 * The rock's tunables, grouped as they are felt rather than as they are stored:
 * what drives it, what holds it to the ground, and what it looks like.
 *
 * Restitution goes below zero on purpose. A ball that returns none of an impact
 * still bounces slightly off a seam; a negative value absorbs the impact
 * instead, which is what makes the rock read as heavy stone rather than rubber.
 */
export const RR_ROCK_CONTROLS = {
  forwardImpulse: { min: 0, max: 60, step: 0.5, label: 'Drive force' },
  baseMaxSpeed: { min: 1, max: 80, step: 1, label: 'Starting top speed' },
  maxSpeedCeiling: { min: 1, max: 120, step: 1, label: 'Final top speed' },
  speedRampDistance: { min: 100, max: 20000, step: 100, label: 'Distance to reach it' },
  steerImpulse: { min: 0, max: 120, step: 1, label: 'Steering force', sectionStart: true },
  maxLateralSpeed: { min: 1, max: 60, step: 1, label: 'Steering top speed' },
  jumpImpulse: { min: 0, max: 6000, step: 25, label: 'Jump force' },
  jumpCooldown: { min: 0, max: 2, step: 0.05, label: 'Jump cooldown' },
  radius: { min: 0.5, max: 8, step: 0.1, label: 'Size', sectionStart: true },
  // Gravity is a multiplier on the world's, not an acceleration: Rapier has one
  // world gravity and a body's weight is expressed against it.
  gravityScale: { min: 0.1, max: 40, step: 0.1, label: 'Gravity' },
  // Reaches far higher than the rising figure because it only governs the drop.
  // Stops short of where the rock starts sinking into the deck on landing.
  fallGravityScale: { min: 0.1, max: 120, step: 1, label: 'Fall gravity' },
  friction: { min: 0, max: 40, step: 0.5, label: 'Grip' },
  restitution: { min: -1, max: 1, step: 0.05, label: 'Bounce' },
  linearDamping: { min: 0, max: 5, step: 0.05, label: 'Rolling drag' },
  angularDamping: { min: 0, max: 5, step: 0.05, label: 'Spin drag' },
  tint: { label: 'Tint', color: true, sectionStart: true }
}

export type RockPanelOptions = {
  /** The live rock, absent until it spawns and replaced on every restart. */
  getRock: () => THREE.Object3D | undefined
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
}

const applyTint = (rock: THREE.Object3D, tint: number): void => {
  const material = (rock as THREE.Mesh).material
  if (material instanceof THREE.MeshStandardMaterial) material.color.setHex(tint)
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
  const config = reactive<RockConfig>({
    forwardImpulse: FORWARD_IMPULSE,
    baseMaxSpeed: BASE_MAX_SPEED,
    maxSpeedCeiling: MAX_SPEED_CEILING,
    speedRampDistance: SPEED_RAMP_DISTANCE,
    steerImpulse: STEER_IMPULSE,
    maxLateralSpeed: MAX_LATERAL_SPEED,
    jumpImpulse: JUMP_IMPULSE,
    jumpCooldown: JUMP_COOLDOWN_SECONDS,
    radius: ROCK_RADIUS,
    gravityScale: ROCK_GRAVITY_SCALE,
    fallGravityScale: ROCK_FALL_GRAVITY_SCALE,
    friction: ROCK_FRICTION,
    restitution: ROCK_RESTITUTION,
    linearDamping: ROCK_LINEAR_DAMPING,
    angularDamping: ROCK_ANGULAR_DAMPING,
    tint: ROCK_TINT
  })

  const apply = (): void => {
    const rock = options.getRock()
    if (!rock) return
    const { body, collider } = rock.userData as { body?: RockBody; collider?: RockCollider }
    if (body) applyBody(body, config)
    if (collider) applyCollider(collider, config)
    rock.scale.setScalar(config.radius / ROCK_RADIUS)
    applyTint(rock, config.tint)
  }

  debugSceneStore.addSceneElement(
    { name: ROCK_ELEMENT_NAME, type: 'Mesh', label: 'Player rock', hidden: false },
    {
      title: 'Player rock',
      type: 'Mesh',
      schema: RR_ROCK_CONTROLS,
      getValue: (path: string) => config[path as keyof RockConfig],
      updateValue: (path: string, value: unknown) => {
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

  return {
    config,
    apply,
    teardown: () => debugSceneStore.removeSceneElement(ROCK_ELEMENT_NAME)
  }
}
