import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'

export type CoordinateTuple = [number, number, number]
export type Model = THREE.Object3D<THREE.Object3DEventMap>
export type ModelType = 'fixed' | 'dynamic' | 'kinematicVelocityBased' | 'kinematicPositionBased'

export interface Timeline {
  // Existing fields
  name?: string
  action?: (element?: unknown) => void
  actionStart?: (loop: number, element?: unknown) => void
  start?: number
  end?: number
  frequency?: number
  interval?: [number, number] // Interval as a range [start, end]
  delay?: number

  // Enhanced fields (all optional for backward compatibility)
  id?: string // Unique identifier (auto-generated if not provided)
  category?: string // For logging/filtering ("user-input", "ai-behavior", "physics")
  duration?: number // Duration in frames (calculates end = start + duration)
  autoRemove?: boolean // Auto-remove when complete
  onComplete?: (element?: unknown) => void // Callback on completion
  priority?: number // Execution priority (higher = earlier, default: 0)
  enabled?: boolean // Can be toggled on/off (default: true)
  metadata?: Record<string, unknown> // Custom data
  segments?: { name: string; frames: number }[] // Repeating per-cycle move breakdown for timeline visualization
}

export interface ComplexModel extends Model {
  userData: Record<string, unknown> & {
    body: RAPIER.RigidBody
    collider: RAPIER.Collider
    initialValues: {
      size: number | CoordinateTuple
      rotation: CoordinateTuple
      position: CoordinateTuple
      color: number | undefined
    }
    type: ModelType
    characterController?: RAPIER.KinematicCharacterController
    helper?: THREE.Object3D
    hasGravity?: boolean
    gravityScale?: number
    actions: Record<string, THREE.AnimationAction | undefined>
    mixer?: THREE.AnimationMixer
    /** Degrees added to the model's facing to correct a front/back-inverted model */
    facingOffset?: number
    /** Face the model along the mirrored (left/right-swapped) heading */
    mirroredFacing?: boolean
  }
}

export type Direction = 'forward' | 'right' | 'left' | 'backward' | 'jump'

export type EasingFunction = (t: number) => number

export interface PopUpAnimationConfig {
  object: Model
  startY: number
  endY: number
  duration: number // in frames
  easing?: EasingFunction
  delay?: number // in frames
  onComplete?: () => void
}
