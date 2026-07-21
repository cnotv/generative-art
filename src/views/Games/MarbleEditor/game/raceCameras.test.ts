import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { ComplexModel } from '@webgamekit/animation'
import {
  easeTransition,
  updateFirstPersonCamera,
  updateFreeCamera,
  applyRaceCamera,
  type RaceCameraOptions
} from './raceCameras'
import { FIRST_PERSON_HEIGHT } from '../config'

const stubOrbit = (): OrbitControls =>
  ({ enabled: true, target: new THREE.Vector3() }) as unknown as OrbitControls

const marbleAt = (x: number, y: number, z: number): ComplexModel => {
  const object = new THREE.Object3D()
  object.position.set(x, y, z)
  return object as unknown as ComplexModel
}

describe('easeTransition', () => {
  it('maps the endpoints to themselves and eases the middle', () => {
    expect(easeTransition(0)).toBeCloseTo(0)
    expect(easeTransition(1)).toBeCloseTo(1)
    expect(easeTransition(0.5)).toBeCloseTo(0.875)
  })

  it('clamps out-of-range input', () => {
    expect(easeTransition(-1)).toBeCloseTo(0)
    expect(easeTransition(2)).toBeCloseTo(1)
  })

  it('increases monotonically', () => {
    expect(easeTransition(0.25)).toBeLessThan(easeTransition(0.75))
  })
})

const frame = (over: Partial<RaceCameraOptions>): RaceCameraOptions => ({
  mode: 'first',
  camera: new THREE.PerspectiveCamera(),
  marble: marbleAt(0, 0, 0),
  orbit: null,
  smoothedDirection: new THREE.Vector3(0, 0, -1),
  transitionStart: new THREE.Vector3(),
  transitionAlpha: 1,
  ...over
})

describe('updateFirstPersonCamera', () => {
  const start = new THREE.Vector3(10, 10, 10)

  it('sits at the start position at alpha 0', () => {
    const options = frame({ transitionStart: start, transitionAlpha: 0 })
    updateFirstPersonCamera(options)
    expect(options.camera.position.x).toBeCloseTo(10)
    expect(options.camera.position.y).toBeCloseTo(10)
    expect(options.camera.position.z).toBeCloseTo(10)
  })

  it('lands exactly on the marble head at alpha 1', () => {
    const options = frame({ marble: marbleAt(2, 3, 4), transitionStart: start, transitionAlpha: 1 })
    updateFirstPersonCamera(options)
    expect(options.camera.position.x).toBeCloseTo(2)
    expect(options.camera.position.y).toBeCloseTo(3 + FIRST_PERSON_HEIGHT)
    expect(options.camera.position.z).toBeCloseTo(4)
  })

  it('is strictly between start and goal mid-transition', () => {
    const options = frame({ transitionStart: start, transitionAlpha: 0.5 })
    updateFirstPersonCamera(options)
    expect(options.camera.position.x).toBeGreaterThan(0)
    expect(options.camera.position.x).toBeLessThan(10)
  })
})

describe('updateFreeCamera', () => {
  it('hands control to orbit and leaves the camera alone once the transition ends', () => {
    const orbit = stubOrbit()
    orbit.enabled = false
    const options = frame({
      mode: 'free',
      marble: marbleAt(1, 2, 3),
      orbit,
      transitionAlpha: 1
    })
    options.camera.position.set(5, 5, 5)

    updateFreeCamera(options)

    expect(orbit.enabled).toBe(true)
    expect(orbit.target.x).toBeCloseTo(1)
    expect(orbit.target.y).toBeCloseTo(2)
    expect(orbit.target.z).toBeCloseTo(3)
    expect(options.camera.position.x).toBeCloseTo(5)
    expect(options.camera.position.y).toBeCloseTo(5)
    expect(options.camera.position.z).toBeCloseTo(5)
  })

  it('disables orbit and glides the camera up and back mid-transition', () => {
    const orbit = stubOrbit()
    const options = frame({ mode: 'free', orbit, transitionAlpha: 0.5 })
    options.camera.position.set(0, 0, 0)

    updateFreeCamera(options)

    expect(orbit.enabled).toBe(false)
    expect(options.camera.position.length()).toBeGreaterThan(0)
    expect(options.camera.position.y).toBeGreaterThan(0)
  })
})

describe('applyRaceCamera', () => {
  it('disables orbit and targets the marble in third-person', () => {
    const camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 20, 20)
    const orbit = stubOrbit()

    applyRaceCamera({
      mode: 'third',
      camera,
      marble: marbleAt(0, 0, 0),
      orbit,
      smoothedDirection: new THREE.Vector3(0, 0, -1),
      transitionStart: new THREE.Vector3(),
      transitionAlpha: 1
    })

    expect(orbit.enabled).toBe(false)
    expect(orbit.target.x).toBeCloseTo(0)
    expect(orbit.target.y).toBeCloseTo(0)
    expect(orbit.target.z).toBeCloseTo(0)
  })
})
