import { readdirSync, statSync } from 'node:fs'
import { join, extname, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const VIEWS_DIR = join(ROOT, 'src/views')
export const GROUPS = ['Experiments', 'Games', 'Generative', 'Tools', 'Stages']

// The Open Graph image of a route, written by `scripts/capture.mjs` into public/. Mirrored by
// `ogImage` in src/router/index.ts for the client-side meta.
export const ogImage = (routePath) => `/og${routePath}.jpg`
export const DEFAULT_OG_IMAGE = ogImage('/experiments/LandingPage')

// Kept in sync with `deriveRouteName` in src/config/router.ts, which derives the same names
// at runtime for the client-side page title and meta. Node has no TypeScript runner here, so
// the two can't share one module without adding a dependency.
export const toRouteName = (dirName) =>
  dirName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // word boundary: lowercase to uppercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // acronym followed by a capitalized word
    .replace(/([A-Za-z])(\d+)/g, '$1 $2') // letter to digit
    .replace(/(\d+)([A-Z])/g, '$1 $2') // digit to letter
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

/**
 * Discovers all view routes by scanning the views directory tree.
 * @returns Array of route descriptors with path, name, group and viewName.
 */
export const discoverRoutes = () =>
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
      return [
        {
          path: `/${group.toLowerCase()}/${viewName}`,
          name: toRouteName(viewName),
          group,
          viewName
        }
      ]
    })
  })
