import * as THREE from 'three'

const FRONT_FACE_THRESHOLD = 0.7
const BACK_FACE_THRESHOLD = -0.7
const PANEL_SCALE = 0.5

/**
 * How the model's two faces share the texture.
 *
 * `wrapped` folds one image around the rig like paper: both faces read the
 * same picture the right way round, at the cost of being unable to tell them
 * apart — a mark painted on one shows through on the other.
 *
 * `split` gives each face its own half of the texture, so front and back can
 * carry different artwork. A texture authored for one layout is meaningless
 * in the other, so every consumer of a given model has to agree on which.
 */
export type UvProjectionLayout = 'wrapped' | 'split'

/**
 * Rewrites a model's UVs to a single world-space planar projection shared
 * across every mesh part, so one flat texture reads as one picture wrapped
 * around the model instead of being squeezed independently onto each part
 * (the default for GLB rigs, where every mesh's own UVs already span the
 * full `[0,0]→[1,1]`).
 *
 * Only meaningful on a near-planar rig, where the vast majority of normals
 * genuinely point front or back: side, top and bottom faces fall back to a
 * single uniform-colour texel, which is fine for a flat body but leaves a
 * rounded one (cylindrical limbs, a spherical head) mostly untextured.
 * @param model The model to remap, mutated in place
 * @param layout Whether the two faces share one image or take half each
 * @returns Nothing; the model's geometry UV attributes are mutated in place
 */
export const remapUVsToWorldProjection = (
  model: THREE.Object3D,
  layout: UvProjectionLayout = 'wrapped'
): void => {
  const boundingBox = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  boundingBox.getSize(size)

  const worldPosition = new THREE.Vector3()
  const worldNormal = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3()

  model.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return

    const geometry = mesh.geometry
    const uv = geometry.attributes.uv
    const position = geometry.attributes.position
    const normal = geometry.attributes.normal
    if (!uv || !position || !normal) return

    mesh.updateMatrixWorld(true)
    normalMatrix.getNormalMatrix(mesh.matrixWorld)

    Array.from({ length: position.count }).forEach((_, i) => {
      worldNormal.set(normal.getX(i), normal.getY(i), normal.getZ(i))
      worldNormal.applyMatrix3(normalMatrix).normalize()

      const isModelFront = worldNormal.z < BACK_FACE_THRESHOLD
      const isModelBack = worldNormal.z > FRONT_FACE_THRESHOLD

      if (isModelFront || isModelBack) {
        worldPosition.set(position.getX(i), position.getY(i), position.getZ(i))
        mesh.localToWorld(worldPosition)

        const normalizedX = (worldPosition.x - boundingBox.min.x) / size.x
        const v = (worldPosition.y - boundingBox.min.y) / size.y
        // Each face is mirrored against the other, so that whichever one is
        // being looked at reads left-to-right the way it was drawn. Wrapped
        // sends both to the same coordinates; split keeps that reading but
        // lands each on its own half, so the two never share a texel.
        const mirrored = isModelFront ? 1 - normalizedX : normalizedX
        const u =
          layout === 'split' ? mirrored * PANEL_SCALE + (isModelFront ? PANEL_SCALE : 0) : mirrored
        uv.setXY(i, u, v)
      } else {
        uv.setXY(i, 0, 0)
      }
    })

    uv.needsUpdate = true
  })
}
