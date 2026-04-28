import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const VIEWS_DIR = join(ROOT, 'src/views')

const SITE_URL = process.env.SITE_URL || 'https://cnotv.xyz'
const DEFAULT_DESCRIPTION =
  'Interactive generative art, 3D experiments, and games built with Three.js and Vue.'
const SITE_TITLE = 'Generative Art'
const GROUPS = ['Experiments', 'Games', 'Generative', 'Tools', 'Stages']

const viewsMeta = JSON.parse(readFileSync(join(ROOT, 'src/config/viewsMeta.json'), 'utf-8'))

const toRouteName = (dirName) =>
  dirName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())

const resolveViewName = (groupDirectory, entry) => {
  if (entry.isFile() && extname(entry.name) === '.vue') return basename(entry.name, '.vue')
  if (!entry.isDirectory()) return null
  const namedFile = join(groupDirectory, entry.name, `${entry.name}.vue`)
  const indexFile = join(groupDirectory, entry.name, 'index.vue')
  try {
    statSync(namedFile)
    return entry.name
  } catch {
    try {
      statSync(indexFile)
      return entry.name
    } catch {
      return null
    }
  }
}

const discoverRoutes = () =>
  GROUPS.flatMap((group) => {
    const groupDirectory = join(VIEWS_DIR, group)
    try {
      statSync(groupDirectory)
    } catch {
      return []
    }
    return readdirSync(groupDirectory, { withFileTypes: true }).flatMap((entry) => {
      const viewName = resolveViewName(groupDirectory, entry)
      if (!viewName) return []
      return [{ path: `/${group.toLowerCase()}/${viewName}`, name: toRouteName(viewName) }]
    })
  })

const injectMeta = (html, { title, description, url, image }) => {
  const fullTitle = `${title} | ${SITE_TITLE}`
  const img = image || `${SITE_URL}/logobw.svg`
  return html
    .replace(/(<title>)[^<]*(<\/title>)/, `$1${fullTitle}$2`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${fullTitle}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta property="og:image" content=")[^"]*"/, `$1${img}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${fullTitle}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta name="twitter:image" content=")[^"]*"/, `$1${img}"`)
}

const run = () => {
  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const routes = discoverRoutes()

  routes.forEach(({ path, name }) => {
    const meta = viewsMeta[name]
    const description = meta?.description || DEFAULT_DESCRIPTION
    const url = `${SITE_URL}${path}`
    const html = injectMeta(indexHtml, { title: name, description, url, image: meta?.image })
    const outDirectory = join(DIST, path)
    mkdirSync(outDirectory, { recursive: true })
    writeFileSync(join(outDirectory, 'index.html'), html)
    process.stdout.write(`  ✓ ${path}\n`)
  })

  process.stdout.write(`\nPre-rendered ${routes.length} routes\n`)
}

run()
