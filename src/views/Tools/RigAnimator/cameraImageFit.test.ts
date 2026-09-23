import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { fitLandmarksToImage, solveCameraRootOffset } from './cameraImageFit'
import type { CameraImageSize, CameraLandmark } from './types'

const IMAGE_SIZE: CameraImageSize = { width: 640, height: 480 }
const FIELD_OF_VIEW_DEGREES = 54
const ROOT_OFFSET = new THREE.Vector3(0.3, -0.1, 2.5)

/** A rough standing body about its hip centre, in MediaPipe's world axes: y down, z away. */
const BODY: CameraLandmark[] = [
  [0, -0.6, 0],
  [-0.2, -0.5, 0.05],
  [0.2, -0.5, -0.05],
  [-0.25, -0.2, 0.1],
  [0.25, -0.2, -0.1],
  [-0.1, 0, 0],
  [0.1, 0, 0],
  [-0.1, 0.45, 0.08],
  [0.1, 0.45, -0.08],
  [-0.1, 0.85, 0],
  [0.1, 0.85, 0]
].map(([x, y, z]) => ({ x, y, z, visibility: 1 }))

/** Where a pinhole camera with the test's field of view draws a world landmark, normalized. */
const projectToImage = (world: CameraLandmark, offset = ROOT_OFFSET): CameraLandmark => {
  const focalPixels =
    IMAGE_SIZE.height / 2 / Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW_DEGREES) / 2)
  const depth = world.z + offset.z
  return {
    x: 0.5 + (focalPixels * (world.x + offset.x)) / depth / IMAGE_SIZE.width,
    y: 0.5 + (focalPixels * (world.y + offset.y)) / depth / IMAGE_SIZE.height,
    z: 0,
    visibility: world.visibility
  }
}

const IMAGE = BODY.map((landmark) => projectToImage(landmark))
const FULL_FIT = { share: 1, verticalFieldOfViewDegrees: FIELD_OF_VIEW_DEGREES }

describe('solveCameraRootOffset', () => {
  it('finds where the hip centre stands in front of the camera', () => {
    // Arrange, Act
    const offset = solveCameraRootOffset(BODY, IMAGE, IMAGE_SIZE, FIELD_OF_VIEW_DEGREES)

    // Assert
    expect(offset!.distanceTo(ROOT_OFFSET)).toBeLessThan(1e-6)
  })

  it('ignores a landmark the detector cannot see', () => {
    // Arrange
    const hiddenWrist = BODY.map((landmark, index) =>
      index === 3 ? { ...landmark, visibility: 0 } : landmark
    )
    const wrongWristImage = IMAGE.map((landmark, index) =>
      index === 3 ? { ...landmark, x: 0.95, y: 0.05 } : landmark
    )

    // Act
    const offset = solveCameraRootOffset(
      hiddenWrist,
      wrongWristImage,
      IMAGE_SIZE,
      FIELD_OF_VIEW_DEGREES
    )

    // Assert
    expect(offset!.distanceTo(ROOT_OFFSET)).toBeLessThan(1e-6)
  })

  it('gives up when a single landmark is all that can be seen', () => {
    // Arrange
    const onlyNose = BODY.map((landmark, index) =>
      index === 0 ? landmark : { ...landmark, visibility: 0 }
    )

    // Act
    const offset = solveCameraRootOffset(onlyNose, IMAGE, IMAGE_SIZE, FIELD_OF_VIEW_DEGREES)

    // Assert
    expect(offset).toBeNull()
  })
})

describe('fitLandmarksToImage', () => {
  it('leaves a world reading that already agrees with the image where it is', () => {
    // Arrange, Act
    const fitted = fitLandmarksToImage(BODY, IMAGE, IMAGE_SIZE, FULL_FIT)

    // Assert
    fitted.forEach((landmark, index) => {
      expect(landmark.x).toBeCloseTo(BODY[index].x, 6)
      expect(landmark.y).toBeCloseTo(BODY[index].y, 6)
    })
  })

  const trueElbow = { ...BODY[4], x: 0.35 }
  const imageWithTrueElbow = IMAGE.map((landmark, index) =>
    index === 4 ? projectToImage(trueElbow) : landmark
  )

  it('puts a misread elbow on the camera ray through its image reading, keeping its depth', () => {
    // Arrange
    const offset = solveCameraRootOffset(
      BODY,
      imageWithTrueElbow,
      IMAGE_SIZE,
      FIELD_OF_VIEW_DEGREES
    )!

    // Act
    const elbow = fitLandmarksToImage(BODY, imageWithTrueElbow, IMAGE_SIZE, FULL_FIT)[4]

    // Assert
    const drawn = projectToImage(elbow, offset)
    expect(drawn.x).toBeCloseTo(imageWithTrueElbow[4].x, 6)
    expect(drawn.y).toBeCloseTo(imageWithTrueElbow[4].y, 6)
    expect(elbow.z).toBe(BODY[4].z)
  })

  it.each([0, 0.25, 0.5, 0.75])('moves it %s of the way there', (share) => {
    // Arrange
    const onRay = fitLandmarksToImage(BODY, imageWithTrueElbow, IMAGE_SIZE, FULL_FIT)[4]

    // Act
    const elbow = fitLandmarksToImage(BODY, imageWithTrueElbow, IMAGE_SIZE, {
      ...FULL_FIT,
      share
    })[4]

    // Assert
    expect(elbow.x).toBeCloseTo(BODY[4].x + (onRay.x - BODY[4].x) * share, 9)
    expect(elbow.y).toBeCloseTo(BODY[4].y + (onRay.y - BODY[4].y) * share, 9)
  })
})
