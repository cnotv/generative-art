// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = resolve(ROOT, 'scripts/generate-route-html.mjs')

const INDEX_HTML = `<!doctype html><html><head>
<title>Generative art</title>
<meta property="og:title" content="Generative art" />
</head><body></body></html>`

const dist = mkdtempSync(join(tmpdir(), 'route-html-'))

beforeAll(() => {
  writeFileSync(join(dist, 'index.html'), INDEX_HTML)
  execFileSync('node', [SCRIPT], { env: { ...process.env, DIST_DIR: dist } })
})

afterAll(() => {
  rmSync(dist, { recursive: true, force: true })
})

describe('generate-route-html', () => {
  it('writes the route page as a folder index, served for /route/', () => {
    const html = readFileSync(join(dist, 'generative/CubeMatrix/index.html'), 'utf8')
    expect(html).toContain('<meta property="og:title" content="Cube Matrix"')
  })

  // vite preview (production) only resolves /route to route.html, never route/index.html
  it('writes the route page as a sibling .html, served for /route without a trailing slash', () => {
    const html = readFileSync(join(dist, 'generative/CubeMatrix.html'), 'utf8')
    expect(html).toContain('<meta property="og:title" content="Cube Matrix"')
  })
})
