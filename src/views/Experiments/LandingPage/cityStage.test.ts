import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { fitCityCamera, updateDistrictLift, getMotionValue } from './cityStage'
import { DISTRICT_LIFT } from './config'
import type { SkillsCityStage } from './types'

const createDistrict = (name: string): THREE.Object3D => {
  const district = new THREE.Object3D()
  district.name = name
  district.userData.restY = 0
  return district
}

const createStage = (districts: THREE.Object3D[]): SkillsCityStage => ({
  renderer: {} as THREE.WebGLRenderer,
  scene: new THREE.Scene(),
  camera: new THREE.OrthographicCamera(),
  outline: [],
  districts,
  movers: []
})

const settle = (stage: SkillsCityStage, hovered: string | null): number =>
  Array.from({ length: 200 }).reduce<number>(
    (frames, _, index) =>
      frames < index ? frames : updateDistrictLift(stage, hovered) ? index + 1 : frames,
    0
  )

describe('updateDistrictLift', () => {
  it('lifts only the hovered district and then stops moving', () => {
    // Arrange
    const [hovered, other] = [createDistrict('district-ci'), createDistrict('district-ux')]
    const stage = createStage([hovered, other])

    // Act
    settle(stage, 'district-ci')

    // Assert
    expect(hovered.position.y).toBe(DISTRICT_LIFT)
    expect(other.position.y).toBe(0)
    expect(updateDistrictLift(stage, 'district-ci')).toBe(false)
  })

  it('lowers a district back to rest once nothing is hovered', () => {
    // Arrange
    const district = createDistrict('district-ci')
    const stage = createStage([district])
    settle(stage, 'district-ci')

    // Act
    settle(stage, null)

    // Assert
    expect(district.position.y).toBe(0)
  })
})

describe('fitCityCamera', () => {
  it.each([[2], [0.5]])('frames every point at aspect %s without stretching', (aspect) => {
    // Arrange
    const camera = new THREE.OrthographicCamera()
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    const outline = [new THREE.Vector3(-4, -1, 0), new THREE.Vector3(4, 1, 0)]

    // Act
    fitCityCamera(camera, outline, aspect)

    // Assert
    expect((camera.right - camera.left) / (camera.top - camera.bottom)).toBeCloseTo(aspect)
    expect(camera.left).toBeLessThanOrEqual(-4)
    expect(camera.right).toBeGreaterThanOrEqual(4)
    expect(camera.bottom).toBeLessThanOrEqual(-1)
    expect(camera.top).toBeGreaterThanOrEqual(1)
  })
})

describe('getMotionValue', () => {
  const base = { speed: 1, amount: 2, phase: 0 }

  it.each([
    ['spin', 3, 3],
    ['slide', 0.25, 0.5],
    ['puff', 1.25, 0.25],
    ['grow', 0.5, 0.5],
    ['bob', Math.PI / 2, 2],
    ['swing', 0, 0],
    ['pulse', Math.PI / 2, 3]
  ] as const)('%s at %s seconds is %s', (kind, seconds, expected) => {
    expect(getMotionValue({ ...base, kind }, seconds)).toBeCloseTo(expected)
  })

  it('loops a slide back to its start', () => {
    expect(getMotionValue({ ...base, kind: 'slide' }, 1)).toBeCloseTo(0)
  })
})
