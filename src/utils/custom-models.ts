import * as THREE from 'three';

export const getBlade = (config: GenerateConfig) => {
  // Define the control points for the length curve (curvature along the length)
  // Vector values respectively: bend sides, blade silhouette, bend front 
  const lengthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.lengthCurve.baseX, config.lengthCurve.baseY, config.lengthCurve.baseZ),  // Base
    new THREE.Vector3(config.lengthCurve.midX, config.lengthCurve.midY, config.lengthCurve.midZ),  // Midpoint 1
    // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
    // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
    new THREE.Vector3(config.lengthCurve.tipX, config.lengthCurve.tipY, config.lengthCurve.tipZ)  // Tip
  ]);

  // Define the control points for the side curve (curvature on the sides)
  // Vector values respectively: Width blade
  const sideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.sideCurve.baseX, config.sideCurve.baseY, config.sideCurve.baseZ),  // Base
    new THREE.Vector3(config.sideCurve.midX, config.sideCurve.midY, config.sideCurve.midZ),  // Midpoint 1
    // new THREE.Vector3(0.03, 0.5, 0),  // Midpoint 2
    // new THREE.Vector3(0.02, 0.75, 0),  // Midpoint 3
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
    color: 0x33bb33,
    side: THREE.DoubleSide,
  });

  // Create the mesh for the grass blade
  const blade = new THREE.Mesh(geometry, material);
  blade.castShadow = false;
  blade.receiveShadow = true;

  return blade;
};
