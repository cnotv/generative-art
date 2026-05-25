// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = resolve(ROOT, 'scripts/generate-lighthouse-badges.mjs')
const BADGES_DIR = resolve(ROOT, 'badges')
const FIXTURES_DIR = resolve(ROOT, 'scripts/__fixtures__')

const makeReport = (categoryScores = {}) => ({
  categories: {
    performance: { score: 0.92 },
    accessibility: { score: 0.85 },
    'best-practices': { score: 0.58 },
    seo: { score: 0.43 },
    ...categoryScores
  }
})

const savedBadges = {}

beforeEach(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true })
  const entries = Object.fromEntries(
    readdirSync(BADGES_DIR).map((file) => [file, readFileSync(resolve(BADGES_DIR, file), 'utf8')])
  )
  Object.assign(savedBadges, entries)
})

afterEach(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
  Object.entries(savedBadges).forEach(([file, content]) => {
    writeFileSync(resolve(BADGES_DIR, file), content)
  })
})

const runWithReport = (report) => {
  const reportPath = resolve(FIXTURES_DIR, 'report.json')
  writeFileSync(reportPath, JSON.stringify(report))
  return execFileSync('node', [SCRIPT, reportPath], { encoding: 'utf8' })
}

const readBadgeSvg = (key) => readFileSync(resolve(BADGES_DIR, `lighthouse-${key}.svg`), 'utf8')

describe('generate-lighthouse-badges', () => {
  it('writes all four SVG badge files', () => {
    runWithReport(makeReport())
    ;['performance', 'accessibility', 'best-practices', 'seo'].forEach((key) => {
      const svg = readBadgeSvg(key)
      expect(svg).toContain('<svg')
    })
  })

  it.each([
    [0.92, '92', '4c1'],
    [0.9, '90', '4c1'],
    [0.89, '89', 'fe7d37'],
    [0.85, '85', 'fe7d37'],
    [0.5, '50', 'fe7d37'],
    [0.49, '49', 'e05d44'],
    [0.43, '43', 'e05d44'],
    [0.0, '0', 'e05d44']
  ])('score %.2f → score text "%s", color "%s"', (rawScore, expectedScore, expectedColor) => {
    runWithReport({ categories: { performance: { score: rawScore } } })
    const svg = readBadgeSvg('performance')
    expect(svg).toContain(expectedScore)
    expect(svg).toContain(expectedColor)
  })

  it('label uses spaces not hyphens', () => {
    runWithReport(makeReport())
    const svg = readBadgeSvg('best-practices')
    expect(svg).toContain('best practices')
  })

  it('skips categories with null or missing scores', () => {
    expect(() =>
      runWithReport({ categories: { performance: { score: 0.9 }, accessibility: null } })
    ).not.toThrow()
  })

  it('exits non-zero when no report path is given', () => {
    expect(() => execFileSync('node', [SCRIPT], { encoding: 'utf8', stdio: 'pipe' })).toThrow()
  })
})
