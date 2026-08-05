import * as THREE from 'three'

const FRONT_FACE_THRESHOLD = 0.7
const BACK_FACE_THRESHOLD = -0.7

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
 * @returns Nothing; the model's geometry UV attributes are mutated in place
 */
export const remapUVsToWorldProjection = (model: THREE.Object3D): void => {
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
        const u = isModelFront ? 1 - normalizedX : normalizedX
        uv.setXY(i, u, v)
      } else {
        uv.setXY(i, 0, 0)
      }
    })

    uv.needsUpdate = true
  })
}
