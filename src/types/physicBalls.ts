import type { ModelOptions, CoordinateTuple } from '@webgamekit/threejs'

export type PhysicBallKind = 'ball' | 'model'

/**
 * A reusable ball definition with its own physics, shared by the PhysicExamples
 * playground and the marble editor spawner. `options` holds the physics/render
 * settings as authored for the large PhysicExamples arena; `editor` shrinks the
 * visual/collider size to marble scale while leaving the physics untouched.
 */
export interface PhysicBallPreset {
  id: string
  label: string
  kind: PhysicBallKind
  /** GLB filename, required when kind is 'model'. */
  model?: string
  /** Randomise the colour per spawn (e.g. balloons). */
  randomColor?: boolean
  /** Randomise the rotation per spawn (e.g. crumpled paper). */
  randomRotation?: boolean
  options: ModelOptions
  /** Marble-scale size/scale overrides applied only inside the marble editor. */
  editor?: { size?: number; scale?: CoordinateTuple }
}
