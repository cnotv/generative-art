// Kept in sync with `toRouteName` in scripts/routes.mjs, which derives the same names at
// build time for the prerendered SEO meta tags. Node has no TypeScript runner here, so the
// two can't share one module without adding a dependency.
export const deriveRouteName = (baseName: string): string =>
  baseName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // word boundary: lowercase to uppercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // acronym followed by a capitalized word
    .replace(/([A-Za-z])(\d+)/g, '$1 $2') // letter to digit
    .replace(/(\d+)([A-Z])/g, '$1 $2') // digit to letter
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())

export const getRoutes = (views: Record<string, () => Promise<unknown>>, dir: string) => {
  return Object.keys(views)
    .map((key) => {
      // Remove the leading '/src/views/' and the file extension to get the path
      const componentName = key.replace(new RegExp(`^/src/views/${dir}/(.*)\\.\\w+$`), '$1')
      const isIndex = componentName.endsWith('/index')
      const cleanName = isIndex ? componentName.replace('/index', '') : componentName
      // Split segments
      const segments = cleanName.split('/')
      // If more than one segment and not a repetition, skip
      if (segments.length > 1 && segments[0] !== segments[1]) {
        return null
      }
      // If repetition (e.g., GoombaRunner/GoombaRunner), use only one for name/path
      const baseName = segments[0]

      const name = deriveRouteName(baseName)

      return {
        path: `/${dir.toLowerCase()}/${baseName}`,
        name,
        group: dir,
        component: views[key]
      }
    })
    .filter(Boolean)
}

export const generatedRoutes = [
  ...getRoutes(import.meta.glob(`/src/views/Tools/**/*.vue`), 'Tools'),
  ...getRoutes(import.meta.glob(`/src/views/Generative/**/*.vue`), 'Generative'),
  ...getRoutes(import.meta.glob(`/src/views/Games/**/*.vue`), 'Games'),
  ...getRoutes(import.meta.glob(`/src/views/Experiments/**/*.vue`), 'Experiments'),
  ...getRoutes(import.meta.glob(`/src/views/Tests/**/*.vue`), 'Tests'),
  ...getRoutes(import.meta.glob(`/src/views/Stages/**/*.vue`), 'Stages')
]
