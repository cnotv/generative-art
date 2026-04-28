import { createServer } from 'node:http'
import { readFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright'
import { ROOT, discoverRoutes } from './routes.mjs'

const DIST = join(ROOT, 'dist')
const PORT = 4321
const BASE_URL = `http://localhost:${PORT}`
const VIEWPORT = { width: 1200, height: 630 }
const RENDER_WAIT_MS = 3000
const BATCH_SIZE = 5

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.fbx': 'application/octet-stream'
}

const resolvePath = (urlPath) => {
  const sanitised = urlPath.split('?')[0]
  const candidate = join(DIST, sanitised === '/' ? 'index.html' : sanitised)
  try {
    const info = statSync(candidate)
    if (info.isDirectory()) {
      const nested = join(candidate, 'index.html')
      return existsSync(nested) ? nested : join(DIST, 'index.html')
    }
    return candidate
  } catch {
    return join(DIST, 'index.html')
  }
}

const startStaticServer = () =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const filePath = resolvePath(req.url)
      const mime = MIME_TYPES[extname(filePath)] || 'application/octet-stream'
      try {
        res.writeHead(200, { 'Content-Type': mime })
        res.end(readFileSync(filePath))
      } catch {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(PORT, () => resolve(server))
  })

/**
 * Launches a headless browser, visits every discovered route, and saves a
 * 1200×630 screenshot to dist/previews/{group}/{viewName}.png for use as OG images.
 */
const run = async () => {
  const routes = discoverRoutes()
  const server = await startStaticServer()
  const browser = await chromium.launch()

  const screenshotRoute = async ({ path, group, viewName }) => {
    const routePage = await browser.newPage()
    await routePage.setViewportSize(VIEWPORT)
    await routePage.goto(`${BASE_URL}${path}`)
    await routePage.waitForLoadState('networkidle')
    await routePage.waitForTimeout(RENDER_WAIT_MS)
    const previewDirectory = join(DIST, 'previews', group.toLowerCase())
    mkdirSync(previewDirectory, { recursive: true })
    await routePage.screenshot({ path: join(previewDirectory, `${viewName}.png`) })
    await routePage.close()
    process.stdout.write(`  ✓ ${path}\n`)
  }

  const batches = Array.from({ length: Math.ceil(routes.length / BATCH_SIZE) }, (_, batchIndex) =>
    routes.slice(batchIndex * BATCH_SIZE, batchIndex * BATCH_SIZE + BATCH_SIZE)
  )
  await batches.reduce(
    (chain, batch) => chain.then(() => Promise.all(batch.map(screenshotRoute))),
    Promise.resolve()
  )

  await browser.close()
  server.close()
  process.stdout.write(`\nScreenshots generated for ${routes.length} routes\n`)
}

run().catch((error) => {
  process.stderr.write(`Screenshot generation failed: ${error.message}\nSkipping.\n`)
  process.exit(0)
})
