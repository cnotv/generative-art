import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'

/**
 * Shared Three.js loader singletons.
 * Import from here instead of instantiating loaders locally — each loader
 * carries its own internal cache, so sharing a single instance avoids
 * redundant network requests and memory overhead.
 */
export const textureLoader = new THREE.TextureLoader()
export const cubeTextureLoader = new THREE.CubeTextureLoader()
export const gltfLoader = new GLTFLoader()
export const fbxLoader = new FBXLoader()
