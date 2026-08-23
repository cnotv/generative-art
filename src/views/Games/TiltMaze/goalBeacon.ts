import * as THREE from 'three'
import {
  GOAL_BEACON_MAX_OPACITY,
  GOAL_BEACON_MIN_OPACITY,
  GOAL_BEACON_PULSE_SECONDS,
  GOAL_BEACON_SEGMENTS,
  GOAL_BEACON_INNER_RATIO,
  GOAL_BEACON_OUTER_RATIO,
  GOAL_BEACON_SWELL,
  GOAL_BEACON_Y,
  GOAL_COLOR,
  HOLE_MARKER_RENDER_ORDER
} from './config'
import type { MazeHole } from './types'

const FULL_TURN = Math.PI * 2

/**
 * A light hovering over the goal, breathing in place.
 *
 * The ring keeps the pastel green it always had; colour alone cannot carry the goal on a pastel
 * board, but movement can. Nothing else on the board pulses, so it reads as "here" from the
 * corner of the eye without shouting. It sits on the ring rather than beside it, so the two are
 * one mark, and the mouth of the hole stays open through the middle of it.
 * @param scene The scene to add the beacon to
 * @param goal The hole to mark, or undefined when a board has none
 * @param holeRadius The radius the goal ring was drawn at
 * @returns A per-frame update and a disposer
 */
export const createGoalBeacon = (
  scene: THREE.Scene,
  goal: MazeHole | undefined,
  holeRadius: number
): { update: (elapsedSeconds: number) => void; dispose: () => void } => {
  if (!goal) {
    return { update: () => {}, dispose: () => {} }
  }

  const geometry = new THREE.RingGeometry(
    holeRadius * GOAL_BEACON_INNER_RATIO,
    holeRadius * GOAL_BEACON_OUTER_RATIO,
    GOAL_BEACON_SEGMENTS
  )
  const material = new THREE.MeshBasicMaterial({
    color: GOAL_COLOR,
    transparent: true,
    // Hovers over the marker, so it needs the same nudge off the slab the marker gets.
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  })

  const beacon = new THREE.Mesh(geometry, material)
  beacon.name = 'tilt-maze-goal-beacon'
  beacon.rotation.x = -Math.PI / 2
  beacon.renderOrder = HOLE_MARKER_RENDER_ORDER + 1
  beacon.position.set(goal.position[0], GOAL_BEACON_Y, goal.position[2])
  scene.add(beacon)

  const update = (elapsedSeconds: number): void => {
    const phase = 0.5 + 0.5 * Math.sin((elapsedSeconds / GOAL_BEACON_PULSE_SECONDS) * FULL_TURN)
    material.opacity =
      GOAL_BEACON_MIN_OPACITY + (GOAL_BEACON_MAX_OPACITY - GOAL_BEACON_MIN_OPACITY) * phase
    const scale = 1 + GOAL_BEACON_SWELL * phase
    beacon.scale.set(scale, scale, 1)
  }

  update(0)

  return {
    update,
    dispose: (): void => {
      scene.remove(beacon)
      geometry.dispose()
      material.dispose()
    }
  }
}
