/**
 * Renders a Strudel pattern to a WAV or MIDI file through the Strudel Editor's own export tab,
 * so the file is exactly what the editor plays. Chromium runs headless and muted: the WAV is
 * rendered offline and nothing reaches the speakers.
 *
 * Needs the dev server running (`pnpm dev --port 5317 --strictPort`).
 *
 * Usage:
 *   node scripts/strudel-export.mjs <pattern.strudel> --out <file.wav|file.mid>
 *     [--start 0] [--cycles 1 | --once] [--rate 48000] [--url http://localhost:5317]
 * The format follows the output's extension. `--once` exports a single repetition of the
 * pattern, which is shorter than a cycle when the code speeds it up, as `fast(2)` does.
 */
import { readFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

const STORAGE_KEY = 'strudel-editor-code'
const RENDER_TIMEOUT = 180_000
const SAMPLE_RATE_LABELS = { 44100: '44.1 kHz', 48000: '48 kHz', 96000: '96 kHz' }

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    start: { type: 'string', default: '0' },
    cycles: { type: 'string', default: '1' },
    once: { type: 'boolean', default: false },
    rate: { type: 'string', default: '48000' },
    url: { type: 'string', default: 'http://localhost:5317' }
  }
})

const [patternFile] = positionals
const outputPath = values.out ? resolve(values.out) : undefined
const extension = outputPath ? extname(outputPath).toLowerCase() : ''
const format = { '.wav': 'wav', '.mid': 'midi', '.midi': 'midi' }[extension]
if (!patternFile || !outputPath || !format) {
  console.error('Usage: node scripts/strudel-export.mjs <pattern> --out <file.wav|file.mid>')
  process.exit(1)
}
const rateLabel = SAMPLE_RATE_LABELS[values.rate]
if (format === 'wav' && !rateLabel) {
  console.error(`--rate must be one of ${Object.keys(SAMPLE_RATE_LABELS).join(', ')}`)
  process.exit(1)
}

const patternCode = readFileSync(resolve(patternFile), 'utf8')
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] })
try {
  const page = await browser.newPage({ acceptDownloads: true })
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[page] ${message.text()}`)
  })
  await page.addInitScript(
    ([key, code]) => window.localStorage.setItem(key, code),
    [STORAGE_KEY, patternCode]
  )
  await page.goto(`${values.url}/tools/StrudelEditor#export`)
  // The drawer scope matters: the toolbar has a MIDI button of its own.
  await page
    .locator('aside')
    .getByRole('button', { name: format === 'midi' ? 'MIDI' : 'WAV', exact: true })
    .click()
  await page
    .locator('aside')
    .getByLabel('Name', { exact: true })
    .fill(basename(outputPath, extension))
  await page.getByLabel('Start cycle').fill(values.start)
  await page.getByLabel('Cycles').fill(values.cycles)
  if (values.once) {
    await page.getByRole('button', { name: 'One repetition' }).click()
    const measured = page.getByText(/One repetition lasts/)
    await measured.waitFor({ timeout: RENDER_TIMEOUT })
    console.log(await measured.innerText())
  }
  if (format === 'wav') {
    await page.getByRole('button', { name: rateLabel, exact: true }).click()
  }
  const exportButton = page.getByRole('button', { name: /^Export to (WAV|MIDI)$/ })
  const failure = page
    .getByRole('alert')
    .first()
    .waitFor({ timeout: RENDER_TIMEOUT })
    .then(async () => {
      throw new Error(await page.getByRole('alert').first().innerText())
    })
  const [download] = await Promise.race([
    Promise.all([page.waitForEvent('download', { timeout: RENDER_TIMEOUT }), exportButton.click()]),
    failure
  ])
  await download.saveAs(outputPath)
  console.log(outputPath)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await browser.close()
}
