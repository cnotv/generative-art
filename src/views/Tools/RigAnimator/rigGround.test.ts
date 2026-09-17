import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createRigGround, fitShadowToModel, rigGroundPlacement } from './rigGround'
import { GROUND_RADIUS_MULTIPLIER, GROUND_SHADOW_SPAN_MULTIPLIER } from './config'

/** A standing box as tall as `height`, its base at `baseY`. */
const buildStandingModel = (height: number, baseY: number): THREE.Object3D => {
  const model = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(height / 4, height, height / 4))
  body.position.set(2, baseY + height / 2, -1)
  model.add(body)
  model.updateMatrixWorld(true)
  return model
}

describe('rigGroundPlacement', () => {
  it.each([
    ['a glTF-sized model', 1.8, 0],
    ['a Mixamo model in centimetres', 180, -3]
  ])('sits level with the soles of %s and centred under it', (_, height, baseY) => {
    // Arrange
    const model = buildStandingModel(height, baseY)

    // Act
    const placement = rigGroundPlacement(model)!

    // Assert
    expect(placement.center.y).toBeCloseTo(baseY)
    expect(placement.center.x).toBeCloseTo(2)
    expect(placement.center.z).toBeCloseTo(-1)
    expect(placement.radius).toBeGreaterThan(height / 2)
  })

  it('has nowhere to go for a model with no geometry', () => {
    expect(rigGroundPlacement(new THREE.Group())).toBeNull()
  })
})

describe('createRigGround', () => {
  it('lies flat at the placement, sized to the model, and takes shadows', () => {
    // Arrange
    const placement = { center: new THREE.Vector3(1, -2, 3), radius: 10 }

    // Act
    const ground = createRigGround(placement)
    ground.updateMatrixWorld(true)

    // Assert
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(ground.quaternion)
    expect(normal.y).toBeCloseTo(1)
    expect(ground.position.equals(placement.center)).toBe(true)
    expect((ground.geometry as THREE.CircleGeometry).parameters.radius).toBe(
      10 * GROUND_RADIUS_MULTIPLIER
    )
    expect(ground.receiveShadow).toBe(true)
  })
})

describe('fitShadowToModel', () => {
  it('keeps the light direction and sizes its shadow camera to the model', () => {
    // Arrange
    const model = buildStandingModel(180, 0)
    const placement = rigGroundPlacement(model)!
    const light = new THREE.DirectionalLight()
    light.position.set(4, 6, 4)
    const direction = light.position.clone().normalize()

    // Act
    fitShadowToModel(light, model, placement)

    // Assert
    const span = placement.radius * GROUND_SHADOW_SPAN_MULTIPLIER
    expect(
      light.position.clone().sub(light.target.position).normalize().angleTo(direction)
    ).toBeCloseTo(0)
    expect(light.target.position.equals(placement.center)).toBe(true)
    expect(light.shadow.camera.right).toBeCloseTo(span)
    expect(light.shadow.camera.far).toBeCloseTo(span * 2)
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) expect(child.castShadow).toBe(true)
    })
  })
})
