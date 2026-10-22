import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { readLightsFromScene } from './sceneLights'

describe('readLightsFromScene', () => {
  it('reads a spot light whole, beam included, so the Lights panel shows its real values', () => {
    // Arrange
    const scene = new THREE.Scene()
    const spot = new THREE.SpotLight(0xc9d8ff, 380, 0, 0.36, 1)
    spot.name = 'spot-light'
    spot.position.set(5, 10, 7)
    spot.target.position.set(0, -2, 1)
    scene.add(spot)

    // Act
    const { lights } = readLightsFromScene(scene)

    // Assert
    expect(lights.spot).toEqual({
      color: 0xc9d8ff,
      intensity: 380,
      angle: 0.36,
      penumbra: 1,
      position: { x: 5, y: 10, z: 7 },
      target: { x: 0, y: -2, z: 1 }
    })
  })
})
