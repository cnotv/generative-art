export const getRoutes = (views: Record<string, () => Promise<unknown>>, dir: string) => {
  return Object.keys(views).map((key) => {
      // Remove the leading '/src/views/' and the file extension to get the path
      const componentName = key.replace(new RegExp(`^/src/views/${dir}/(.*)\\.\\w+$`), '$1')
      const isIndex = componentName.endsWith('/index');
      const cleanName = isIndex ? componentName.replace('/index', '') : componentName;
      // Split segments
      const segments = cleanName.split('/');
      // If more than one segment and not a repetition, skip
      if (segments.length > 1 && segments[0] !== segments[1]) {
        return null;
      }
      // If repetition (e.g., GoombaRunner/GoombaRunner), use only one for name/path
      const baseName = segments[0];

    // Convert route name to a more readable title
    // e.g., "GoombaRunner" -> "Goomba Runner" or "CubeMatrix" -> "Cube Matrix"
    const name = baseName
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .trim() // Remove leading space
      .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
    
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
  ...getRoutes(import.meta.glob(`/src/views/Stages/**/*.vue`), 'Stages'),
]
