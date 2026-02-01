import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat';
import { getPhysic, type CoordinateTuple, type ComplexModel } from '@webgamekit/threejs';

// Local type for blade generation config
interface GenerateConfig {
  lengthCurve: {
    baseX: number; baseY: number; baseZ: number;
    midX: number; midY: number; midZ: number;
    tipX: number; tipY: number; tipZ: number;
  };
  sideCurve: {
    baseX: number; baseY: number; baseZ: number;
    midX: number; midY: number; midZ: number;
    tipX: number; tipY: number; tipZ: number;
  };
}

export const getBlade = (config: GenerateConfig) => {
  // Define the control points for the length curve (curvature along the length)
  // Vector values respectively: bend sides, blade silhouette, bend front 
  const lengthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.lengthCurve.baseX, config.lengthCurve.baseY, config.lengthCurve.baseZ),  // Base
    new THREE.Vector3(config.lengthCurve.midX, config.lengthCurve.midY, config.lengthCurve.midZ),  // Midpoint 1
    new THREE.Vector3(config.lengthCurve.tipX, config.lengthCurve.tipY, config.lengthCurve.tipZ)  // Tip
  ]);

  // Define the control points for the side curve (curvature on the sides)
  // Vector values respectively: Width blade
  const sideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.sideCurve.baseX, config.sideCurve.baseY, config.sideCurve.baseZ),  // Base
    new THREE.Vector3(config.sideCurve.midX, config.sideCurve.midY, config.sideCurve.midZ),  // Midpoint 1
    new THREE.Vector3(config.sideCurve.tipX, config.sideCurve.tipY, config.sideCurve.tipZ)  // Tip
  ]);

  // Define the control points for the length curve (curvature along the length)
  const lengthPoints = lengthCurve.getPoints(10);

  // Define the control points for the side curve (curvature on the sides)
  const sidePoints = sideCurve.getPoints(10);

  // Define the vertices for the grass blade
  const vertices = [];
  for (let i = 0; i < lengthPoints.length; i++) {
    const lengthPoint = lengthPoints[i];
    const sidePoint = sidePoints[i];
    vertices.push(lengthPoint.x - sidePoint.x, lengthPoint.y, lengthPoint.z);
    vertices.push(lengthPoint.x + sidePoint.x, lengthPoint.y, lengthPoint.z);
  }

  // Define the indices for the triangular faces
  const indices = [];
  for (let i = 0; i < lengthPoints.length - 1; i++) {
    const baseIndex = i * 2;
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
  }

  // Define the geometry for the grass blade
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Define the material for the grass blade
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x33_bb_33,
    side: THREE.DoubleSide,
  });

  // Create the mesh for the grass blade
  const blade = new THREE.Mesh(geometry, material);
  blade.castShadow = false;
  blade.receiveShadow = true;

  return blade;
};

/**
  * Create a rounded box geometry
  * @param {CoordinateTuple} size - The size of the box
  * @param {number} radius - The radius of the box
  * @param {number} smoothness - The smoothness of the box
  * @returns {THREE.ExtrudeGeometry} The rounded box geometry
*/
export const getRoundedBox = (size: CoordinateTuple, radius: number, smoothness: number) => {
  const [width, height, depth] = size;
  const shape = new THREE.Shape();
  const eps = 0.000_01;
  const radius0 = radius - eps;
  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
  shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true);
  shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true);
  shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: smoothness * 2,
    steps: 1,
    bevelSize: radius0,
    bevelThickness: radius,
    curveSegments: smoothness
  });
  geometry.center();
  return geometry;
};

export const getCoinBlock = (
  scene: THREE.Scene,
  world: RAPIER.World,
  { position = [1, 1, 1] }: { position: CoordinateTuple }
): ComplexModel => {
  const color = 0xff_ff_00
  const size: CoordinateTuple = [1.25, 1.25, 1.25]
  const material = new THREE.MeshPhysicalMaterial({ color })
  const geometry = new THREE.CylinderGeometry(10, 10, 1, 32)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  scene.add(mesh)
  const initialValues = { position, size, color, rotation: mesh.rotation.toArray() as CoordinateTuple }
  mesh.rotation.x = Math.PI / 2

  const { rigidBody, collider } = getPhysic(world, { position, size, boundary: 0.8, type: 'kinematicPositionBased' })
  rigidBody.setRotation({ x: Math.PI / 2, y: 0, z: 0, w: 1 }, true)

  return { mesh, rigidBody, collider, initialValues }
}
