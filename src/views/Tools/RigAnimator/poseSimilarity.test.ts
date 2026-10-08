import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  bestVerticalTurn,
  jointBendDegrees,
  meanJointError,
  meanSegmentAngleDegrees,
  normalizeSkeleton,
  pearsonCorrelation,
  percentCorrectKeypoints,
  turnAboutVertical
} from './poseSimilarity'

const point = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)

/** Shoulders, hips and one arm hanging to the side and forward: not symmetric about any axis. */
const BODY = [
  point(0.2, 1, 0),
  point(-0.2, 1, 0),
  point(0.1, 0, 0),
  point(-0.1, 0, 0),
  point(0.5, 0.6, 0.3)
]
const TORSO = { leftShoulder: 0, rightShoulder: 1, leftHip: 2, rightHip: 3 }

describe('normalizeSkeleton', () => {
  it.each([
    { label: 'moved', transform: (joint: THREE.Vector3) => joint.clone().add(point(3, -2, 5)) },
    { label: 'scaled', transform: (joint: THREE.Vector3) => joint.clone().multiplyScalar(40) }
  ])('reads a body $label elsewhere as the same pose', ({ transform }) => {
    // Arrange
    const other = BODY.map(transform)

    // Act
    const normalized = normalizeSkeleton(other, TORSO)

    // Assert
    normalizeSkeleton(BODY, TORSO).forEach((joint, index) => {
      expect(joint.distanceTo(normalized[index])).toBeLessThan(1e-9)
    })
  })

  it('puts the hip centre at the origin and the shoulder centre one unit above it', () => {
    // Arrange, Act
    const [leftShoulder, rightShoulder, leftHip, rightHip] = normalizeSkeleton(BODY, TORSO)

    // Assert
    expect(leftHip.clone().add(rightHip).length()).toBeLessThan(1e-9)
    expect(leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5).length()).toBeCloseTo(1)
  })
})

describe('bestVerticalTurn', () => {
  it.each([-2.5, -0.9, 0, 0.4, 1.7])('undoes a turn of %f radians exactly', (radians) => {
    // Arrange
    const reference = [BODY]
    const turned = turnAboutVertical(reference, radians)

    // Act
    const aligned = turnAboutVertical(turned, bestVerticalTurn(reference, turned))

    // Assert
    expect(meanJointError(reference, aligned)).toBeLessThan(1e-9)
  })
})

describe('percentCorrectKeypoints', () => {
  it.each([
    { threshold: 0.05, expected: 0.2 },
    { threshold: 0.15, expected: 0.6 },
    { threshold: 1, expected: 1 }
  ])('counts $expected of the joints within $threshold', ({ threshold, expected }) => {
    // Arrange
    const offsets = [0, 0.1, 0.1, 0.3, 0.3]
    const candidate = BODY.map((joint, index) => joint.clone().add(point(offsets[index], 0, 0)))

    // Act
    const share = percentCorrectKeypoints([BODY], [candidate], threshold)

    // Assert
    expect(share).toBeCloseTo(expected)
  })
})

describe('meanSegmentAngleDegrees', () => {
  it('ignores how long a segment is and reads only which way it points', () => {
    // Arrange
    const longer = [point(0, 0, 0), point(0, -3, 0)]
    const bent = [point(0, 0, 0), point(1, -1, 0)]

    // Act
    const sameWay = meanSegmentAngleDegrees([[point(0, 0, 0), point(0, -1, 0)]], [longer], [[0, 1]])
    const turned = meanSegmentAngleDegrees([[point(0, 0, 0), point(0, -1, 0)]], [bent], [[0, 1]])

    // Assert
    expect(sameWay).toBeCloseTo(0)
    expect(turned).toBeCloseTo(45)
  })
})

describe('jointBendDegrees', () => {
  it.each([
    { label: 'straight', below: point(0, -2, 0), expected: 0 },
    { label: 'right angle', below: point(1, -1, 0), expected: 90 },
    { label: 'folded back', below: point(0, 0, 0), expected: 180 }
  ])('reads a $label limb as $expected°', ({ below, expected }) => {
    // Arrange
    const joints = [point(0, 0, 0), point(0, -1, 0), below]

    // Act
    const bend = jointBendDegrees(joints, [0, 1, 2])

    // Assert
    expect(bend).toBeCloseTo(expected)
  })
})

describe('pearsonCorrelation', () => {
  it.each([
    { label: 'moves in step at another scale', b: [10, 30, 50, 30], expected: 1 },
    { label: 'moves against', b: [3, 1, -1, 1], expected: -1 },
    { label: 'never changes', b: [7, 7, 7, 7], expected: 0 }
  ])('reads a series that $label as $expected', ({ b, expected }) => {
    // Arrange
    const a = [0, 1, 2, 1]

    // Act
    const correlation = pearsonCorrelation(a, b)

    // Assert
    expect(correlation).toBeCloseTo(expected)
  })
})
