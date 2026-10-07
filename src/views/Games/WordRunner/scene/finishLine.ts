import * as THREE from 'three'
import { FINISH_LINE, LANE_COUNT, LANE_WIDTH } from '../config'
import type { TrackSample } from '../types'

const drawChequers = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = FINISH_LINE.columns * FINISH_LINE.squarePixels
  canvas.height = FINISH_LINE.rows * FINISH_LINE.squarePixels
  const context = canvas.getContext('2d')
  if (!context) return canvas
  Array.from({ length: FINISH_LINE.columns * FINISH_LINE.rows }, (_, square) => square).forEach(
    (square) => {
      const column = square % FINISH_LINE.columns
      const row = Math.floor(square / FINISH_LINE.columns)
      context.fillStyle = FINISH_LINE.colors[(column + row) % 2]
      context.fillRect(
        column * FINISH_LINE.squarePixels,
        row * FINISH_LINE.squarePixels,
        FINISH_LINE.squarePixels,
        FINISH_LINE.squarePixels
      )
    }
  )
  return canvas
}

/** A chequered stripe across the deck where the race ends, the first ball over it the winner. */
export const createFinishLine = (
  scene: THREE.Scene
): { finishLine: THREE.Mesh; dispose: () => void } => {
  const texture = new THREE.CanvasTexture(drawChequers())
  texture.colorSpace = THREE.SRGBColorSpace
  const geometry = new THREE.PlaneGeometry(
    LANE_COUNT * LANE_WIDTH + FINISH_LINE.margin,
    FINISH_LINE.depth
  ).rotateX(-Math.PI / 2)
  const material = new THREE.MeshLambertMaterial({ map: texture })
  const finishLine = new THREE.Mesh(geometry, material)
  finishLine.name = 'finish-line'
  finishLine.receiveShadow = true
  finishLine.visible = false
  scene.add(finishLine)
  const dispose = (): void => {
    scene.remove(finishLine)
    geometry.dispose()
    material.dispose()
    texture.dispose()
  }
  return { finishLine, dispose }
}

/** Lays the finish line across the track at a point along it. */
export const placeFinishLine = (finishLine: THREE.Object3D, sample: TrackSample): void => {
  finishLine.position.copy(sample.position)
  finishLine.position.y += FINISH_LINE.lift
  finishLine.rotation.y = sample.yaw
  finishLine.visible = true
}
