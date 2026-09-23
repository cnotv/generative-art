import * as THREE from 'three'
import type { CameraImageFitSettings, CameraImageSize, CameraLandmark } from './types'

/** The lens sits over the image's centre, in normalized image coordinates. */
const IMAGE_CENTRE = 0.5
/** Below this the landmarks in view cannot pin down all three axes of the offset. */
const SINGULAR_DETERMINANT = 1e-9

/**
 * Where a normalized image point sits on the pinhole camera's image plane at depth 1: its x and y
 * per unit of distance from the lens, in the same axes as MediaPipe's world landmarks (x toward
 * the image's right, y down, z away from the camera).
 */
const imagePlanePoint = (
  landmark: CameraLandmark,
  imageSize: CameraImageSize,
  verticalFieldOfViewDegrees: number
): THREE.Vector2 => {
  const focalPixels =
    imageSize.height / 2 / Math.tan(THREE.MathUtils.degToRad(verticalFieldOfViewDegrees) / 2)
  return new THREE.Vector2(
    ((landmark.x - IMAGE_CENTRE) * imageSize.width) / focalPixels,
    ((landmark.y - IMAGE_CENTRE) * imageSize.height) / focalPixels
  )
}

/**
 * Where the body's hip centre sits in front of the camera, in metres, found the way VNect places
 * its skeleton (Mehta et al., SIGGRAPH 2017): the offset that, added to every hip-centred world
 * landmark, projects it through a pinhole camera onto the same landmark in the image. Each
 * landmark gives two equations linear in the offset, so the whole body is one weighted least
 * squares solve of three unknowns, weighted by how visible each landmark is.
 * @param worldLandmarks BlazePose's world landmarks, in metres about the hip centre
 * @param imageLandmarks The same landmarks, normalized to the image
 * @param imageSize The image's size in pixels, for its aspect ratio
 * @param verticalFieldOfViewDegrees The camera's vertical field of view
 * @returns The hip centre in camera space, or null when too little is visible to place it
 */
export const solveCameraRootOffset = (
  worldLandmarks: CameraLandmark[],
  imageLandmarks: CameraLandmark[],
  imageSize: CameraImageSize,
  verticalFieldOfViewDegrees: number
): THREE.Vector3 | null => {
  const rows = worldLandmarks.flatMap((world, index) => {
    const image = imageLandmarks[index]
    const weight = Math.min(world.visibility, image?.visibility ?? 0)
    if (!image || weight <= 0) return []
    const plane = imagePlanePoint(image, imageSize, verticalFieldOfViewDegrees)
    // x + offset.x = plane.x * (z + offset.z), rearranged into row · offset = target.
    return [
      { row: new THREE.Vector3(1, 0, -plane.x), target: plane.x * world.z - world.x, weight },
      { row: new THREE.Vector3(0, 1, -plane.y), target: plane.y * world.z - world.y, weight }
    ]
  })
  const normal = new THREE.Matrix3().fromArray(
    rows.reduce(
      (sum, { row, weight }) =>
        sum.map(
          (value, cell) =>
            value + weight * row.getComponent(cell % 3) * row.getComponent(Math.floor(cell / 3))
        ),
      Array.from({ length: 9 }, () => 0)
    )
  )
  const right = rows.reduce(
    (sum, { row, target, weight }) => sum.addScaledVector(row, weight * target),
    new THREE.Vector3()
  )
  if (Math.abs(normal.determinant()) < SINGULAR_DETERMINANT) return null
  return right.applyMatrix3(normal.clone().invert())
}

/**
 * Pull each world landmark toward the camera ray through its image landmark, keeping its depth.
 * The image reading places a joint on screen far more precisely than the world reading does, while
 * only the world reading knows how far away it is. VNect fits one skeleton to both for that
 * reason, and fitting to the image alone halved its accuracy. Here the fit is done on the
 * landmarks themselves, before retargeting, since the retarget only reads directions between them.
 * @param worldLandmarks BlazePose's world landmarks, in metres about the hip centre
 * @param imageLandmarks The same landmarks, normalized to the image
 * @param imageSize The image's size in pixels
 * @param settings How far to pull, and the camera's field of view
 * @returns The world landmarks, each moved `settings.share` of the way onto its image ray
 */
export const fitLandmarksToImage = (
  worldLandmarks: CameraLandmark[],
  imageLandmarks: CameraLandmark[],
  imageSize: CameraImageSize,
  settings: CameraImageFitSettings
): CameraLandmark[] => {
  const offset = solveCameraRootOffset(
    worldLandmarks,
    imageLandmarks,
    imageSize,
    settings.verticalFieldOfViewDegrees
  )
  if (!offset || settings.share <= 0) return worldLandmarks
  return worldLandmarks.map((world, index) => {
    const image = imageLandmarks[index]
    if (!image) return world
    const depth = world.z + offset.z
    const plane = imagePlanePoint(image, imageSize, settings.verticalFieldOfViewDegrees)
    return {
      ...world,
      x: world.x + (plane.x * depth - offset.x - world.x) * settings.share,
      y: world.y + (plane.y * depth - offset.y - world.y) * settings.share
    }
  })
}
