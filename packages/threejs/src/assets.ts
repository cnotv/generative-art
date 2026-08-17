import * as THREE from 'three'
import { disposeObject, disposeMarkShared, disposeUnmarkShared } from './dispose'
import { assetsLoadingManager, textureLoader, gltfLoader, fbxLoader } from './loaders'
import type { AssetParserKind, AssetProgressListener } from './types'

const EXTENSION_KINDS: Record<string, AssetParserKind> = {
  glb: 'gltf',
  gltf: 'gltf',
  fbx: 'fbx',
  png: 'texture',
  jpg: 'texture',
  jpeg: 'texture',
  webp: 'texture',
  avif: 'texture',
  ktx2: 'texture'
}

/**
 * Decide which loader a path needs from its extension.
 * @param path Path or url of the asset
 * @returns The loader kind that can read it
 */
export const assetsParserKind = (path: string): AssetParserKind => {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const kind = EXTENSION_KINDS[extension]
  if (!kind) {
    throw new Error(
      `No loader is registered for ${path}. Supported extensions: ${Object.keys(EXTENSION_KINDS).join(', ')}`
    )
  }
  return kind
}

const progressListeners = new Set<AssetProgressListener>()

assetsLoadingManager.onProgress = (url, loaded, total) => {
  const fraction = total === 0 ? 1 : loaded / total
  progressListeners.forEach((listener) => listener({ url: String(url), loaded, total, fraction }))
}

/**
 * Subscribe to loading progress across every asset in flight.
 * @param listener Called on each completed item with the queue position
 * @returns A function that removes the listener
 */
export const assetsOnProgress = (listener: AssetProgressListener): (() => void) => {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

type AssetCacheEntry = {
  readonly promise: Promise<unknown>
  readonly consumers: number
  readonly value?: unknown
}

const cache = new Map<string, AssetCacheEntry>()

/**
 * A cached asset may be a texture, a scene graph, or a parse result wrapping one. Each frees
 * its GPU memory differently, and disposing the wrong layer silently leaks the rest.
 * @param value The cached value being dropped
 */
const disposeAsset = (value: unknown): void => {
  if (value instanceof THREE.Texture) {
    value.dispose()
    return
  }
  const root = assetRoot(value)
  if (!root) return
  disposeUnmarkShared(root)
  disposeObject(root)
}

/**
 * The scene graph inside a cached value, which may be an object or a parse result wrapping one.
 * @param value The cached value
 * @returns Its root object, or undefined if it holds no scene graph
 */
const assetRoot = (value: unknown): THREE.Object3D | undefined => {
  if (value instanceof THREE.Object3D) return value
  const wrapped = (value as { scene?: unknown })?.scene
  return wrapped instanceof THREE.Object3D ? wrapped : undefined
}

/**
 * Load a url through the cache, paying for network and parse only the first time. Callers
 * that overlap in flight share one request rather than racing into several.
 * @param url The url to load, used as the cache key
 * @param parse Reads the url into a value the first time it is requested
 * @returns The parsed value, shared by every caller holding this url
 */
export const assetsLoad = async <T>(
  url: string,
  parse: (url: string) => Promise<T>
): Promise<T> => {
  const existing = cache.get(url)
  if (existing) {
    cache.set(url, { ...existing, consumers: existing.consumers + 1 })
    return existing.promise as Promise<T>
  }

  const promise = parse(url)
    .then((value) => {
      // Every instance handed out shares this source's geometry and textures, so they are
      // marked before anyone can reach them: an unmounting scene disposing its own objects
      // must not free what the cache still owns.
      const root = assetRoot(value)
      if (root) disposeMarkShared(root)

      // Consumers may have joined while this was in flight, so the count is read again
      // rather than assumed to still be one.
      const entry = cache.get(url)
      if (entry) cache.set(url, { ...entry, value })
      return value
    })
    .catch((error: unknown) => {
      // A cached rejection would make one bad response permanent for the session.
      cache.delete(url)
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load ${url}: ${reason}`, { cause: error })
    })

  cache.set(url, { promise, consumers: 1 })
  return promise as Promise<T>
}

/**
 * Whether a url is currently held in the cache.
 * @param url The url to check
 * @returns True while at least one consumer holds it
 */
export const assetsIsCached = (url: string): boolean => cache.has(url)

/**
 * Drop one consumer's claim on a url. The last release frees the GPU memory; loading the
 * same url afterwards reads it again.
 *
 * Release by url rather than disposing what you were handed: clones share geometry and
 * materials with the cached source, so disposing a clone frees memory still in use.
 * @param url The url to release
 */
export const assetsRelease = (url: string): void => {
  const entry = cache.get(url)
  if (!entry) return

  if (entry.consumers > 1) {
    cache.set(url, { ...entry, consumers: entry.consumers - 1 })
    return
  }

  cache.delete(url)
  disposeAsset(entry.value)
}

/**
 * Drop every cached asset regardless of how many consumers hold it.
 */
export const assetsReleaseAll = (): void => {
  cache.forEach((entry) => disposeAsset(entry.value))
  cache.clear()
}

/**
 * Read a file with the loader its extension implies. This is the parse step only — the
 * result is the shared source, not a copy safe to mutate.
 * @param url The url to read
 * @returns The loader's raw result
 */
const parseByExtension = async (url: string): Promise<unknown> => {
  const kind = assetsParserKind(url)
  if (kind === 'texture') return textureLoader.loadAsync(url)
  if (kind === 'gltf') return gltfLoader.loadAsync(url)
  return fbxLoader.loadAsync(url)
}

/**
 * Load a url with the loader its extension implies, through the cache.
 * @param url The url to load
 * @returns The parsed source, shared by every holder of this url
 */
export const assetsLoadFile = async <T>(url: string): Promise<T> =>
  assetsLoad(url, parseByExtension) as Promise<T>

/**
 * Load every asset a scene needs and resolve once they are all ready, so a level can gate on
 * being complete rather than resolving loads mid-frame. Already-cached assets are not read
 * again.
 * @param paths The assets to have ready
 * @param parse Optional override for how each path is read, for assets with no file extension
 * @returns Resolves when every asset is cached
 */
export const assetsPreload = async (
  paths: readonly string[],
  parse: (url: string) => Promise<unknown> = parseByExtension
): Promise<void> => {
  await Promise.all(paths.map((path) => assetsLoad(path, parse)))
}
