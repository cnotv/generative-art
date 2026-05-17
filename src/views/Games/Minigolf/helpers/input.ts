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
 * Uses camera matrix columns for reliable top-down projection, then points
 * the direction opposite to where the mouse moved (slingshot mechanic).
 * @param state AimState to mutate
 * @param x Current client X
 * @param y Current client Y
 * @param camera Active camera
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

  // Read camera right and up axes from world matrix (works for any camera angle,
  // including top-down where getWorldDirection().y≈0 makes the old approach fail).
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  right.y = 0
  up.y = 0

  // Combine screen-space delta with world axes.
  // dx uses (start – current) directly for slingshot.
  // dy is negated because screen-Y increases downward while world-Z increases toward screen bottom,
  // so without negation the vertical component gives direct control instead of slingshot.
  const dir = right.multiplyScalar(dx).addScaledVector(up, -dy)
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
