import { describe, it, expect } from 'vitest'
import { mirrorCameraHandLandmarks, resolveCameraHandSide } from './cameraHandPoseMapping'
import type { CameraHandLandmark } from './types'

const point = (x: number, y: number, z: number): CameraHandLandmark => ({ x, y, z })

describe('resolveCameraHandSide', () => {
  it.each([
    ['Left', 'Left'],
    ['Right', 'Right']
  ])(
    "passes MediaPipe's %s label straight through as the subject's %s side",
    (categoryName, expectedSide) => {
      expect(resolveCameraHandSide(categoryName)).toBe(expectedSide)
    }
  )

  it('returns null for an unrecognised label', () => {
    expect(resolveCameraHandSide('unknown')).toBeNull()
  })
})

describe('mirrorCameraHandLandmarks', () => {
  it('files each hand under the opposite side with every x negated', () => {
    // Arrange
    const left = [point(0.1, 0.2, 0.3)]
    const right = [point(-0.4, 0.5, 0.6)]

    // Act
    const mirrored = mirrorCameraHandLandmarks({ Left: left, Right: right })

    // Assert
    expect(mirrored.Right).toEqual([point(-0.1, 0.2, 0.3)])
    expect(mirrored.Left).toEqual([point(0.4, 0.5, 0.6)])
  })

  it.each([
    ['one hand', { Left: [point(0, 0, 0)] }, ['Right']],
    ['no hand', {}, []]
  ])('keys only the mirrored side(s) for %s', (_, hands, expectedSides) => {
    expect(Object.keys(mirrorCameraHandLandmarks(hands))).toEqual(expectedSides)
  })
})
