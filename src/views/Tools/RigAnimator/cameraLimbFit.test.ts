import { describe, it, expect } from 'vitest'
import { limbFitScale } from './cameraLimbFit'
import { CAMERA_LIMB_FIT_MAX_SCALE, CAMERA_LIMB_FIT_MIN_SCALE } from './config'

describe('limbFitScale', () => {
  it('shortens a rig limb longer than the performer’s, at the same body scale', () => {
    // Arrange: the performer's arm measures 0.5 of their own body, the rig's 1 of its own.
    const limbs = [{ observed: 0.5, rest: 100 }]

    // Act
    const scale = limbFitScale(limbs, 100)

    // Assert
    expect(scale).toBeCloseTo(0.5)
  })

  it('leaves a limb that already matches at its own length', () => {
    // Arrange, Act
    const scale = limbFitScale([{ observed: 0.5, rest: 50 }], 100)

    // Assert
    expect(scale).toBeCloseTo(1)
  })

  it('gives both sides one scale, so a lopsided reading cannot leave one limb longer', () => {
    // Arrange: the same arm read 20% longer on one side than the other.
    const lopsided = [
      { observed: 0.55, rest: 100 },
      { observed: 0.45, rest: 100 }
    ]

    // Act
    const scale = limbFitScale(lopsided, 100)

    // Assert
    expect(scale).toBeCloseTo(limbFitScale([{ observed: 0.5, rest: 100 }], 100) ?? 0)
  })

  it.each([
    ['a limb read far too short', 0.01, CAMERA_LIMB_FIT_MIN_SCALE],
    ['a limb read far too long', 10, CAMERA_LIMB_FIT_MAX_SCALE]
  ])('clamps %s', (_, observed, expected) => {
    // Arrange, Act
    const scale = limbFitScale([{ observed, rest: 100 }], 100)

    // Assert
    expect(scale).toBe(expected)
  })

  it.each([
    ['nothing measurable in view', []],
    ['a limb of no measured length', [{ observed: 0, rest: 100 }]],
    ['a rig limb of no length', [{ observed: 0.5, rest: 0 }]]
  ])('reads %s as no fit at all', (_, limbs) => {
    // Arrange, Act, Assert
    expect(limbFitScale(limbs, 100)).toBeNull()
  })
})
