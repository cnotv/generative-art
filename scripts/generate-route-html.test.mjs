// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { discoverRoutes, ogImage } from './routes.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = resolve(ROOT, 'scripts/generate-route-html.mjs')

const INDEX_HTML = `<!doctype html><html><head>
<title>Generative art</title>
<meta property="og:title" content="Generative art" />
<meta property="og:image" content="" />
</head><body></body></html>`

const dist = mkdtempSync(join(tmpdir(), 'route-html-'))

beforeAll(() => {
  writeFileSync(join(dist, 'index.html'), INDEX_HTML)
  mkdirSync(join(dist, 'og/generative'), { recursive: true })
  writeFileSync(join(dist, 'og/generative/CubeMatrix.jpg'), '')
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

  it("points og:image at the route's own capture when it exists", () => {
    const html = readFileSync(join(dist, 'generative/CubeMatrix.html'), 'utf8')
    expect(html).toContain(
      '<meta property="og:image" content="https://cnotv.xyz/og/generative/CubeMatrix.jpg"'
    )
  })

  it('falls back to the landing page capture when the route has none', () => {
    const html = readFileSync(join(dist, 'games/MazeGame.html'), 'utf8')
    expect(html).toContain(
      '<meta property="og:image" content="https://cnotv.xyz/og/experiments/LandingPage.jpg"'
    )
  })
})

describe('OG captures', () => {
  it.each(discoverRoutes().map(({ path }) => [path]))(
    '%s has its image in public/ (pnpm capture <route>)',
    (path) => {
      expect(existsSync(join(ROOT, 'public', ogImage(path)))).toBe(true)
    }
  )
})
