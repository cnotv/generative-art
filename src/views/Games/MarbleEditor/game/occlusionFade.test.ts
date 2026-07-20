import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import type { ComplexModel } from '@webgamekit/animation'
import { createOcclusionFader } from './occlusionFade'
import { OCCLUSION_OPACITY } from '../config'

const asModel = (mesh: THREE.Mesh): ComplexModel => mesh as unknown as ComplexModel

const makeWall = (z: number): THREE.Mesh => {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 1),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
  )
  wall.position.set(0, 0, z)
  wall.updateMatrixWorld(true)
  return wall
}

describe('createOcclusionFader', () => {
  let camera: THREE.PerspectiveCamera
  let marble: THREE.Mesh
  let fader: ReturnType<typeof createOcclusionFader>

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera()
    camera.position.set(0, 0, 20)
    camera.updateMatrixWorld(true)
    marble = new THREE.Mesh(new THREE.SphereGeometry(0.8), new THREE.MeshStandardMaterial())
    marble.position.set(0, 0, -20)
    marble.updateMatrixWorld(true)
    fader = createOcclusionFader()
  })

  it('fades a piece that sits between the camera and the marble', () => {
    const wall = makeWall(0)
    const material = wall.material as THREE.MeshStandardMaterial
    fader.update(camera, asModel(marble), [asModel(wall)])
    expect(material.opacity).toBe(OCCLUSION_OPACITY)
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
  })

  it('leaves a piece that is not between the camera and the marble untouched', () => {
    const wall = makeWall(0)
    wall.position.set(50, 0, 0)
    wall.updateMatrixWorld(true)
    const material = wall.material as THREE.MeshStandardMaterial
    fader.update(camera, asModel(marble), [asModel(wall)])
    expect(material.opacity).toBe(1)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
  })

  it('restores a piece once it no longer occludes the marble', () => {
    const wall = makeWall(0)
    const material = wall.material as THREE.MeshStandardMaterial
    fader.update(camera, asModel(marble), [asModel(wall)])
    expect(material.opacity).toBe(OCCLUSION_OPACITY)

    wall.position.set(50, 0, 0)
    wall.updateMatrixWorld(true)
    fader.update(camera, asModel(marble), [asModel(wall)])
    expect(material.opacity).toBe(1)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
  })

  it('restores every faded piece on dispose', () => {
    const wall = makeWall(0)
    const material = wall.material as THREE.MeshStandardMaterial
    fader.update(camera, asModel(marble), [asModel(wall)])
    expect(material.opacity).toBe(OCCLUSION_OPACITY)
    fader.dispose()
    expect(material.opacity).toBe(1)
    expect(material.transparent).toBe(false)
  })

  it('does not touch pieces beyond the marble', () => {
    const behindMarble = makeWall(-30)
    const material = behindMarble.material as THREE.MeshStandardMaterial
    fader.update(camera, asModel(marble), [asModel(behindMarble)])
    expect(material.opacity).toBe(1)
  })
})
