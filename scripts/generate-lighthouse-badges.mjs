/**
 * Reads a Lighthouse JSON report and writes shields.io endpoint badge files
 * to the badges/ directory.
 *
 * Usage: node scripts/generate-lighthouse-badges.mjs <report.json>
 *
 * Badge files are read by shields.io via:
 *   https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/...
 */

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
  if (score >= 90) return 'brightgreen'
  if (score >= 50) return 'orange'
  return 'red'
}

const categories = {
  performance: report.categories?.performance?.score,
  accessibility: report.categories?.accessibility?.score,
  'best-practices': report.categories?.['best-practices']?.score,
  seo: report.categories?.seo?.score
}

mkdirSync(BADGES_DIR, { recursive: true })

Object.entries(categories).forEach(([key, rawScore]) => {
  if (rawScore == null) return
  const score = Math.round(rawScore * 100)
  const badge = {
    schemaVersion: 1,
    label: key.replace(/-/g, ' '),
    message: String(score),
    color: scoreColor(score)
  }
  const outPath = resolve(BADGES_DIR, `lighthouse-${key}.json`)
  writeFileSync(outPath, `${JSON.stringify(badge, null, 2)  }\n`)
  process.stdout.write(`Wrote ${outPath} (score: ${score})\n`)
})
