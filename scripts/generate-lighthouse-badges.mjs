import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BADGES_DIR = resolve(ROOT, 'badges')

const reportPath = process.argv[2]
if (!reportPath) {
  process.stderr.write('Usage: node scripts/generate-lighthouse-badges.mjs <report.json>\n')
  process.exit(1)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))

const scoreColor = (score) => {
  if (score >= 90) return '4c1'
  if (score >= 50) return 'fe7d37'
  return 'e05d44'
}

const lcpColor = (ms) => {
  if (ms < 2500) return '4c1'
  if (ms < 4000) return 'fe7d37'
  return 'e05d44'
}

const clsColor = (value) => {
  if (value < 0.1) return '4c1'
  if (value < 0.25) return 'fe7d37'
  return 'e05d44'
}

const tbtColor = (ms) => {
  if (ms < 200) return '4c1'
  if (ms < 600) return 'fe7d37'
  return 'e05d44'
}

const writeBadge = (key, label, message, color) => {
  const badge = { schemaVersion: 1, label, message, color, cacheSeconds: 300 }
  const outPath = resolve(BADGES_DIR, `lighthouse-${key}.json`)
  writeFileSync(outPath, JSON.stringify(badge, null, 2))
  process.stdout.write(`Wrote ${outPath}\n`)
}

const categories = {
  performance: report.categories?.performance?.score,
  accessibility: report.categories?.accessibility?.score,
  'best-practices': report.categories?.['best-practices']?.score,
  seo: report.categories?.seo?.score
}

const audits = report.audits ?? {}

mkdirSync(BADGES_DIR, { recursive: true })

Object.entries(categories).map(([key, rawScore]) => {
  if (rawScore == null) return
  const score = Math.round(rawScore * 100)
  writeBadge(key, key.replace(/-/g, ' '), String(score), scoreColor(score))
})

const lcp = audits['largest-contentful-paint']
if (lcp?.numericValue != null)
  writeBadge('lcp', 'lcp', lcp.displayValue, lcpColor(lcp.numericValue))

const cls = audits['cumulative-layout-shift']
if (cls?.numericValue != null)
  writeBadge('cls', 'cls', cls.displayValue, clsColor(cls.numericValue))

const tbt = audits['total-blocking-time']
if (tbt?.numericValue != null)
  writeBadge('tbt', 'tbt', tbt.displayValue, tbtColor(tbt.numericValue))
