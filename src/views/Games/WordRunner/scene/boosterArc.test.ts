import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { BALL, BOOSTER_ARC } from '../config'
import { arcDrawCount, createBoosterArc } from './boosterArc'

const SEGMENTS = 32

const frameFor = (charge: number, opacity = 0.5, visible = true) => ({
  ball: new THREE.Object3D(),
  camera: new THREE.PerspectiveCamera(),
  charge,
  opacity,
  visible
})

const partsOf = (scene: THREE.Scene) => {
  const group = scene.getObjectByName('booster-arc')
  const fill = scene.getObjectByName('booster-arc-fill')
  const track = scene.getObjectByName('booster-arc-track')
  if (!(fill instanceof THREE.Mesh) || !(track instanceof THREE.Mesh) || !group) {
    throw new Error('The booster arc is missing a part')
  }
  return { group, fill, track }
}

describe('arcDrawCount', () => {
  it.each([
    [0, 0],
    [0.5, (SEGMENTS / 2) * 6],
    [1, SEGMENTS * 6],
    [-1, 0],
    [3, SEGMENTS * 6]
  ])('draws the first %f of the arc as %i indices', (charge, expected) => {
    // Act
    const count = arcDrawCount(charge, SEGMENTS)

    // Assert
    expect(count).toBe(expected)
  })
})

describe('createBoosterArc', () => {
  it.each([
    [0.3, BOOSTER_ARC.chargingColor],
    [1, BOOSTER_ARC.readyColor]
  ])('at charge %f fills in colour %i', (charge, color) => {
    // Arrange
    const scene = new THREE.Scene()
    const arc = createBoosterArc(scene, 0.2)

    // Act
    arc.draw(frameFor(charge))

    // Assert
    expect(partsOf(scene).fill.material.color.getHex()).toBe(color)
  })

  it('follows the ball, with the track fainter than the fill', () => {
    // Arrange
    const scene = new THREE.Scene()
    const arc = createBoosterArc(scene, 0.2)
    const frame = frameFor(0.5, 0.6)
    frame.ball.position.set(3, 1, -7)

    // Act
    arc.draw(frame)

    // Assert
    const { group, fill, track } = partsOf(scene)
    expect(group.position.toArray()).toEqual([3, 1, -7])
    expect(fill.material.opacity).toBeCloseTo(0.6)
    expect(track.material.opacity).toBeCloseTo(0.6 * BOOSTER_ARC.trackOpacityShare)
  })

  it.each([
    [false, 0.5],
    [true, 0]
  ])('is hidden when visible is %s at opacity %f', (visible, opacity) => {
    // Arrange
    const scene = new THREE.Scene()
    const arc = createBoosterArc(scene, 0.2)

    // Act
    arc.draw(frameFor(1, opacity, visible))

    // Assert
    expect(partsOf(scene).group.visible).toBe(false)
  })

  it('moves further from the ball when its gap grows', () => {
    // Arrange
    const scene = new THREE.Scene()
    const arc = createBoosterArc(scene, 0.2)

    // Act
    arc.setGap(1)

    // Assert
    const { fill } = partsOf(scene)
    expect(fill.geometry).toBeInstanceOf(THREE.RingGeometry)
    if (fill.geometry instanceof THREE.RingGeometry) {
      expect(fill.geometry.parameters.innerRadius).toBeCloseTo(1 + BALL.radius)
    }
  })

  it('leaves the scene when disposed', () => {
    // Arrange
    const scene = new THREE.Scene()
    const arc = createBoosterArc(scene, 0.2)

    // Act
    arc.dispose()

    // Assert
    expect(scene.getObjectByName('booster-arc')).toBeUndefined()
  })
})
