export const getRoutes = (views: Record<string, () => Promise<unknown>>, dir: string) => {
  return Object.keys(views).map((key) => {
    // Remove the leading '/src/views/' and the file extension to get the path
    const componentName = key.replace(new RegExp(`^/src/views/${dir}/(.*)\\.\\w+$`), '$1')
    const isIndex = componentName.endsWith('/index');
    const cleanName = isIndex ? componentName.replace('/index', '') : componentName;

    return {
      path: `/${dir.toLowerCase()}/${cleanName}`,
      name: cleanName,
      component: views[key]
    }
  })
}

export const generatedRoutes = [
  ...getRoutes(import.meta.glob(`/src/views/Generator/**/*.vue`), 'Generator'),
  ...getRoutes(import.meta.glob(`/src/views/Generative/**/*.vue`), 'Generative'),
  ...getRoutes(import.meta.glob(`/src/views/Games/**/*.vue`), 'Games'),
  ...getRoutes(import.meta.glob(`/src/views/Experiments/**/*.vue`), 'Experiments'),
  ...getRoutes(import.meta.glob(`/src/views/Stages/**/*.vue`), 'Stages'),
]
