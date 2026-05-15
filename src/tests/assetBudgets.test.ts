import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../public')

// ── GLB triangle parser ───────────────────────────────────────────────────────
// Reads the JSON chunk of a GLB binary to count triangles without a WebGL context.
const GLB_MAGIC = 0x46546c67
const GLB_JSON_CHUNK_OFFSET = 20

const parseGlbTriangles = (filePath: string): number => {
  const buffer = readFileSync(filePath)
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) return 0

  const jsonLength = buffer.readUInt32LE(12)
  const jsonText = buffer
    .subarray(GLB_JSON_CHUNK_OFFSET, GLB_JSON_CHUNK_OFFSET + jsonLength)
    .toString('utf8')
  const gltf: {
    meshes?: { primitives?: { indices?: number; attributes?: { POSITION?: number } }[] }[]
    accessors?: { count: number }[]
  } = JSON.parse(jsonText)

  const accessors = gltf.accessors ?? []
  return (gltf.meshes ?? []).reduce((total, mesh) => {
    return (
      total +
      (mesh.primitives ?? []).reduce((subtotal, primitive) => {
        const indexAccessor = accessors[primitive.indices ?? -1]
        const posAccessor = accessors[primitive.attributes?.POSITION ?? -1]
        if (indexAccessor) return subtotal + Math.floor(indexAccessor.count / 3)
        if (posAccessor) return subtotal + Math.floor(posAccessor.count / 3)
        return subtotal
      }, 0)
    )
  }, 0)
}

// Default size budget per GLB file. Prevents new large assets from shipping unreviewed.
const DEFAULT_BUDGET_BYTES = 2_000_000 // 2 MB

// Known files that exceed the default budget. Each entry must have a tracking comment
// explaining why it is oversized and what the plan is to address it.
const OVERSIZED_ALLOWLIST: Record<string, number> = {
  // 8.8 MB — high-poly table model; candidate for decimation in a follow-up (epic #19)
  'round_table.glb': 10_000_000
}

const glbFiles = readdirSync(PUBLIC_DIR).filter((file) => file.endsWith('.glb'))

describe('GLB asset size budgets', () => {
  describe('all GLB files are within their budget', () => {
    glbFiles.forEach((file) => {
      it(`${file}`, () => {
        const budget = OVERSIZED_ALLOWLIST[file] ?? DEFAULT_BUDGET_BYTES
        const { size } = statSync(join(PUBLIC_DIR, file))

        expect(
          size,
          `${file} is ${(size / 1_000_000).toFixed(1)} MB — exceeds ${budget / 1_000_000} MB budget`
        ).toBeLessThanOrEqual(budget)
      })
    })
  })

  it('oversized allowlist has no stale entries (all listed files still exist)', () => {
    const existingFiles = new Set(glbFiles)
    const staleEntries = Object.keys(OVERSIZED_ALLOWLIST).filter((file) => !existingFiles.has(file))

    expect(
      staleEntries,
      `Stale allowlist entries (file removed but not cleaned up): ${staleEntries.join(', ')}`
    ).toHaveLength(0)
  })

  it('no unapproved GLB file exceeds the default budget', () => {
    const violations = glbFiles
      .filter((file) => !(file in OVERSIZED_ALLOWLIST))
      .filter((file) => statSync(join(PUBLIC_DIR, file)).size > DEFAULT_BUDGET_BYTES)

    expect(
      violations,
      `Files over ${DEFAULT_BUDGET_BYTES / 1_000_000} MB without allowlist entry: ${violations.join(', ')}`
    ).toHaveLength(0)
  })
})

// ── Triangle budgets ──────────────────────────────────────────────────────────

// Default triangle budget per GLB. Keeps individual assets decimation-friendly
// and avoids per-frame vertex processing costs.
const DEFAULT_TRIANGLE_BUDGET = 200_000

// Known files that exceed the default budget. Each entry must have a tracking
// comment explaining why and what the plan is.
const HIGH_TRIANGLE_ALLOWLIST: Record<string, number> = {
  // 42k triangles — complex table mesh; candidate for decimation (epic #19)
  'round_table.glb': 100_000
}

describe('GLB triangle budgets', () => {
  describe('all GLB files are within their triangle budget', () => {
    glbFiles.forEach((file) => {
      it(`${file}`, () => {
        const budget = HIGH_TRIANGLE_ALLOWLIST[file] ?? DEFAULT_TRIANGLE_BUDGET
        const triangles = parseGlbTriangles(join(PUBLIC_DIR, file))

        expect(
          triangles,
          `${file} has ${triangles.toLocaleString()} triangles — exceeds ${budget.toLocaleString()} budget`
        ).toBeLessThanOrEqual(budget)
      })
    })
  })

  it('triangle allowlist has no stale entries', () => {
    const existingFiles = new Set(glbFiles)
    const staleEntries = Object.keys(HIGH_TRIANGLE_ALLOWLIST).filter(
      (file) => !existingFiles.has(file)
    )
    expect(
      staleEntries,
      `Stale triangle allowlist entries: ${staleEntries.join(', ')}`
    ).toHaveLength(0)
  })
})
