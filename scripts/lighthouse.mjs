#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const isCI = !!process.env.CI
const targetUrl = process.argv[2] ?? 'http://localhost:4173'
const isLocalhost = targetUrl.startsWith('http://localhost')

if (isLocalhost && !existsSync('dist/index.html')) {
  const buildResult = spawnSync('pnpm', ['build-only'], { stdio: 'inherit', shell: false })
  if (buildResult.status !== 0) process.exit(buildResult.status ?? 1)
}

const chromeFlags = isCI ? '--no-sandbox --disable-dev-shm-usage --disable-gpu' : ''

const args = [
  'collect',
  `--url=${targetUrl}`,
  `--numberOfRuns=${isCI ? 3 : 1}`,
  '--settings.maxWaitForFcp=30000',
  '--settings.maxWaitForLoad=45000'
]

if (chromeFlags) args.push(`--settings.chromeFlags=${chromeFlags}`)

if (isLocalhost) {
  args.push('--startServerCommand=pnpm preview')
  args.push('--startServerReadyPattern=Local:')
}

const result = spawnSync('node_modules/.bin/lhci', args, { stdio: 'inherit', shell: false })
process.exit(result.status ?? 1)
