import * as THREE from 'three'
import { placeScatterInstances } from './scatterPlacement'
import type {
  ScatterAreaConfig,
  ScatterAreaDefinition,
  ScatterAreaManager,
  ScatterChunk,
  ScatterInstance,
  ScatterTexture,
  TrackPath
} from '../types'
import {
  BACKGROUND_BEHIND,
  BACKGROUND_CHUNK_LENGTH,
  BACKGROUND_DISPOSE_BEHIND,
  BACKGROUND_LOOKAHEAD,
  SCATTER_ALPHA_TEST,
  SCATTER_BEHIND,
  SCATTER_CHUNK_LENGTH,
  SCATTER_DISPOSE_BEHIND,
  SCATTER_LOOKAHEAD
} from '../config'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const PLANE_GEOMETRY = new THREE.PlaneGeometry(1, 1)

// Chunk building runs inside the animation loop, so the transform scratch is
// allocated once and reused for every instance matrix.
const scratchMatrix = new THREE.Matrix4()
const scratchQuaternion = new THREE.Quaternion()
const scratchScale = new THREE.Vector3()

type ChunkSpan = {
  lookahead: number
  disposeBehind: number
  chunkLength: number
  behind: number
}

/**
 * How far ahead an area generates and how far behind it keeps its billboards.
 * The background reaches much further because its props are large and distant,
 * so a short window would visibly pop on the horizon.
 *
 * @param definition - The area being spanned
 * @returns The area's lookahead, keep-alive and chunk length
 */
export const scatterChunkSpan = (definition: ScatterAreaDefinition): ChunkSpan =>
  definition.placement === 'background'
    ? {
        lookahead: BACKGROUND_LOOKAHEAD,
        disposeBehind: BACKGROUND_DISPOSE_BEHIND,
        chunkLength: BACKGROUND_CHUNK_LENGTH,
        behind: BACKGROUND_BEHIND
      }
    : {
        lookahead: SCATTER_LOOKAHEAD,
        disposeBehind: SCATTER_DISPOSE_BEHIND,
        chunkLength: SCATTER_CHUNK_LENGTH,
        behind: SCATTER_BEHIND
      }

/**
 * Groups a chunk's instances by the texture they drew, so each texture becomes
 * one instanced draw call instead of one mesh per billboard.
 *
 * @param instances - Instances placed for a chunk
 * @returns Instances bucketed by texture index, empty buckets omitted
 */
export const groupInstancesByTexture = (
  instances: ScatterInstance[]
): Map<number, ScatterInstance[]> =>
  instances.reduce((buckets, instance) => {
    const bucket = buckets.get(instance.textureIndex) ?? []
    buckets.set(instance.textureIndex, [...bucket, instance])
    return buckets
  }, new Map<number, ScatterInstance[]>())

export type ScatterAreaManagerOptions = {
  scene: THREE.Scene
  path: TrackPath
  definition: ScatterAreaDefinition
  getConfig: () => ScatterAreaConfig
  getTextures: () => ScatterTexture[]
}

/**
 * Dresses one illustration family along the track, spawning billboards ahead of
 * the rock and disposing them behind so an endless world stays bounded.
 *
 * The billboards carry no rigid body at all: they are decoration the rock rolls
 * straight through. Their facing is baked at build time from the local heading,
 * which is where the chase camera sits, so no per-frame billboard pass is
 * needed for what can be thousands of planes.
 *
 * @param options - Scene, path, area definition and live config accessors
 * @returns Handles to pump, prune, rebuild and tear down the area
 */
export const createScatterAreaManager = (
  options: ScatterAreaManagerOptions
): ScatterAreaManager => {
  const { scene, path, definition, getConfig, getTextures } = options
  const span = scatterChunkSpan(definition)
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const textures = new Map<string, THREE.Texture>()
  let chunks: ScatterChunk[] = []
  let hidden = false

  const materialFor = (url: string): THREE.MeshStandardMaterial => {
    const existing = materials.get(url)
    if (existing) return existing
    const texture = new THREE.TextureLoader().load(url)
    texture.colorSpace = THREE.SRGBColorSpace
    textures.set(url, texture)
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: SCATTER_ALPHA_TEST,
      side: THREE.DoubleSide,
      roughness: 1,
      opacity: getConfig().opacity
    })
    materials.set(url, material)
    return material
  }

  const buildChunkMeshes = (instances: ScatterInstance[]): THREE.InstancedMesh[] => {
    const available = getTextures()
    return [...groupInstancesByTexture(instances).entries()].flatMap(([textureIndex, bucket]) => {
      const source = available[textureIndex]
      if (!source) return []
      const mesh = new THREE.InstancedMesh(PLANE_GEOMETRY, materialFor(source.url), bucket.length)
      bucket.forEach((instance, index) => {
        scratchQuaternion.setFromAxisAngle(Y_AXIS, instance.yaw)
        scratchScale.set(instance.width, instance.height, 1)
        scratchMatrix.compose(instance.position, scratchQuaternion, scratchScale)
        mesh.setMatrixAt(index, scratchMatrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.name = `scatter-${definition.name}`
      mesh.visible = !hidden
      mesh.castShadow = false
      mesh.receiveShadow = false
      // The planes are placed from the path, not from a bounding volume the
      // renderer can predict, so frustum culling would pop whole chunks out.
      mesh.frustumCulled = false
      scene.add(mesh)
      return [mesh]
    })
  }

  const spawnChunk = (startDistance: number): void => {
    const endDistance = startDistance + span.chunkLength
    const chunkIndex = Math.round(startDistance / span.chunkLength)
    const instances = placeScatterInstances({
      path,
      config: getConfig(),
      placement: definition.placement,
      fromDistance: startDistance,
      toDistance: endDistance,
      seed: getConfig().seed + chunkIndex,
      textureCount: getTextures().length
    })
    chunks = [...chunks, { startDistance, endDistance, meshes: buildChunkMeshes(instances) }]
  }

  const disposeChunk = (chunk: ScatterChunk): void =>
    chunk.meshes.forEach((mesh) => {
      scene.remove(mesh)
      mesh.dispose()
    })

  // Recursive rather than a loop: one chunk per call until the lookahead is
  // covered, matching how the track chunk manager pumps itself.
  const ensureAhead = (distance: number): void => {
    const tail = chunks[chunks.length - 1]?.endDistance ?? -span.behind
    if (tail >= distance + span.lookahead) return
    spawnChunk(tail)
    ensureAhead(distance)
  }

  const prune = (distance: number): void => {
    const cutoff = distance - span.disposeBehind
    chunks.filter((chunk) => chunk.endDistance < cutoff).forEach(disposeChunk)
    chunks = chunks.filter((chunk) => chunk.endDistance >= cutoff)
  }

  const disposeAll = (): void => {
    chunks.forEach(disposeChunk)
    chunks = []
  }

  const rebuild = (distance: number): void => {
    disposeAll()
    materials.forEach((material) => {
      material.opacity = getConfig().opacity
    })
    ensureAhead(distance)
  }

  const setHidden = (nextHidden: boolean): void => {
    hidden = nextHidden
    chunks.forEach((chunk) =>
      chunk.meshes.forEach((mesh) => {
        mesh.visible = !nextHidden
      })
    )
  }

  const instanceCount = (): number =>
    chunks.reduce(
      (total, chunk) => total + chunk.meshes.reduce((sum, mesh) => sum + mesh.count, 0),
      0
    )

  return {
    name: definition.name,
    ensureAhead,
    prune,
    rebuild,
    setHidden,
    instanceCount,
    teardown: () => {
      disposeAll()
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      materials.clear()
      textures.clear()
    }
  }
}
