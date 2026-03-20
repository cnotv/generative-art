import * as THREE from 'three';
import type { HeightSampler } from './types';

const BLADE_POINTS = 10;
const DEFAULT_BLADE_SCALE = 2;

const BASE_LENGTH_CURVE_POINTS = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0.28, 0.04),
  new THREE.Vector3(0, 0.5, -0.07),
];

const BASE_SIDE_CURVE_POINTS = [
  new THREE.Vector3(0.04, 0, 0),
  new THREE.Vector3(0.04, 0, 0),
  new THREE.Vector3(0, 0.5, 0),
];

/**
 * Simple seeded random number generator (mulberry32).
 */
const createSeededRandom = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let intermediate = Math.imul(state ^ (state >>> 15), 1 | state);
    intermediate = (intermediate + Math.imul(intermediate ^ (intermediate >>> 7), 61 | intermediate)) ^ intermediate;
    return ((intermediate ^ (intermediate >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Creates the shared grass blade BufferGeometry using CatmullRom curves,
 * matching the GrassGenerator tool's blade shape.
 */
export const createGrassBladeGeometry = (bladeScale = DEFAULT_BLADE_SCALE): THREE.BufferGeometry => {
  const scaledLengthPoints = BASE_LENGTH_CURVE_POINTS.map(v => v.clone().multiplyScalar(bladeScale));
  const scaledSidePoints = BASE_SIDE_CURVE_POINTS.map(v => v.clone().multiplyScalar(bladeScale));
  const lengthCurve = new THREE.CatmullRomCurve3(scaledLengthPoints);
  const sideCurve = new THREE.CatmullRomCurve3(scaledSidePoints);

  const lengthPoints = lengthCurve.getPoints(BLADE_POINTS);
  const sidePoints = sideCurve.getPoints(BLADE_POINTS);

  const vertices = lengthPoints.flatMap((lengthPoint, index) => {
    const sidePoint = sidePoints[index];
    return [
      lengthPoint.x - sidePoint.x, lengthPoint.y, lengthPoint.z,
      lengthPoint.x + sidePoint.x, lengthPoint.y, lengthPoint.z,
    ];
  });

  const indices = Array.from({ length: lengthPoints.length - 1 }, (_, segmentIndex) => {
    const baseVertex = segmentIndex * 2;
    return [
      baseVertex, baseVertex + 1, baseVertex + 2,
      baseVertex + 1, baseVertex + 3, baseVertex + 2,
    ];
  }).flat();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
};

/**
 * Creates the shared grass material.
 */
export const createGrassMaterial = (color = 0x33bb33): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({
    color,
    side: THREE.DoubleSide,
  });

/**
 * Creates an InstancedMesh of grass blades for a single chunk.
 * Uses shared geometry and material; only instance transforms differ per chunk.
 */
export const createGrassChunk = (
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  grassPerChunk: number,
  sharedGeometry: THREE.BufferGeometry,
  sharedMaterial: THREE.Material,
  heightSampler?: HeightSampler,
): THREE.InstancedMesh => {
  const instancedMesh = new THREE.InstancedMesh(
    sharedGeometry,
    sharedMaterial,
    grassPerChunk
  );
  instancedMesh.name = `grass-${chunkX},${chunkZ}`;

  const chunkSeed = (chunkX * 73856093) ^ (chunkZ * 19349663) ^ 0xdeadbeef;
  const random = createSeededRandom(chunkSeed);

  const worldOffsetX = chunkX * chunkSize;
  const worldOffsetZ = chunkZ * chunkSize;
  const transformMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const rotationEuler = new THREE.Euler();

  Array.from({ length: grassPerChunk }).forEach((_, instanceIndex) => {
    const positionX = worldOffsetX + (random() - 0.5) * chunkSize;
    const positionZ = worldOffsetZ + (random() - 0.5) * chunkSize;
    const yRotation = random() * Math.PI * 2;
    const scaleVariation = 0.6 + random() * 0.8;

    const terrainY = heightSampler ? heightSampler(positionX, positionZ) : 0;
    position.set(positionX, terrainY, positionZ);
    rotationEuler.set(0, yRotation, 0);
    quaternion.setFromEuler(rotationEuler);
    scale.set(scaleVariation, scaleVariation, scaleVariation);

    transformMatrix.compose(position, quaternion, scale);
    instancedMesh.setMatrixAt(instanceIndex, transformMatrix);
  });

  instancedMesh.instanceMatrix.needsUpdate = true;

  return instancedMesh;
};
