import * as THREE from 'three'
import {
  LEVEL_POSTER_CANVAS_SIZE,
  LEVEL_POSTER_HEIGHT_RATIO,
  LEVEL_POSTER_LIFT,
  LEVEL_POSTER_OPACITY,
  LEVEL_POSTER_RENDER_ORDER,
  LEVEL_POSTER_WIDTH_RATIO
} from './config'
import type { BoardLayout, MazeHole } from './types'

const LABEL_BASELINE = 0.36
const NUMBER_BASELINE = 0.44
const LABEL_DIVISOR = 7
const NUMBER_DIVISOR = 1.7

/**
 * Draw the poster face: a label above a large level number, framed like the office posters in
 * MazeGame so the two read as the same object in different rooms.
 * @param context The poster canvas context
 * @param level The level to show
 */
const drawFace = (context: CanvasRenderingContext2D, level: number): void => {
  const size = LEVEL_POSTER_CANVAS_SIZE

  // No panel and no frame: the words are printed straight onto the board, so the canvas stays
  // transparent everywhere the glyphs are not.
  context.clearRect(0, 0, size, size)

  context.fillStyle = '#2b2438'
  context.textAlign = 'center'

  context.font = `bold ${Math.round(size / LABEL_DIVISOR)}px Impact, 'Arial Black', sans-serif`
  context.textBaseline = 'alphabetic'
  context.fillText('LEVEL', size / 2, size * LABEL_BASELINE)

  context.font = `bold ${Math.round(size / NUMBER_DIVISOR)}px Impact, 'Arial Black', sans-serif`
  context.textBaseline = 'top'
  context.fillText(String(level), size / 2, size * NUMBER_BASELINE)
}

/**
 * ShapeGeometry lays UVs out in shape coordinates, which for a centred rectangle runs negative.
 * Remapping to 0..1 across the poster's own bounds puts the drawing where it belongs.
 * @param geometry The poster geometry
 * @param width Poster width in world units
 * @param height Poster height in world units
 */
const remapPosterUvs = (geometry: THREE.ShapeGeometry, width: number, height: number): void => {
  const positions = geometry.attributes.position
  const uvs = new Float32Array(positions.count * 2)

  Array.from({ length: positions.count }).forEach((_unused, index) => {
    uvs[index * 2] = positions.getX(index) / width + 0.5
    uvs[index * 2 + 1] = positions.getY(index) / height + 0.5
  })

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

/**
 * Print the level onto the board floor, centred, under the maze.
 *
 * A wall poster is what MazeGame hangs, but this camera looks straight down: a vertical surface
 * would be edge-on and unreadable. Lying it on the floor keeps the same object legible, and the
 * walls draw over it, so it reads as printed on the board rather than floating above it.
 * @param scene The scene to add the poster to
 * @param layout The board being printed on
 * @param holes The holes cut through the board, cut out of the poster too
 * @param holeRadius The radius those holes were cut at
 * @returns A function that rewrites the poster for a new level
 */
export const createLevelPoster = (
  scene: THREE.Scene,
  layout: BoardLayout,
  holes: readonly MazeHole[],
  holeRadius: number
): { update: (level: number) => void; dispose: () => void } => {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: LEVEL_POSTER_CANVAS_SIZE,
    height: LEVEL_POSTER_CANVAS_SIZE
  })
  const context = canvas.getContext('2d')

  const shortSide = Math.min(layout.boardWidth, layout.boardDepth)
  const width = shortSide * LEVEL_POSTER_WIDTH_RATIO
  const height = width * LEVEL_POSTER_HEIGHT_RATIO

  const texture = new THREE.CanvasTexture(canvas)
  // Lies on the floor, so it needs the same depth nudge the hole markers get, one step less so
  // the two never contend. See documentation/docs/journey/z-fighting.md.
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: LEVEL_POSTER_OPACITY,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  })
  // Cut the same holes out of the poster that are cut out of the slab. Without this the poster
  // spans the mouths and you read the level number where the drop should be.
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, -height / 2)
  shape.lineTo(width / 2, -height / 2)
  shape.lineTo(width / 2, height / 2)
  shape.lineTo(-width / 2, height / 2)
  shape.closePath()
  // Shape space maps to world x and -z, the same convention the slab is cut in.
  shape.holes = holes.map(({ position }) =>
    new THREE.Path().absarc(position[0], -position[2], holeRadius, 0, Math.PI * 2, false)
  )
  const geometry = new THREE.ShapeGeometry(shape)
  const mesh = new THREE.Mesh(geometry, material)

  remapPosterUvs(geometry, width, height)
  mesh.name = 'level-poster'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, LEVEL_POSTER_LIFT, 0)
  // Drawn after the floor and before the hole markers, so a marker over the poster wins.
  mesh.renderOrder = LEVEL_POSTER_RENDER_ORDER
  scene.add(mesh)

  const update = (level: number): void => {
    if (!context) return
    drawFace(context, level)
    texture.needsUpdate = true
  }

  update(1)

  return {
    update,
    dispose: (): void => {
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      texture.dispose()
    }
  }
}
