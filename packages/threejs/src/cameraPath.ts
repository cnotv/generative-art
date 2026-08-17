import * as THREE from 'three'
import type { CameraPath, CameraPathOptions, CameraPathPoint } from './types'

const MINIMUM_POINTS = 2

/**
 * Only one path may own the camera at a time, and a follow camera needs to know when that is
 * happening so it can stand down rather than fight for the same transform.
 */
const owner: { current?: CameraPath } = {}

/**
 * Whether a camera path currently owns the camera.
 * @returns True while a path is running
 */
export const cameraPathIsActive = (): boolean => owner.current !== undefined

const curveThrough = (points: readonly CameraPathPoint[]): THREE.CatmullRomCurve3 =>
  new THREE.CatmullRomCurve3(points.map(({ position }) => new THREE.Vector3(...position)))

const lookAtCurve = (points: readonly CameraPathPoint[]): THREE.CatmullRomCurve3 | undefined => {
  const targets = points.map(({ lookAt }) => lookAt)
  if (targets.some((target) => target === undefined)) return undefined
  return new THREE.CatmullRomCurve3(targets.map((target) => new THREE.Vector3(...target!)))
}

/**
 * Move a camera along a declared path over a fixed duration, for intros, replays and
 * cutscenes. The path owns the camera until it finishes or is cancelled.
 *
 * Sampling is arc-length parameterised, so the camera holds a steady speed instead of
 * accelerating through tightly spaced points.
 * @param camera The camera to drive
 * @param options The points to travel, how long to take, and optional easing
 * @returns A handle whose update is called each frame with the seconds elapsed
 */
export const cameraPathCreate = (camera: THREE.Camera, options: CameraPathOptions): CameraPath => {
  const { points, seconds, easing = (t: number) => t, onComplete } = options

  if (points.length < MINIMUM_POINTS) {
    throw new Error(`A camera path needs at least two points, received ${points.length}`)
  }
  if (seconds <= 0) {
    throw new Error(`A camera path needs a positive seconds, received ${seconds}`)
  }

  const positions = curveThrough(points)
  const targets = lookAtCurve(points)

  // Pre-allocated because update runs every frame; see the animation-loop rules.
  const position = new THREE.Vector3()
  const target = new THREE.Vector3()

  const state = { elapsed: 0, finished: false }

  const path: CameraPath = {
    update: (deltaSeconds: number): boolean => {
      if (state.finished || owner.current !== path) return false

      state.elapsed = Math.min(state.elapsed + deltaSeconds, seconds)
      const progress = Math.min(Math.max(easing(state.elapsed / seconds), 0), 1)

      positions.getPointAt(progress, position)
      camera.position.copy(position)

      if (targets) {
        targets.getPointAt(progress, target)
        camera.lookAt(target)
      }

      if (state.elapsed < seconds) return true

      state.finished = true
      owner.current = undefined
      onComplete?.()
      return true
    },
    cancel: (): void => {
      state.finished = true
      if (owner.current === path) owner.current = undefined
    }
  }

  owner.current = path
  return path
}
