import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { getBall, getModel } from '@webgamekit/threejs'
import type { ModelOptions, CoordinateTuple } from '@webgamekit/threejs'
import type { ComplexModel } from '@webgamekit/animation'
import type { PhysicBallPreset } from '@/types/physicBalls'
import bowlingTexture from '@/assets/images/textures/bowling.png'

// The six PhysicExamples balls, each with its own physics. Sizes/scales are the
// original arena values; the `editor` block shrinks them to marble scale for the
// marble editor without changing weight, restitution, friction or damping.
export const PHYSIC_BALLS: PhysicBallPreset[] = [
  {
    id: 'rubber',
    label: 'Rubber',
    kind: 'ball',
    options: {
      size: 4,
      weight: 120,
      restitution: 0.75,
      metalness: 0.3,
      reflectivity: 0.2,
      roughness: 0.8,
      transmission: 0.5,
      color: 0xff3333
    },
    editor: { size: 0.45 }
  },
  {
    id: 'balloon',
    label: 'Balloon',
    kind: 'model',
    model: 'balloon.glb',
    randomColor: true,
    options: {
      rotation: [-0.5, 0, 1],
      scale: [70, 70, 70],
      size: 10,
      damping: 0.8,
      restitution: -0.5,
      weight: 5,
      material: 'MeshPhysicalMaterial',
      transparent: true,
      opacity: 0.55,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transmission: 0.35,
      ior: 1.4,
      reflectivity: 0.7
    },
    editor: { size: 1.3, scale: [9, 9, 9] }
  },
  {
    id: 'bowling',
    label: 'Bowling',
    kind: 'ball',
    options: {
      size: 15,
      weight: 50,
      restitution: -0.3,
      texture: bowlingTexture,
      color: 0xffffff,
      friction: 10
    },
    editor: { size: 1.8 }
  },
  {
    id: 'paper',
    label: 'Paper',
    kind: 'model',
    model: 'paper_low.glb',
    randomRotation: true,
    options: {
      scale: [5, 5, 5],
      size: 3,
      friction: 100,
      angular: 10,
      damping: 0.2,
      restitution: -0.5,
      weight: 8
    },
    editor: { size: 0.3, scale: [0.51, 0.51, 0.51] }
  },
  {
    id: 'tennis',
    label: 'Tennis',
    kind: 'model',
    model: 'tennis.glb',
    options: {
      scale: [6, 6, 6],
      size: 6,
      weight: 50,
      friction: 5,
      angular: 1,
      restitution: 0.6
    },
    editor: { size: 0.63, scale: [0.63, 0.63, 0.63] }
  },
  {
    id: 'pingpong',
    label: 'Ping Pong',
    kind: 'ball',
    options: {
      size: 3,
      weight: 40,
      restitution: 0.8,
      damping: 0.1,
      color: 0xffffff,
      roughness: 0.9
    },
    editor: { size: 0.15 }
  }
]

// The default marble is a spawner ball type alongside the presets, but is built
// by the marble race (tunable physics + player texture), not from a preset.
export const MARBLE_BALL_LABEL = 'Marble'

export const BALL_TYPE_LABELS: string[] = [
  MARBLE_BALL_LABEL,
  ...PHYSIC_BALLS.map((preset) => preset.label)
]

/**
 * Resolve a preset by its dropdown label. Returns undefined for the default
 * marble (which has no preset) or an unknown label.
 * @param label The ball type label selected in the config panel.
 * @returns The matching preset, or undefined.
 */
export const findPresetByLabel = (label: string): PhysicBallPreset | undefined =>
  PHYSIC_BALLS.find((preset) => preset.label === label)

/**
 * Pick which ball type to spawn: a random label when randomType is on, else the
 * selected one.
 * @param labels The available ball type labels.
 * @param selected The currently selected label.
 * @param randomType When true, pick a random label instead of the selected one.
 * @param random Random source in [0, 1); injectable for tests.
 * @returns The chosen ball type label.
 */
export const pickBallType = (
  labels: string[],
  selected: string,
  randomType: boolean,
  random: () => number = Math.random
): string => (randomType ? labels[Math.floor(random() * labels.length)] : selected)

/**
 * Merge a preset's options with a spawn position, optionally applying the
 * marble-scale `editor` size/scale overrides. Pure — randomised colour/rotation
 * are applied by spawnPhysicBall, not here, so this stays deterministic.
 * @param preset The ball preset to resolve.
 * @param position World position to spawn the ball at.
 * @param useEditorScale Whether to apply the marble-scale editor overrides.
 * @returns The merged model options.
 */
export const mergeBallOptions = (
  preset: PhysicBallPreset,
  position: CoordinateTuple,
  useEditorScale: boolean
): ModelOptions => {
  const base: ModelOptions = { ...preset.options, position }
  if (!useEditorScale || !preset.editor) return base
  return {
    ...base,
    ...(preset.editor.size !== undefined ? { size: preset.editor.size } : {}),
    ...(preset.editor.scale ? { scale: preset.editor.scale } : {})
  }
}

const randomRotation = (): CoordinateTuple => [
  Math.random() * Math.PI * 2,
  Math.random() * Math.PI * 2,
  Math.random() * Math.PI * 2
]

/**
 * Spawn a physic ball into the scene from a preset, returning its ComplexModel.
 * Handles both primitive (getBall) and GLB (getModel) presets and applies any
 * per-spawn randomised colour/rotation.
 * @param scene The Three.js scene.
 * @param world The Rapier physics world.
 * @param preset The ball preset to spawn.
 * @param position World position to spawn at.
 * @param options Spawn options; set `editor` to shrink to marble scale.
 * @returns The spawned ComplexModel with physics attached.
 */
export const spawnPhysicBall = async (
  scene: THREE.Scene,
  world: RAPIER.World,
  preset: PhysicBallPreset,
  position: CoordinateTuple,
  { editor = false }: { editor?: boolean } = {}
): Promise<ComplexModel> => {
  const options: ModelOptions = {
    ...mergeBallOptions(preset, position, editor),
    ...(preset.randomColor ? { color: Math.floor(Math.random() * 0xffffff) } : {}),
    ...(preset.randomRotation ? { rotation: randomRotation() } : {})
  }
  if (preset.kind === 'model' && preset.model) {
    return getModel(scene, world, preset.model, options)
  }
  return getBall(scene, world, options) as unknown as ComplexModel
}
