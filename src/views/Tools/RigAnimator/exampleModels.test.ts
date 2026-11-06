import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { HUMANOID_BONE_HIERARCHY } from '@webgamekit/rig'
import {
  DEFAULT_MODEL_PATH,
  EXAMPLE_MODELS,
  MODEL_SELECTOR_CONTROL,
  OWN_RIG_MODEL_PATH
} from './config'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../public')

// ── GLB reader ────────────────────────────────────────────────────────────────
// Reads the JSON and binary chunks straight from the file, the way the asset budget test does:
// no WebGL context, no loader, just the bytes the animator will meet.
const GLB_JSON_CHUNK_OFFSET = 20

type GltfAccessor = {
  bufferView?: number
  byteOffset?: number
  componentType: number
  count: number
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4'
}

type Gltf = {
  nodes: { name?: string; mesh?: number; skin?: number }[]
  skins?: { joints: number[] }[]
  meshes?: { primitives: { attributes: Record<string, number> }[] }[]
  accessors: GltfAccessor[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
}

const BYTES_PER_COMPONENT: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }
const COMPONENTS_IN_TYPE: Record<GltfAccessor['type'], number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4
}

const readGlb = (filePath: string): { gltf: Gltf; binary: DataView } => {
  const buffer = readFileSync(filePath)
  const jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(
    buffer.subarray(GLB_JSON_CHUNK_OFFSET, GLB_JSON_CHUNK_OFFSET + jsonLength).toString('utf8')
  ) as Gltf
  const binaryStart = GLB_JSON_CHUNK_OFFSET + jsonLength
  const binaryLength = buffer.readUInt32LE(binaryStart)
  return {
    gltf,
    binary: new DataView(buffer.buffer, buffer.byteOffset + binaryStart + 8, binaryLength)
  }
}

const componentAt = (binary: DataView, componentType: number, offset: number): number => {
  if (componentType === 5121) return binary.getUint8(offset)
  if (componentType === 5123) return binary.getUint16(offset, true)
  if (componentType === 5125) return binary.getUint32(offset, true)
  return binary.getFloat32(offset, true)
}

/** Every element of an accessor, each as its own row of components. */
const readAccessor = (gltf: Gltf, binary: DataView, index: number): number[][] => {
  const accessor = gltf.accessors[index]
  const view = gltf.bufferViews[accessor.bufferView ?? 0]
  const components = COMPONENTS_IN_TYPE[accessor.type]
  const componentSize = BYTES_PER_COMPONENT[accessor.componentType]
  const stride = view.byteStride ?? componentSize * components
  const first = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return Array.from({ length: accessor.count }, (_, element) =>
    Array.from({ length: components }, (_, component) =>
      componentAt(
        binary,
        accessor.componentType,
        first + element * stride + component * componentSize
      )
    )
  )
}

const jointNamesOf = (gltf: Gltf): string[] =>
  (gltf.skins?.[0]?.joints ?? []).map((joint) => gltf.nodes[joint].name ?? '')

describe('EXAMPLE_MODELS', () => {
  it('loads the default model on arrival, as the first entry', () => {
    expect(EXAMPLE_MODELS[0]).toMatchObject({ value: DEFAULT_MODEL_PATH })
  })

  it.each(EXAMPLE_MODELS)('ships "$label" at $value', ({ value }) => {
    expect(existsSync(join(PUBLIC_DIR, value))).toBe(true)
  })

  it('is the list the Model control offers, so the two cannot drift apart', () => {
    expect(MODEL_SELECTOR_CONTROL).toMatchObject({
      label: 'Model',
      component: 'ButtonSelector',
      options: EXAMPLE_MODELS
    })
  })
})

describe('the own-rig example', () => {
  const { gltf, binary } = readGlb(join(PUBLIC_DIR, OWN_RIG_MODEL_PATH))
  const jointNames = jointNamesOf(gltf)

  it('carries a bone for every bone of the animator’s humanoid hierarchy', () => {
    expect(jointNames).toEqual(
      expect.arrayContaining(HUMANOID_BONE_HIERARCHY.map((definition) => definition.name))
    )
  })

  it('names every bone, so the Bone dropdown can list and order them', () => {
    expect(jointNames).not.toContain('')
  })

  it('starts at the humanoid root, which its body-part groups hang off', () => {
    expect(jointNames[0]).toBe('mixamorigHips')
  })

  it('weights every vertex, so nothing is left behind when a bone moves', () => {
    const attributes = gltf.meshes?.[0]?.primitives[0].attributes ?? {}
    expect(attributes.WEIGHTS_0, 'the primitive carries no WEIGHTS_0 attribute').toBeDefined()

    const weights = readAccessor(gltf, binary, attributes.WEIGHTS_0)
    const unweighted = weights.filter((vertex) => vertex.every((weight) => weight === 0))

    expect(
      unweighted,
      `${unweighted.length} of ${weights.length} vertices carry no weight`
    ).toHaveLength(0)
  })

  it('binds every vertex to a bone the skeleton actually has', () => {
    const attributes = gltf.meshes?.[0]?.primitives[0].attributes ?? {}
    expect(attributes.JOINTS_0, 'the primitive carries no JOINTS_0 attribute').toBeDefined()

    const bound = readAccessor(gltf, binary, attributes.JOINTS_0).flat()

    expect(bound.reduce((highest, joint) => Math.max(highest, joint), 0)).toBeLessThan(
      jointNames.length
    )
  })

  it('skins its mesh to one skeleton', () => {
    expect(gltf.skins).toHaveLength(1)
    expect(gltf.nodes.some((node) => node.mesh !== undefined && node.skin !== undefined)).toBe(true)
  })
})
