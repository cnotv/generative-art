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

const categories = {
  performance: report.categories?.performance?.score,
  accessibility: report.categories?.accessibility?.score,
  'best-practices': report.categories?.['best-practices']?.score,
  seo: report.categories?.seo?.score
}

mkdirSync(BADGES_DIR, { recursive: true })

Object.entries(categories).map(([key, rawScore]) => {
  if (rawScore == null) return
  const score = Math.round(rawScore * 100)
  const badge = {
    schemaVersion: 1,
    label: key.replace(/-/g, ' '),
    message: String(score),
    color: scoreColor(score),
    cacheSeconds: 300
  }
  const outPath = resolve(BADGES_DIR, `lighthouse-${key}.json`)
  writeFileSync(outPath, JSON.stringify(badge, null, 2))
  process.stdout.write(`Wrote ${outPath} (score: ${score})\n`)
})
