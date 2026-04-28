import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, discoverRoutes } from './routes.mjs'

const DIST = join(ROOT, 'dist')
const SITE_URL = process.env.SITE_URL || 'https://cnotv.xyz'
const DEFAULT_DESCRIPTION =
  'Interactive generative art, 3D experiments, and games built with Three.js and Vue.'
const SITE_TITLE = 'Generative Art'

const viewsMeta = JSON.parse(readFileSync(join(ROOT, 'src/config/viewsMeta.json'), 'utf-8'))

const resolveImage = (group, viewName, metaImage) => {
  if (metaImage) return `${SITE_URL}${metaImage}`
  const screenshotPath = join(DIST, 'previews', group.toLowerCase(), `${viewName}.png`)
  if (existsSync(screenshotPath))
    return `${SITE_URL}/previews/${group.toLowerCase()}/${viewName}.png`
  return `${SITE_URL}/logobw.svg`
}

const injectMeta = (html, { title, description, url, image }) => {
  const fullTitle = `${title} | ${SITE_TITLE}`
  return html
    .replace(/(<title>)[^<]*(<\/title>)/, `$1${fullTitle}$2`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${fullTitle}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta property="og:image" content=")[^"]*"/, `$1${image}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${fullTitle}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta name="twitter:image" content=")[^"]*"/, `$1${image}"`)
}

/**
 * Generates a static index.html for every route with injected OG / Twitter Card
 * meta tags so crawlers receive per-page metadata without executing JavaScript.
 */
const run = () => {
  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const routes = discoverRoutes()

  routes.forEach(({ path, name, group, viewName }) => {
    const meta = viewsMeta[name]
    const description = meta?.description || DEFAULT_DESCRIPTION
    const url = `${SITE_URL}${path}`
    const image = resolveImage(group, viewName, meta?.image)
    const html = injectMeta(indexHtml, { title: name, description, url, image })
    const outDirectory = join(DIST, path)
    mkdirSync(outDirectory, { recursive: true })
    writeFileSync(join(outDirectory, 'index.html'), html)
    process.stdout.write(`  ✓ ${path}\n`)
  })

  process.stdout.write(`\nPre-rendered ${routes.length} routes\n`)
}

run()
