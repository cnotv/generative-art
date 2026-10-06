import * as THREE from 'three'
import {
  LANE_COUNT,
  LANE_WIDTH,
  TRACK_CENTER_Z,
  TRACK_COLOR,
  TRACK_DASH_PERIOD,
  TRACK_EDGE_COLOR,
  TRACK_LENGTH,
  TRACK_LINE_COLOR,
  TRACK_WIDTH
} from '../config'
import { laneOffset } from '../runner/runMotion'

const TEXTURE_WIDTH = 256
const TEXTURE_HEIGHT = 128
const LINE_WIDTH_PIXELS = 5
const EDGE_WIDTH_PIXELS = 9
// Lifts the track off the grass so the two never share a depth and flicker.
const TRACK_LIFT = 0.02
// Dividers sit on the lane boundaries, half a lane past each lane's centre.
const HALF_LANE = 0.5

const toTextureX = (worldX: number): number =>
  ((worldX + TRACK_WIDTH / 2) / TRACK_WIDTH) * TEXTURE_WIDTH

/** One repeat of the track surface: the lane colour, its two edges and a dash on each divider. */
const drawTrackTile = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.fillStyle = TRACK_COLOR
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  context.fillStyle = TRACK_EDGE_COLOR
  context.fillRect(0, 0, EDGE_WIDTH_PIXELS, TEXTURE_HEIGHT)
  context.fillRect(TEXTURE_WIDTH - EDGE_WIDTH_PIXELS, 0, EDGE_WIDTH_PIXELS, TEXTURE_HEIGHT)
  context.fillStyle = TRACK_LINE_COLOR
  Array.from({ length: LANE_COUNT - 1 }, (_, divider) =>
    toTextureX(laneOffset(divider + HALF_LANE, LANE_COUNT, LANE_WIDTH))
  ).forEach((x) =>
    context.fillRect(x - LINE_WIDTH_PIXELS / 2, 0, LINE_WIDTH_PIXELS, TEXTURE_HEIGHT / 2)
  )
  return canvas
}

/**
 * The three-lane strip the runner stays on. It never moves: running is the texture sliding
 * towards the camera, so the track is one mesh however long the run goes on.
 */
export const createTrack = (
  scene: THREE.Scene
): { scroll: (distance: number) => void; dispose: () => void } => {
  const texture = new THREE.CanvasTexture(drawTrackTile())
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, TRACK_LENGTH / TRACK_DASH_PERIOD)
  texture.anisotropy = 8
  const geometry = new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH)
  const material = new THREE.MeshLambertMaterial({ map: texture })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'track'
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(0, TRACK_LIFT, TRACK_CENTER_Z)
  mesh.receiveShadow = true
  scene.add(mesh)

  const scroll = (distance: number): void => {
    texture.offset.y = (distance / TRACK_DASH_PERIOD) % 1
  }
  const dispose = (): void => {
    scene.remove(mesh)
    geometry.dispose()
    material.dispose()
    texture.dispose()
  }
  return { scroll, dispose }
}
