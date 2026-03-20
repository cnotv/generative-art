import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createElementsChunk } from './elementGenerator';

const CHUNK_SIZE = 32;
const ELEMENTS_PER_CHUNK = 8;

describe('createElementsChunk', () => {
  describe('group properties', () => {
    it.each([
      { chunkX: 0, chunkZ: 0 },
      { chunkX: 2, chunkZ: -1 },
      { chunkX: -4, chunkZ: 3 },
    ])('creates a named group for chunk ($chunkX, $chunkZ)', ({ chunkX, chunkZ }) => {
      const group = createElementsChunk(chunkX, chunkZ, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.name).toBe(`elements-${chunkX},${chunkZ}`);
    });

    it('creates the correct number of child meshes', () => {
      const group = createElementsChunk(0, 0, CHUNK_SIZE, ELEMENTS_PER_CHUNK);
      expect(group.children).toHaveLength(ELEMENTS_PER_CHUNK);
    });

    it.each([0, 1, 20])('handles elementsPerChunk = %i', (count) => {
      const group = createElementsChunk(0, 0, CHUNK_SIZE, count);
      expect(group.children).toHaveLength(count);
    });
  });

  describe('element positions', () => {
    it('places elements within chunk world-space bounds', () => {
      const chunkX = 2;
      const chunkZ = 3;
      const worldOffsetX = chunkX * CHUNK_SIZE;
      const worldOffsetZ = chunkZ * CHUNK_SIZE;
      const halfChunk = CHUNK_SIZE / 2;

      const group = createElementsChunk(chunkX, chunkZ, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      group.children.forEach((child) => {
        expect(child.position.x).toBeGreaterThanOrEqual(worldOffsetX - halfChunk);
        expect(child.position.x).toBeLessThanOrEqual(worldOffsetX + halfChunk);
        expect(child.position.z).toBeGreaterThanOrEqual(worldOffsetZ - halfChunk);
        expect(child.position.z).toBeLessThanOrEqual(worldOffsetZ + halfChunk);
      });
    });

    it('positions elements above ground (positive Y)', () => {
      const group = createElementsChunk(0, 0, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      group.children.forEach((child) => {
        expect(child.position.y).toBeGreaterThan(0);
      });
    });
  });

  describe('element geometry', () => {
    it('creates only BoxGeometry or ConeGeometry meshes', () => {
      const group = createElementsChunk(0, 0, CHUNK_SIZE, 50);

      group.children.forEach((child) => {
        expect(child).toBeInstanceOf(THREE.Mesh);
        const mesh = child as THREE.Mesh;
        const isCone = mesh.geometry instanceof THREE.ConeGeometry;
        const isBox = mesh.geometry instanceof THREE.BoxGeometry;
        expect(isCone || isBox).toBe(true);
      });
    });

    it('uses MeshStandardMaterial with flat shading', () => {
      const group = createElementsChunk(0, 0, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      group.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(material.flatShading).toBe(true);
      });
    });

    it('enables cast and receive shadow on all elements', () => {
      const group = createElementsChunk(0, 0, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      group.children.forEach((child) => {
        expect(child.castShadow).toBe(true);
        expect(child.receiveShadow).toBe(true);
      });
    });
  });

  describe('determinism', () => {
    it('produces identical groups for the same chunk coordinates', () => {
      const groupA = createElementsChunk(1, 2, CHUNK_SIZE, ELEMENTS_PER_CHUNK);
      const groupB = createElementsChunk(1, 2, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      groupA.children.forEach((childA, index) => {
        const childB = groupB.children[index];
        expect(childA.position.x).toBe(childB.position.x);
        expect(childA.position.y).toBe(childB.position.y);
        expect(childA.position.z).toBe(childB.position.z);
      });
    });

    it('produces different groups for different chunk coordinates', () => {
      const groupA = createElementsChunk(0, 0, CHUNK_SIZE, ELEMENTS_PER_CHUNK);
      const groupB = createElementsChunk(5, 5, CHUNK_SIZE, ELEMENTS_PER_CHUNK);

      const hasDifference = groupA.children.some((childA, index) => {
        const childB = groupB.children[index];
        return childA.position.x !== childB.position.x || childA.position.z !== childB.position.z;
      });
      expect(hasDifference).toBe(true);
    });
  });
});
