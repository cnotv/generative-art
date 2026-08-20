import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { CoordinateTuple } from '@webgamekit/animation'
import { disposeObject, getBall, getCube, getTrimesh, removeElements } from '@webgamekit/threejs'
import type { ComplexModel } from '@webgamekit/threejs'
import {
  generateRectangularMazeAndSegments,
  getRectangularCellCenters
} from '@/views/Games/MazeGame/helpers/maze'
import type { MazeAlgorithm } from '@/views/Games/MazeGame/helpers/maze'
import { planMazeHoles } from './tilt'
import type { BoardLayout, LevelConfig, MazeHole, TiltMazeBoard } from './types'
import {
  BALL_COLOR,
  BOARD_COLOR,
  FLOOR_THICKNESS,
  GOAL_COLOR,
  HOLE_MARKER_Y,
  HOLE_RING_INNER_RATIO,
  HOLE_SPACING_IN_CELLS,
  TRAP_COLOR,
  WALL_COLOR,
  WALL_HEIGHT,
  WALL_THICKNESS
} from './config'

const HOLE_SEGMENTS = 24
/** Tolerance for deciding a wall segment sits on the board's outer edge. */
const BOUNDARY_EPSILON = 0.001

/**
 * Cut the holes out of the board slab itself rather than faking them with dark decals, so the
 * ball genuinely falls through and "did it drop in" is a Y check instead of a proximity guess.
 *
 * `ExtrudeGeometry` builds in the XY plane and extrudes along +Z; laying it flat with a -90°
 * turn about X maps shape-Y onto world -Z, which is why each hole's Z is negated here.
 */
const createBoardGeometry = (
  layout: BoardLayout,
  holes: readonly MazeHole[],
  holeRadius: number
): THREE.BufferGeometry => {
  const halfWidth = layout.boardWidth / 2
  const halfDepth = layout.boardDepth / 2
  const slab = new THREE.Shape()
    .moveTo(-halfWidth, -halfDepth)
    .lineTo(halfWidth, -halfDepth)
    .lineTo(halfWidth, halfDepth)
    .lineTo(-halfWidth, halfDepth)
    .lineTo(-halfWidth, -halfDepth)

  slab.holes = holes.map(({ position }) =>
    new THREE.Path().absarc(position[0], -position[2], holeRadius, 0, Math.PI * 2, false)
  )

  return new THREE.ExtrudeGeometry(slab, {
    depth: FLOOR_THICKNESS,
    bevelEnabled: false,
    curveSegments: HOLE_SEGMENTS
  })
}

/** Ring the board so the ball cannot escape through the maze's entrance and exit gaps. */
const createPerimeterWalls = (
  scene: THREE.Scene,
  world: RAPIER.World,
  layout: BoardLayout
): ComplexModel[] => {
  const halfWidth = layout.boardWidth / 2
  const halfDepth = layout.boardDepth / 2
  // One thickness longer than the board, not two: each side then ends exactly on the outer face
  // of the side it meets. Spanning two thicknesses overshoots by half a thickness and leaves a
  // stepped nub sticking out past both faces at every corner.
  const spanX = layout.boardWidth + WALL_THICKNESS
  const spanZ = layout.boardDepth + WALL_THICKNESS

  return [
    { position: [0, 0, -halfDepth] as CoordinateTuple, size: [spanX, WALL_HEIGHT, WALL_THICKNESS] },
    { position: [0, 0, halfDepth] as CoordinateTuple, size: [spanX, WALL_HEIGHT, WALL_THICKNESS] },
    { position: [-halfWidth, 0, 0] as CoordinateTuple, size: [WALL_THICKNESS, WALL_HEIGHT, spanZ] },
    { position: [halfWidth, 0, 0] as CoordinateTuple, size: [WALL_THICKNESS, WALL_HEIGHT, spanZ] }
  ].map(({ position, size }, index) =>
    getCube(scene, world, {
      name: `tilt-maze-perimeter-${index}`,
      position,
      size: size as CoordinateTuple,
      color: WALL_COLOR,
      type: 'fixed',
      castShadow: true,
      receiveShadow: true
    })
  )
}

const createMazeWalls = (
  scene: THREE.Scene,
  world: RAPIER.World,
  layout: BoardLayout,
  algorithm: MazeAlgorithm
): ComplexModel[] =>
  generateRectangularMazeAndSegments(
    layout.boardWidth,
    layout.boardDepth,
    layout.cellSize,
    algorithm
  )
    .segments // The generator also emits the maze's own outer boundary, which the perimeter already
    // closes. Drawing both puts two identical walls in the same plane — coincident faces that
    // z-fight, and a doubled edge that reads as a misaligned seam.
    .filter(({ position, horizontal }) =>
      horizontal
        ? Math.abs(Math.abs(position[2]) - layout.boardDepth / 2) > BOUNDARY_EPSILON
        : Math.abs(Math.abs(position[0]) - layout.boardWidth / 2) > BOUNDARY_EPSILON
    )
    .map(({ position, horizontal }, index) =>
      getCube(scene, world, {
        name: `tilt-maze-wall-${index}`,
        position: [position[0], 0, position[2]] as CoordinateTuple,
        // Each wall runs one thickness longer than its cell so it reaches half a thickness past
        // the grid corner at both ends. A wall exactly one cell long stops on the corner line,
        // which leaves the corner square open on the side no perpendicular wall covers — a
        // visible notch, and a gap the ball can catch on.
        size: (horizontal
          ? [layout.cellSize + WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS]
          : [WALL_THICKNESS, WALL_HEIGHT, layout.cellSize + WALL_THICKNESS]) as CoordinateTuple,
        color: WALL_COLOR,
        type: 'fixed',
        castShadow: true,
        receiveShadow: true
      })
    )

/** A ring sunk into each hole's mouth, marking the goal green and the traps black. */
const createHoleMarkers = (
  scene: THREE.Scene,
  holes: readonly MazeHole[],
  holeRadius: number
): THREE.Mesh[] =>
  holes.map((hole) => {
    const geometry = new THREE.RingGeometry(
      holeRadius * HOLE_RING_INNER_RATIO,
      holeRadius,
      HOLE_SEGMENTS
    )
    const material = new THREE.MeshBasicMaterial({
      color: hole.isGoal ? GOAL_COLOR : TRAP_COLOR,
      side: THREE.DoubleSide
    })
    const marker = new THREE.Mesh(geometry, material)
    marker.name = hole.isGoal ? 'tilt-maze-goal' : 'tilt-maze-trap'
    marker.rotation.x = -Math.PI / 2
    marker.position.set(hole.position[0], HOLE_MARKER_Y, hole.position[2])
    scene.add(marker)
    return marker
  })

/**
 * Build the whole board: a slab with holes cut through it, the maze walls standing on top,
 * a perimeter that keeps the ball in, and the ball itself.
 * @param scene The Three.js scene
 * @param world The Rapier physics world
 * @param layout Board extents derived from the viewport
 * @returns The ball and the holes it can fall through
 */
export const createTiltMazeBoard = (
  scene: THREE.Scene,
  world: RAPIER.World,
  layout: BoardLayout,
  level: LevelConfig
): TiltMazeBoard => {
  const holes = planMazeHoles(
    getRectangularCellCenters(layout.boardWidth, layout.boardDepth, layout.cellSize),
    layout.ballStart,
    level.trapCount,
    layout.cellSize * HOLE_SPACING_IN_CELLS
  )

  const board = getTrimesh(scene, world, createBoardGeometry(layout, holes, level.holeRadius), {
    name: 'tilt-maze-board',
    position: [0, -FLOOR_THICKNESS, 0],
    rotation: [-Math.PI / 2, 0, 0],
    color: BOARD_COLOR,
    friction: 0.4,
    receiveShadow: true,
    castShadow: false
  })

  const markers = createHoleMarkers(scene, holes, level.holeRadius)
  const walls = [
    ...createMazeWalls(scene, world, layout, level.algorithm),
    ...createPerimeterWalls(scene, world, layout)
  ]

  const ball = getBall(scene, world, {
    name: 'tilt-maze-ball',
    size: level.ballRadius,
    position: layout.ballStart,
    color: BALL_COLOR,
    // Matte rather than chrome: a mirror finish reads as a hard highlight that fights the
    // pastel palette, and hides which way the ball is rolling.
    metalness: 0.05,
    roughness: 0.55,
    type: 'dynamic',
    hasGravity: true,
    friction: 0.3,
    restitution: 0.12,
    // Low drag so the board's lean, not the ball's inertia, is what the player feels.
    damping: 0.12
  }) as unknown as ComplexModel

  /**
   * A new level replaces the board rather than editing it, so every body and every mesh built
   * here has to go. Rapier keeps its own registry, so removing the mesh alone would leave the
   * old walls colliding invisibly with the next level's ball.
   */
  const dispose = (): void => {
    removeElements(world, [ball, board, ...walls])
    markers.forEach((marker) => {
      marker.removeFromParent()
      disposeObject(marker)
    })
    ;[ball, board, ...walls].forEach(disposeObject)
  }

  return { ball, walls, holes, goal: holes.find((hole) => hole.isGoal), dispose }
}

/**
 * Return the ball to the start, clearing the momentum it fell in with.
 * @param ball The ball mesh carrying its Rapier body
 * @param layout The board the ball belongs to
 */
export const resetBall = (ball: ComplexModel, layout: BoardLayout): void => {
  const body = ball.userData?.body
  if (!body) return
  const [x, y, z] = layout.ballStart
  body.setTranslation({ x, y, z }, true)
  body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  ball.position.set(x, y, z)
}
