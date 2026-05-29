import * as THREE from 'three'

const STROKE_COLOR = 0x333333
const STROKE_SCALE = 1.05
const STROKE_MATERIAL = new THREE.MeshBasicMaterial({ color: STROKE_COLOR, side: THREE.BackSide })
const EDGE_THRESHOLD_ANGLE = 15
const EDGE_LINE_WIDTH = 2

export const attachBallStroke = (mesh: THREE.Mesh): void => {
  const hull = new THREE.Mesh(mesh.geometry, STROKE_MATERIAL)
  hull.scale.setScalar(STROKE_SCALE)
  hull.userData.skipEdgeLines = true
  mesh.add(hull)
}

const isSolidMesh = (object: THREE.Object3D): object is THREE.Mesh => {
  if (!(object instanceof THREE.Mesh)) return false
  if (object.userData.skipEdgeLines) return false
  if (object.userData.hasEdgeLines) return false
  const mat = Array.isArray(object.material) ? object.material[0] : object.material
  return !(mat instanceof THREE.Material && mat.transparent)
}

const attachEdgeLines = async (mesh: THREE.Mesh): Promise<void> => {
  mesh.userData.hasEdgeLines = true
  const [{ LineMaterial }, { LineSegments2 }, { LineSegmentsGeometry }] = await Promise.all([
    import('three/examples/jsm/lines/LineMaterial.js'),
    import('three/examples/jsm/lines/LineSegments2.js'),
    import('three/examples/jsm/lines/LineSegmentsGeometry.js')
  ])
  const edges = new THREE.EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_ANGLE)
  const geometry = new LineSegmentsGeometry().fromEdgesGeometry(edges)
  const material = new LineMaterial({
    color: STROKE_COLOR,
    linewidth: EDGE_LINE_WIDTH,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
  })
  const lines = new LineSegments2(geometry, material)
  lines.userData.skipEdgeLines = true
  mesh.add(lines)
}

export const addEdgeLinesToScene = (scene: THREE.Scene): void => {
  scene.traverse((object) => {
    if (isSolidMesh(object)) attachEdgeLines(object)
  })
}
