import { readdirSync, statSync } from 'node:fs'
import { join, extname, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const VIEWS_DIR = join(ROOT, 'src/views')
export const GROUPS = ['Experiments', 'Games', 'Generative', 'Tools', 'Stages']

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
