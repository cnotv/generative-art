import * as THREE from 'three'
import type { Waypoint } from '@webgamekit/logic'

const PATH_Y_OFFSET = 0.05
const DEFAULT_PATH_COLOR = 0xffffff
const DEFAULT_TUBE_RADIUS = 0.06

/**
 * Build a CatmullRom spline through the raw control waypoints and return the
 * interpolated point list.
 * @param waypoints - Raw control waypoints to interpolate
 * @returns Smooth set of waypoints along the CatmullRom curve
 */
export const pathInterpolateWaypoints = (waypoints: Waypoint[]): Waypoint[] => {
  if (waypoints.length < 2) return waypoints
  const vectors = waypoints.map(({ x, y, z }) => new THREE.Vector3(x, y, z))
  const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal')
  return curve.getPoints(waypoints.length * 2).map(({ x, y, z }) => ({ x, y, z }))
}

/**
 * Create a solid tube path through the waypoints and add it to the scene.
 * @param scene - The Three.js scene to add the path to
 * @param waypoints - Waypoints defining the path shape
 * @param color - Tube colour (default white)
 * @param tubeRadius - Tube cross-section radius (default 0.06)
 * @param closed - Close the loop back to the start (for looping paths)
 * @returns The created group containing the path tube mesh
 */
export const pathCreateVisualization = (
  scene: THREE.Scene,
  waypoints: Waypoint[],
  color: number = DEFAULT_PATH_COLOR,
  tubeRadius: number = DEFAULT_TUBE_RADIUS,
  closed: boolean = false
): THREE.Group => {
  const group = new THREE.Group()

  if (waypoints.length >= 2) {
    const vectors = waypoints.map(({ x, y, z }) => new THREE.Vector3(x, y + PATH_Y_OFFSET, z))
    const curve = new THREE.CatmullRomCurve3(vectors, closed, 'centripetal')
    const totalPoints = waypoints.length * 2
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
    group.userData.sharedMaterial = material
    const tubeGeo = new THREE.TubeGeometry(curve, totalPoints, tubeRadius, 6, closed)
    group.add(new THREE.Mesh(tubeGeo, material))
  }

  group.userData.isPathVisual = true
  scene.add(group)
  return group
}

/**
 * Create one straight tube per path segment (so duplicate/in-place nodes are safe,
 * unlike a single smoothed curve), all sharing one colour and grouped together.
 * @param scene - The Three.js scene to add the path to
 * @param waypoints - Ordered segment-endpoint waypoints
 * @param color - Tube colour (default white)
 * @param tubeRadius - Tube cross-section radius (default 0.06)
 * @param closed - Whether to add the closing segment back to the first waypoint
 * @returns The group containing the segment tubes
 */
export const pathCreateSteppedVisualization = (
  scene: THREE.Scene,
  waypoints: Waypoint[],
  color: number = DEFAULT_PATH_COLOR,
  tubeRadius: number = DEFAULT_TUBE_RADIUS,
  closed: boolean = false
): THREE.Group => {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
  group.userData.sharedMaterial = material
  const segmentCount = Math.max(0, closed ? waypoints.length : waypoints.length - 1)
  Array.from({ length: segmentCount }).forEach((_unused, index) => {
    const start = waypoints[index]
    const end = waypoints[(index + 1) % waypoints.length]
    const a = new THREE.Vector3(start.x, start.y + PATH_Y_OFFSET, start.z)
    const b = new THREE.Vector3(end.x, end.y + PATH_Y_OFFSET, end.z)
    if (a.distanceTo(b) < Number.EPSILON) return
    const tubeGeo = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, tubeRadius, 6, false)
    const mesh = new THREE.Mesh(tubeGeo, material)
    mesh.userData.isPathVisual = true
    group.add(mesh)
  })
  group.userData.isPathVisual = true
  scene.add(group)
  return group
}

/**
 * Remove a path visualisation group from the scene and dispose its GPU resources.
 * @param scene - The Three.js scene
 * @param group - The group returned by pathCreateVisualization
 */
export const pathRemoveVisualization = (scene: THREE.Scene, group: THREE.Group): void => {
  scene.remove(group)
  if (group.userData.sharedMaterial) {
    ;(group.userData.sharedMaterial as THREE.Material).dispose()
  }
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const material = child.material
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material.dispose()
    }
  })
}

/**
 * Create a small box mesh at the given waypoint position.
 * @param scene - The Three.js scene
 * @param waypoint - World position of the node
 * @param geo - Shared box geometry (caller owns lifecycle)
 * @param mat - Shared material (caller owns lifecycle)
 * @returns The created node mesh
 */
export const pathCreateWaypointNode = (
  scene: THREE.Scene,
  waypoint: Waypoint,
  geo: THREE.BufferGeometry,
  mat: THREE.Material
): THREE.Mesh => {
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(waypoint.x, waypoint.y, waypoint.z)
  mesh.userData.isPathVisual = true
  scene.add(mesh)
  return mesh
}

/**
 * Remove all waypoint node meshes from the scene.
 * The shared geometry and material are NOT disposed here.
 * @param scene - The Three.js scene
 * @param nodes - Array of node meshes to remove
 */
export const pathRemoveWaypointNodes = (scene: THREE.Scene, nodes: THREE.Mesh[]): void => {
  nodes.forEach((mesh) => scene.remove(mesh))
}

/**
 * Sync a node mesh position to a moved waypoint.
 * @param node - The node mesh to update
 * @param waypoint - New world position
 */
export const pathUpdateWaypointNodePosition = (node: THREE.Mesh, waypoint: Waypoint): void => {
  node.position.set(waypoint.x, waypoint.y, waypoint.z)
}
