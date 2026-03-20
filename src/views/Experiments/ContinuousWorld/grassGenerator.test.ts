import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createGrassBladeGeometry,
  createGrassMaterial,
  createGrassChunk,
} from './grassGenerator';

const CHUNK_SIZE = 32;
const GRASS_PER_CHUNK = 300;

describe('createGrassBladeGeometry', () => {
  it('returns a BufferGeometry with position attribute', () => {
    const geometry = createGrassBladeGeometry();

    expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(geometry.getAttribute('position')).toBeDefined();
  });

  it('creates 22 vertices (11 rows × 2 per row from getPoints(10))', () => {
    const geometry = createGrassBladeGeometry();
    const positionAttribute = geometry.getAttribute('position');

    // getPoints(10) returns 11 points → 11 rows × 2 vertices = 22
    expect(positionAttribute.count).toBe(22);
  });

  it('has an index buffer for triangles', () => {
    const geometry = createGrassBladeGeometry();
    const index = geometry.getIndex();

    expect(index).not.toBeNull();
    // 10 segments × 2 triangles × 3 indices = 60
    expect(index!.count).toBe(60);
  });

  it('tapers from base to tip (narrower at top)', () => {
    const geometry = createGrassBladeGeometry();
    const positionAttribute = geometry.getAttribute('position');

    // Base vertices (index 0, 1) should be wider than tip vertices (index 20, 21)
    const baseWidth = Math.abs(positionAttribute.getX(0) - positionAttribute.getX(1));
    const tipWidth = Math.abs(positionAttribute.getX(20) - positionAttribute.getX(21));

    expect(baseWidth).toBeGreaterThan(tipWidth);
  });

  it('starts at Y=0 and grows upward', () => {
    const geometry = createGrassBladeGeometry();
    const positionAttribute = geometry.getAttribute('position');

    // Base Y
    expect(positionAttribute.getY(0)).toBe(0);
    // Tip Y (last row, vertex index 20)
    expect(positionAttribute.getY(20)).toBeGreaterThan(0);
  });
});

describe('createGrassMaterial', () => {
  it('returns a MeshPhysicalMaterial', () => {
    const material = createGrassMaterial();
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
  });

  it('uses double-sided rendering', () => {
    const material = createGrassMaterial();
    expect(material.side).toBe(THREE.DoubleSide);
  });
});

describe('createGrassChunk', () => {
  const createSharedResources = () => ({
    geometry: createGrassBladeGeometry(),
    material: createGrassMaterial(),
  });

  describe('instanced mesh properties', () => {
    it.each([
      { chunkX: 0, chunkZ: 0 },
      { chunkX: 2, chunkZ: -1 },
      { chunkX: -4, chunkZ: 3 },
    ])('creates a named InstancedMesh for chunk ($chunkX, $chunkZ)', ({ chunkX, chunkZ }) => {
      const { geometry, material } = createSharedResources();
      const mesh = createGrassChunk(chunkX, chunkZ, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      expect(mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(mesh.name).toBe(`grass-${chunkX},${chunkZ}`);
    });

    it('creates the correct number of instances', () => {
      const { geometry, material } = createSharedResources();
      const mesh = createGrassChunk(0, 0, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      expect(mesh.count).toBe(GRASS_PER_CHUNK);
    });

    it('uses shared geometry and material references', () => {
      const { geometry, material } = createSharedResources();
      const mesh = createGrassChunk(0, 0, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(material);
    });
  });

  describe('instance transforms', () => {
    it('places instances within chunk world-space bounds', () => {
      const chunkX = 2;
      const chunkZ = 3;
      const worldOffsetX = chunkX * CHUNK_SIZE;
      const worldOffsetZ = chunkZ * CHUNK_SIZE;
      const halfChunk = CHUNK_SIZE / 2;

      const { geometry, material } = createSharedResources();
      const mesh = createGrassChunk(chunkX, chunkZ, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      const instanceMatrix = new THREE.Matrix4();
      const instancePosition = new THREE.Vector3();

      Array.from({ length: GRASS_PER_CHUNK }).forEach((_, index) => {
        mesh.getMatrixAt(index, instanceMatrix);
        instancePosition.setFromMatrixPosition(instanceMatrix);

        expect(instancePosition.x).toBeGreaterThanOrEqual(worldOffsetX - halfChunk);
        expect(instancePosition.x).toBeLessThanOrEqual(worldOffsetX + halfChunk);
        expect(instancePosition.y).toBe(0);
        expect(instancePosition.z).toBeGreaterThanOrEqual(worldOffsetZ - halfChunk);
        expect(instancePosition.z).toBeLessThanOrEqual(worldOffsetZ + halfChunk);
      });
    });

    it('applies scale variation to instances', () => {
      const { geometry, material } = createSharedResources();
      const mesh = createGrassChunk(0, 0, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      const instanceMatrix = new THREE.Matrix4();
      const instanceScale = new THREE.Vector3();
      const scales = new Set<string>();

      Array.from({ length: Math.min(50, GRASS_PER_CHUNK) }).forEach((_, index) => {
        mesh.getMatrixAt(index, instanceMatrix);
        instanceScale.setFromMatrixScale(instanceMatrix);
        scales.add(instanceScale.x.toFixed(4));
      });

      expect(scales.size).toBeGreaterThan(1);
    });
  });

  describe('determinism', () => {
    it('produces identical instance matrices for the same chunk coordinates', () => {
      const { geometry, material } = createSharedResources();
      const meshA = createGrassChunk(1, 2, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);
      const meshB = createGrassChunk(1, 2, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      const matrixA = new THREE.Matrix4();
      const matrixB = new THREE.Matrix4();

      Array.from({ length: GRASS_PER_CHUNK }).forEach((_, index) => {
        meshA.getMatrixAt(index, matrixA);
        meshB.getMatrixAt(index, matrixB);
        expect(matrixA.elements).toEqual(matrixB.elements);
      });
    });

    it('produces different instance matrices for different chunk coordinates', () => {
      const { geometry, material } = createSharedResources();
      const meshA = createGrassChunk(0, 0, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);
      const meshB = createGrassChunk(5, 5, CHUNK_SIZE, GRASS_PER_CHUNK, geometry, material);

      const matrixA = new THREE.Matrix4();
      const matrixB = new THREE.Matrix4();
      meshA.getMatrixAt(0, matrixA);
      meshB.getMatrixAt(0, matrixB);

      expect(matrixA.elements).not.toEqual(matrixB.elements);
    });
  });
});
