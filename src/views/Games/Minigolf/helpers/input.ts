import * as THREE from 'three'
import { MAX_SHOT_POWER, POWER_SCALE } from '../config'

export interface AimState {
  dragging: boolean
  startX: number
  startY: number
  power: number
  direction: THREE.Vector3
}

/**
 * Create a fresh aim state (no drag in progress).
 * @returns Initial AimState
 */
export const createAimState = (): AimState => ({
  dragging: false,
  startX: 0,
  startY: 0,
  power: 0,
  direction: new THREE.Vector3()
})

/**
 * Begin a drag from a pointer-down event.
 * @param state AimState to mutate
 * @param x Client X
 * @param y Client Y
 */
export const beginDrag = (state: AimState, x: number, y: number): void => {
  state.dragging = true
  state.startX = x
  state.startY = y
  state.power = 0
}

/**
 * Update aim direction and power while dragging.
 * @param state AimState to mutate
 * @param x Current client X
 * @param y Current client Y
 * @param camera Active camera (used to project drag into world space)
 * @param ballPosition Current ball world position
 */
export const updateDrag = (
  state: AimState,
  x: number,
  y: number,
  camera: THREE.Camera,
  ballPosition: THREE.Vector3
): void => {
  if (!state.dragging) return
  const dx = state.startX - x
  const dy = state.startY - y
  const dragLength = Math.hypot(dx, dy)
  state.power = Math.min(dragLength * POWER_SCALE, MAX_SHOT_POWER) / MAX_SHOT_POWER

  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  cameraDirection.y = 0
  cameraDirection.normalize()

  const right = new THREE.Vector3()
  right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize()

  const worldDx = right.clone().multiplyScalar(dx)
  const worldDz = cameraDirection.clone().multiplyScalar(dy)
  const dir = worldDx.add(worldDz)
  dir.y = 0

  if (dir.lengthSq() > 0) {
    state.direction.copy(dir.normalize())
  }

  void ballPosition
}

/**
 * End the drag and return whether a shot should fire.
 * @param state AimState to mutate
 * @returns True if power > 0 and a shot should be applied
 */
export const endDrag = (state: AimState): boolean => {
  if (!state.dragging) return false
  state.dragging = false
  return state.power > 0
}
