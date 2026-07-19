import * as THREE from 'three'
import type { ComplexModel } from '@webgamekit/animation'
import { OCCLUSION_OPACITY } from './config'

type SavedMaterialState = {
  transparent: boolean
  opacity: number
  depthWrite: boolean
}

const materialOf = (mesh: THREE.Mesh): THREE.Material | null => {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material instanceof THREE.Material ? material : null
}

/**
 * Fades any track piece that sits between the race camera and the marble, so
 * the marble is never fully hidden. Each frame it casts a ray from the camera
 * to the marble, drops occluding piece materials to a low opacity (and stops
 * them writing depth so the marble shows through), and restores materials once
 * they no longer block the view. Reuses its raycaster and vectors to avoid
 * per-frame allocation.
 *
 * @returns Object exposing `update` (call per frame) and `dispose` (restore all)
 */
export const createOcclusionFader = () => {
  const raycaster = new THREE.Raycaster()
  const cameraPosition = new THREE.Vector3()
  const marblePosition = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const saved = new Map<THREE.Material, SavedMaterialState>()

  const fade = (material: THREE.Material): void => {
    if (saved.has(material)) return
    const standard = material as THREE.MeshStandardMaterial
    saved.set(material, {
      transparent: material.transparent,
      opacity: standard.opacity,
      depthWrite: material.depthWrite
    })
    material.transparent = true
    standard.opacity = OCCLUSION_OPACITY
    material.depthWrite = false
    material.needsUpdate = true
  }

  const restore = (material: THREE.Material): void => {
    const state = saved.get(material)
    if (!state) return
    const standard = material as THREE.MeshStandardMaterial
    material.transparent = state.transparent
    standard.opacity = state.opacity
    material.depthWrite = state.depthWrite
    material.needsUpdate = true
    saved.delete(material)
  }

  const collectOccluders = (
    camera: THREE.Camera,
    marble: ComplexModel,
    models: ComplexModel[]
  ): Set<THREE.Material> => {
    camera.getWorldPosition(cameraPosition)
    ;(marble as unknown as THREE.Object3D).getWorldPosition(marblePosition)
    direction.copy(marblePosition).sub(cameraPosition)
    const distance = direction.length()
    if (distance < 1e-4) return new Set()
    direction.normalize()
    raycaster.set(cameraPosition, direction)
    raycaster.near = 0
    raycaster.far = distance
    const hits = raycaster.intersectObjects(models as unknown as THREE.Object3D[], false)
    const occluders = new Set<THREE.Material>()
    hits.forEach((hit) => {
      const material = materialOf(hit.object as THREE.Mesh)
      if (material) occluders.add(material)
    })
    return occluders
  }

  const update = (
    camera: THREE.Camera | null,
    marble: ComplexModel | null,
    models: ComplexModel[]
  ): void => {
    if (!camera || !marble) {
      saved.forEach((_, material) => restore(material))
      return
    }
    const occluders = collectOccluders(camera, marble, models)
    occluders.forEach(fade)
    ;[...saved.keys()].forEach((material) => {
      if (!occluders.has(material)) restore(material)
    })
  }

  const dispose = (): void => {
    ;[...saved.keys()].forEach((material) => restore(material))
    saved.clear()
  }

  return { update, dispose }
}
