import * as THREE from 'three'
import { logicGridToWorld, type GridConfig, type Position2D } from '@webgamekit/logic'
import { PATH_DOT_RADIUS, PATH_DOT_SEGMENTS, PATH_DOT_HEIGHT } from '../config'

const dotGeo = new THREE.SphereGeometry(PATH_DOT_RADIUS, PATH_DOT_SEGMENTS, PATH_DOT_SEGMENTS)

export type PathEntry = { path: Position2D[] | null; color: number; yOffset?: number }

/**
 * Creates a single path debug visualizer for multiple paths.
 * Returns an updater that renders all path waypoints as colored spheres.
 */
export const createPathDebug = (
  scene: THREE.Scene,
  navGridConfig: GridConfig
): ((entries: PathEntry[], visible: boolean) => void) => {
  const group = new THREE.Group()
  group.name = 'PathDebug'
  scene.add(group)

  return (entries: PathEntry[], visible: boolean): void => {
    group.clear()
    if (!visible) return
    entries.forEach(({ path, color, yOffset = 0 }) => {
      if (!path) return
      const mat = new THREE.MeshBasicMaterial({ color })
      const y = PATH_DOT_HEIGHT + yOffset
      path.forEach((wp) => {
        const [wx, , wz] = logicGridToWorld(wp.x, wp.z, navGridConfig)
        const dot = new THREE.Mesh(dotGeo, mat)
        dot.position.set(wx, y, wz)
        group.add(dot)
      })
    })
  }
}
