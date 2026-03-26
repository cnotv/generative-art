import * as THREE from 'three';
import { logicGridToWorld, type GridConfig, type Position2D } from '@webgamekit/logic';
import { PATH_DOT_RADIUS, PATH_DOT_SEGMENTS, PATH_DOT_HEIGHT } from '../config';

const dotGeo = new THREE.SphereGeometry(PATH_DOT_RADIUS, PATH_DOT_SEGMENTS, PATH_DOT_SEGMENTS);

/**
 * Creates a path debug visualizer. Returns an updater function that renders
 * grid path waypoints as spheres when visible is true.
 */
export const createPathDebug = (
  scene: THREE.Scene,
  navGridConfig: GridConfig,
  color = 0x00ff88,
  yOffset = 0,
): ((path: Position2D[] | null, visible: boolean) => void) => {
  const group = new THREE.Group();
  group.name = 'PathDebug';
  scene.add(group);
  const mat = new THREE.MeshBasicMaterial({ color });
  const y = PATH_DOT_HEIGHT + yOffset;

  return (path: Position2D[] | null, visible: boolean): void => {
    group.clear();
    if (!visible || !path) return;
    path.forEach((wp) => {
      const [wx, , wz] = logicGridToWorld(wp.x, wp.z, navGridConfig);
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.position.set(wx, y, wz);
      group.add(dot);
    });
  };
};
