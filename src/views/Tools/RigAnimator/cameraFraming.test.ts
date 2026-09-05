import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { frameCameraOnModel } from './cameraFraming'

const buildTestModel = (): THREE.Object3D => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1))
  mesh.position.set(0, 1, 0)
  return mesh
}

describe('frameCameraOnModel', () => {
  it('frames the camera square-on by default, in front of the model along +z', () => {
    const camera = new THREE.PerspectiveCamera()
    const model = buildTestModel()
    frameCameraOnModel(camera, null, model)
    expect(camera.position.x).toBeCloseTo(0)
    expect(camera.position.z).toBeGreaterThan(0)
  })

  it('rotates the framing around the model by the given yaw', () => {
    const camera = new THREE.PerspectiveCamera()
    const model = buildTestModel()
    frameCameraOnModel(camera, null, model, Math.PI / 2)
    // A quarter turn swings the +z offset onto +x instead (THREE's right-hand rule around +y).
    expect(camera.position.x).toBeGreaterThan(0)
    expect(camera.position.z).toBeCloseTo(0)
  })

  it('keeps looking at the model from the rotated position', () => {
    const camera = new THREE.PerspectiveCamera()
    const model = buildTestModel()
    frameCameraOnModel(camera, null, model, Math.PI / 2)
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    // Looking from +x back toward the model's center at (0, 1, 0) means facing mostly -x.
    expect(forward.x).toBeLessThan(0)
  })
})
