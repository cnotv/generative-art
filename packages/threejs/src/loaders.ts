import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'

/**
 * The one manager every loader reports to, so progress, queue length and errors are
 * observable from a single place instead of per loader.
 */
export const assetsLoadingManager = new THREE.LoadingManager()

/**
 * Shared Three.js loader singletons.
 * Import from here instead of instantiating loaders locally — each loader
 * carries its own internal cache, so sharing a single instance avoids
 * redundant network requests and memory overhead.
 */
export const textureLoader = new THREE.TextureLoader(assetsLoadingManager)
export const cubeTextureLoader = new THREE.CubeTextureLoader(assetsLoadingManager)
export const gltfLoader = new GLTFLoader(assetsLoadingManager)
export const fbxLoader = new FBXLoader(assetsLoadingManager)
