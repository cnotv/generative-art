import * as THREE from 'three';
import type { HeightSampler } from './types';

import illustrationTree11Img from '@/assets/images/illustrations/Tree1-1.webp';
import illustrationTree12Img from '@/assets/images/illustrations/Tree1-2.webp';
import illustrationTree13Img from '@/assets/images/illustrations/Tree1-3.webp';
import illustrationTree14Img from '@/assets/images/illustrations/Tree1-4.webp';
import illustrationTree15Img from '@/assets/images/illustrations/Tree1-5.webp';
import illustrationTree16Img from '@/assets/images/illustrations/Tree1-6.webp';
import illustrationTree17Img from '@/assets/images/illustrations/Tree1-7.webp';
import illustrationTree18Img from '@/assets/images/illustrations/Tree1-8.webp';
import illustrationTree19Img from '@/assets/images/illustrations/Tree1-9.webp';
import illustrationTree21Img from '@/assets/images/illustrations/Tree2-1.webp';
import illustrationTree22Img from '@/assets/images/illustrations/Tree2-2.webp';
import illustrationTree23Img from '@/assets/images/illustrations/Tree2-3.webp';
import illustrationTree24Img from '@/assets/images/illustrations/Tree2-4.webp';
import illustrationTree25Img from '@/assets/images/illustrations/Tree2-5.webp';
import illustrationTree26Img from '@/assets/images/illustrations/Tree2-6.webp';
import illustrationBush11Img from '@/assets/images/illustrations/Bush1-1.webp';
import illustrationBush12Img from '@/assets/images/illustrations/Bush1-2.webp';
import illustrationRockImg from '@/assets/images/illustrations/Rock.webp';

const allTextures = [
  { url: illustrationTree11Img, width: 20, height: 35 },
  { url: illustrationTree12Img, width: 20, height: 35 },
  { url: illustrationTree13Img, width: 20, height: 35 },
  { url: illustrationTree14Img, width: 20, height: 35 },
  { url: illustrationTree15Img, width: 20, height: 35 },
  { url: illustrationTree16Img, width: 20, height: 35 },
  { url: illustrationTree17Img, width: 20, height: 35 },
  { url: illustrationTree18Img, width: 20, height: 35 },
  { url: illustrationTree19Img, width: 20, height: 35 },
  { url: illustrationTree21Img, width: 15, height: 30 },
  { url: illustrationTree22Img, width: 15, height: 30 },
  { url: illustrationTree23Img, width: 15, height: 30 },
  { url: illustrationTree24Img, width: 15, height: 30 },
  { url: illustrationTree25Img, width: 15, height: 30 },
  { url: illustrationTree26Img, width: 15, height: 30 },
  { url: illustrationBush11Img, width: 10, height: 7 },
  { url: illustrationBush12Img, width: 10, height: 7 },
  { url: illustrationRockImg, width: 5, height: 3 },
];

const DEFAULT_SIZE_VARIATION = 0.4;
const DEFAULT_SIZE_SCALE = 1;

/** One unit plane reused for every tree — scaled per-mesh via mesh.scale. */
const sharedPlaneGeometry = new THREE.PlaneGeometry(1, 1);

const textureLoader = new THREE.TextureLoader();

/** Texture cache: url → THREE.Texture */
const textureCache = new Map<string, THREE.Texture>();

const loadTexture = (url: string): THREE.Texture => {
  const cached = textureCache.get(url);
  if (cached) return cached;
  const texture = textureLoader.load(url);
  textureCache.set(url, texture);
  return texture;
};

/** Material cache: url → THREE.MeshBasicMaterial (shared across all chunks). */
const materialCache = new Map<string, THREE.MeshBasicMaterial>();

const getOrCreateMaterial = (url: string): THREE.MeshBasicMaterial => {
  const cached = materialCache.get(url);
  if (cached) return cached;
  const material = new THREE.MeshBasicMaterial({
    map: loadTexture(url),
    // alphaTest-only cutout: opaque for the renderer → no per-frame depth sorting
    transparent: false,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  materialCache.set(url, material);
  return material;
};

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let intermediate = Math.imul(state ^ (state >>> 15), 1 | state);
    intermediate = (intermediate + Math.imul(intermediate ^ (intermediate >>> 7), 61 | intermediate)) ^ intermediate;
    return ((intermediate ^ (intermediate >>> 14)) >>> 0) / 4294967296;
  };
};

const computeChunkSeed = (chunkX: number, chunkZ: number): number =>
  (chunkX * 73856093) ^ (chunkZ * 19349663) ^ 0xabcdef;

/**
 * Creates a group of textured tree/bush/rock billboards for a chunk.
 * Shares geometry and materials across all chunks to minimise draw-call overhead.
 */
export const createTreesChunk = (
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  treesPerChunk: number,
  heightSampler?: HeightSampler,
  sizeScale = DEFAULT_SIZE_SCALE,
  sizeVariation = DEFAULT_SIZE_VARIATION,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = `trees-${chunkX},${chunkZ}`;

  const chunkSeed = computeChunkSeed(chunkX, chunkZ);
  const random = createSeededRandom(chunkSeed);

  const worldOffsetX = chunkX * chunkSize;
  const worldOffsetZ = chunkZ * chunkSize;

  Array.from({ length: treesPerChunk }).forEach((_, index) => {
    const positionX = worldOffsetX + (random() - 0.5) * chunkSize;
    const positionZ = worldOffsetZ + (random() - 0.5) * chunkSize;

    const textureIndex = Math.floor(random() * allTextures.length);
    const textureEntry = allTextures[textureIndex];

    const instanceScale = sizeScale * (1 + (random() - 0.5) * sizeVariation);
    const spriteWidth = textureEntry.width * instanceScale;
    const spriteHeight = textureEntry.height * instanceScale;

    const terrainY = heightSampler ? heightSampler(positionX, positionZ) : 0;

    const mesh = new THREE.Mesh(sharedPlaneGeometry, getOrCreateMaterial(textureEntry.url));
    mesh.scale.set(spriteWidth, spriteHeight, 1);
    mesh.position.set(positionX, terrainY + spriteHeight / 2, positionZ);
    mesh.name = `tree-sprite-${chunkX},${chunkZ}-${index}`;

    group.add(mesh);
  });

  return group;
};
