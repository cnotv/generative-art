import * as THREE from "three";
import type { Waypoint } from "@webgamekit/logic";
import { PATH_LINE_COLOR, PATH_TUBE_RADIUS } from "../config";

const NODE_Y = 0.4;

const PATH_Y_OFFSET = 0.05;

/**
 * Build a CatmullRom spline through the raw control waypoints and return the
 * interpolated point list at the requested resolution.
 */
export const drawInterpolateWaypoints = (
  waypoints: Waypoint[],
  steps: number
): Waypoint[] => {
  if (waypoints.length < 2) return waypoints;
  const vectors = waypoints.map(({ x, y, z }) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, false, "centripetal");
  return curve
    .getPoints(Math.max(steps, waypoints.length * 2))
    .map(({ x, y, z }) => ({ x, y, z }));
};

/** Create a solid tube path through the waypoints. */
export const drawCreatePathVisualization = (
  scene: THREE.Scene,
  waypoints: Waypoint[],
  steps: number,
  color: number = PATH_LINE_COLOR
): THREE.Group => {
  const group = new THREE.Group();

  if (waypoints.length >= 2) {
    const vectors = waypoints.map(
      ({ x, y, z }) => new THREE.Vector3(x, y + PATH_Y_OFFSET, z)
    );
    const curve = new THREE.CatmullRomCurve3(vectors, false, "centripetal");
    const totalPoints = Math.max(steps, waypoints.length * 2);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    });
    group.userData.sharedMaterial = material;
    const tubeGeo = new THREE.TubeGeometry(curve, totalPoints, PATH_TUBE_RADIUS, 6, false);
    group.add(new THREE.Mesh(tubeGeo, material));
  }

  scene.add(group);
  return group;
};

/** Create a small cube mesh at the given waypoint position. Uses shared geo/mat. */
export const drawCreateWaypointNode = (
  scene: THREE.Scene,
  waypoint: Waypoint,
  geo: THREE.BufferGeometry,
  mat: THREE.Material
): THREE.Mesh => {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(waypoint.x, NODE_Y, waypoint.z);
  scene.add(mesh);
  return mesh;
};

/** Remove all node meshes from scene (shared geo/mat are NOT disposed here). */
export const drawRemoveWaypointNodes = (
  scene: THREE.Scene,
  nodes: THREE.Mesh[]
): void => {
  nodes.forEach((mesh) => scene.remove(mesh));
};

/** Update the world position of a single node mesh to match a moved waypoint. */
export const drawUpdateWaypointNodePosition = (
  node: THREE.Mesh,
  waypoint: Waypoint
): void => {
  node.position.set(waypoint.x, NODE_Y, waypoint.z);
};

export const drawRemovePathVisualization = (
  scene: THREE.Scene,
  group: THREE.Group
): void => {
  scene.remove(group);
  if (group.userData.sharedMaterial) {
    (group.userData.sharedMaterial as THREE.Material).dispose();
  }
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
};
