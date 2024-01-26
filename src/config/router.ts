const views = import.meta.glob('/src/views/Projects/**/*.vue')

export const routes = Object.keys(views).map((key, i) => {
  // Remove the leading '/src/views/' and the file extension to get the path
  const component = key.replace(/^\/src\/views\/Projects\/(.*)\.\w+$/, '$1')

  // Use the path as the name and component
  return {
    path: `/${i + 1}`,
    name: component,
    component: views[key]
  }
})