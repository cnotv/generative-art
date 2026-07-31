import * as THREE from 'three'
import { applyLateralFog } from '../lateralFog'
import { placeScatterInstances } from './scatterPlacement'
import type {
  LateralFogUniforms,
  ScatterAreaConfig,
  ScatterAreaDefinition,
  ScatterAreaManager,
  ScatterChunk,
  ScatterInstance,
  ScatterTexture,
  TrackPath
} from '../types'
import {
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
 *
 * @returns The lookahead, keep-alive, chunk length and reach behind
 */
export const scatterChunkSpan = (): ChunkSpan => ({
  lookahead: SCATTER_LOOKAHEAD,
  disposeBehind: SCATTER_DISPOSE_BEHIND,
  chunkLength: SCATTER_CHUNK_LENGTH,
  behind: SCATTER_BEHIND
})

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
  lateralFog: LateralFogUniforms
  getConfig: () => ScatterAreaConfig
  getTextures: (distance: number) => ScatterTexture[]
  /**
   * Offsets this area's chunk grid. Every area shares the same chunk length,
   * so left at zero they would all fall due for a new chunk on the same
   * distance — several new InstancedMeshes (and any first-use shader
   * compiles) landing in one frame. A different offset per area spreads that
   * same total work across more frames instead.
   */
  chunkPhase?: number
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
// Materials are cached per texture and shared across every chunk of an area, so
// a long run never rebuilds one.
const createMaterialCache = (uniforms: LateralFogUniforms, opacityOf: () => number) => {
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  const textures = new Map<string, THREE.Texture>()
  return {
    materials,
    for: (url: string): THREE.MeshStandardMaterial => {
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
        opacity: opacityOf()
      })
      applyLateralFog(material, uniforms)
      materials.set(url, material)
      return material
    },
    dispose: () => {
      materials.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
      materials.clear()
      textures.clear()
    }
  }
}

export const createScatterAreaManager = (
  options: ScatterAreaManagerOptions
): ScatterAreaManager => {
  const { scene, path, definition, getConfig, getTextures } = options
  const span = scatterChunkSpan()
  const phase = options.chunkPhase ?? 0
  const cache = createMaterialCache(options.lateralFog, () => getConfig().opacity)
  let chunks: ScatterChunk[] = []
  let hidden = false

  const buildChunkMeshes = (
    instances: ScatterInstance[],
    available: ScatterTexture[]
  ): THREE.InstancedMesh[] => {
    return [...groupInstancesByTexture(instances).entries()].flatMap(([textureIndex, bucket]) => {
      const source = available[textureIndex]
      if (!source) return []
      // Cloned, not shared: each mesh carries its own per-instance lateral
      // offsets, which would otherwise overwrite every other chunk's.
      const mesh = new THREE.InstancedMesh(
        PLANE_GEOMETRY.clone(),
        cache.for(source.url),
        bucket.length
      )
      bucket.forEach((instance, index) => {
        scratchQuaternion.setFromAxisAngle(Y_AXIS, instance.yaw)
        scratchScale.set(instance.mirrored ? -instance.width : instance.width, instance.height, 1)
        scratchMatrix.compose(instance.position, scratchQuaternion, scratchScale)
        mesh.setMatrixAt(index, scratchMatrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      // Per-instance so a billboard fades by where it stands, not by where its
      // chunk happens to be.
      mesh.geometry.setAttribute(
        'lateralOffset',
        new THREE.InstancedBufferAttribute(
          Float32Array.from(bucket, (entry) => Math.abs(entry.lateral)),
          1
        )
      )
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
    // Resolved from where this chunk sits, so ground built ahead already
    // carries the illustrations for the stretch it belongs to. Nothing standing
    // is ever swapped out from under the player: the change arrives as they
    // drive into it, and the fog closes well short of the boundary so the
    // handover is never in view.
    const available = getTextures(startDistance)
    const instances = placeScatterInstances({
      path,
      config: getConfig(),
      placement: definition.placement,
      fromDistance: startDistance,
      toDistance: endDistance,
      seed: getConfig().seed + chunkIndex,
      textureCount: available.length
    })
    chunks = [
      ...chunks,
      { startDistance, endDistance, meshes: buildChunkMeshes(instances, available) }
    ]
  }

  const disposeChunk = (chunk: ScatterChunk): void =>
    chunk.meshes.forEach((mesh) => {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.dispose()
    })

  const chunkTail = (): number => chunks[chunks.length - 1]?.endDistance ?? phase - span.behind
  const needsChunk = (distance: number): boolean => chunkTail() < distance + span.lookahead

  // Recursive: fills the whole lookahead in one call. Used only for a
  // deliberate rebuild; pump below builds one chunk per frame instead, so a
  // slow device never pays for several areas' meshes in the same frame.
  const ensureAhead = (distance: number): void => {
    if (!needsChunk(distance)) return
    spawnChunk(chunkTail())
    ensureAhead(distance)
  }

  // Called every frame: at most one chunk, so falling behind costs a few
  // thin frames of lookahead rather than one frame building them all.
  const pump = (distance: number): void => {
    if (needsChunk(distance)) spawnChunk(chunkTail())
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
    cache.materials.forEach((material) => {
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
    pump,
    prune,
    rebuild,
    setHidden,
    instanceCount,
    teardown: () => {
      disposeAll()
      cache.dispose()
    }
  }
}
