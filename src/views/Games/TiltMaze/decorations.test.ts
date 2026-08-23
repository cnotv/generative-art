import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { createGoalBeacon } from './goalBeacon'
import { createLevelPoster } from './levelPoster'
import { GOAL_BEACON_MAX_OPACITY, GOAL_BEACON_MIN_OPACITY, GOAL_COLOR } from './config'
import type { BoardLayout, MazeHole } from './types'

const layout: BoardLayout = {
  columns: 6,
  rows: 8,
  cellSize: 10,
  boardWidth: 60,
  boardDepth: 80,
  ballStart: [-25, 2, -35]
}

const holes: MazeHole[] = [
  { position: [10, 0, 10], isGoal: false },
  { position: [-20, 0, 20], isGoal: true }
]

const goal = holes[1]

describe('createGoalBeacon', () => {
  it('marks the goal where the goal is', () => {
    const scene = new THREE.Scene()

    createGoalBeacon(scene, goal, 4)

    const beacon = scene.getObjectByName('tilt-maze-goal-beacon')!
    expect([beacon.position.x, beacon.position.z]).toEqual([goal.position[0], goal.position[2]])
  })

  it('is a ring, so the mouth of the hole stays open through it', () => {
    // A filled disc would cover the one thing the player is aiming at.
    const scene = new THREE.Scene()

    createGoalBeacon(scene, goal, 4)

    const beacon = scene.getObjectByName('tilt-maze-goal-beacon') as THREE.Mesh
    expect(beacon.geometry.type).toBe('RingGeometry')
  })

  it('wears the same green as the ring it sits on', () => {
    const scene = new THREE.Scene()

    createGoalBeacon(scene, goal, 4)

    const beacon = scene.getObjectByName('tilt-maze-goal-beacon') as THREE.Mesh
    expect((beacon.material as THREE.MeshBasicMaterial).color.getHex()).toBe(GOAL_COLOR)
  })

  it.each([0, 0.4, 1.1, 2.7, 5])('keeps the pulse within its bounds at %ss', (seconds) => {
    const scene = new THREE.Scene()
    const beacon = createGoalBeacon(scene, goal, 4)

    beacon.update(seconds)

    const mesh = scene.getObjectByName('tilt-maze-goal-beacon') as THREE.Mesh
    const { opacity } = mesh.material as THREE.MeshBasicMaterial
    expect(opacity).toBeGreaterThanOrEqual(GOAL_BEACON_MIN_OPACITY - 0.001)
    expect(opacity).toBeLessThanOrEqual(GOAL_BEACON_MAX_OPACITY + 0.001)
  })

  it('does nothing for a board with no goal rather than throwing', () => {
    const scene = new THREE.Scene()

    const beacon = createGoalBeacon(scene, undefined, 4)

    expect(() => beacon.update(1)).not.toThrow()
    expect(() => beacon.dispose()).not.toThrow()
    expect(scene.getObjectByName('tilt-maze-goal-beacon')).toBeUndefined()
  })

  it('leaves nothing behind when disposed', () => {
    const scene = new THREE.Scene()
    const beacon = createGoalBeacon(scene, goal, 4)

    beacon.dispose()

    expect(scene.getObjectByName('tilt-maze-goal-beacon')).toBeUndefined()
  })
})

describe('createLevelPoster', () => {
  it('cuts every hole out of the print, so a drop never reads as a number', () => {
    const scene = new THREE.Scene()

    createLevelPoster(scene, layout, holes, 4)

    const poster = scene.getObjectByName('level-poster') as THREE.Mesh
    const { position } = poster.geometry.attributes
    // A plain rectangle triangulates to four corners; the cut-outs add many more.
    expect(position.count).toBeGreaterThan(4)
  })

  it('lies flat on the board rather than standing up in it', () => {
    const scene = new THREE.Scene()

    createLevelPoster(scene, layout, holes, 4)

    const poster = scene.getObjectByName('level-poster')!
    expect(poster.rotation.x).toBeCloseTo(-Math.PI / 2)
  })

  it('redraws for a new level without rebuilding the scene', () => {
    const scene = new THREE.Scene()
    const poster = createLevelPoster(scene, layout, holes, 4)
    const before = scene.children.length

    poster.update(7)

    expect(scene.children).toHaveLength(before)
  })

  it('leaves nothing behind when disposed', () => {
    const scene = new THREE.Scene()
    const poster = createLevelPoster(scene, layout, holes, 4)

    poster.dispose()

    expect(scene.getObjectByName('level-poster')).toBeUndefined()
  })

  it('survives a canvas with no 2d context rather than failing the level build', () => {
    const scene = new THREE.Scene()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValueOnce(null)

    expect(() => createLevelPoster(scene, layout, holes, 4)).not.toThrow()
  })
})
