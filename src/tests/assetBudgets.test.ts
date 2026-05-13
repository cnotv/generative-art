import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../public')

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
