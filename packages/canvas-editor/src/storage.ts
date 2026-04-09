const LOCAL_STORAGE_PREFIX = 'canvas-editor-slot:'
const IDB_DB_NAME = 'canvas-editor'
const IDB_STORE_NAME = 'slots'
const IDB_VERSION = 1

export type StorageBackend = 'localStorage' | 'indexedDB'

export interface StorageSlot {
  name: string
  dataUrl: string
  updatedAt: number
}

// ── localStorage ────────────────────────────────────────────────────────────

const lsKey = (name: string): string => `${LOCAL_STORAGE_PREFIX}${name}`

/**
 * Save a canvas data URL to localStorage under the given slot name.
 * @param name - Slot identifier
 * @param dataUrl - Canvas data URL to persist
 */
export const storageSaveLocal = (name: string, dataUrl: string): void => {
  const slot: StorageSlot = { name, dataUrl, updatedAt: Date.now() }
  localStorage.setItem(lsKey(name), JSON.stringify(slot))
}

/**
 * Load a slot from localStorage.
 * @param name - Slot identifier
 * @returns The stored slot, or null if not found
 */
export const storageLoadLocal = (name: string): StorageSlot | null => {
  const raw = localStorage.getItem(lsKey(name))
  return raw ? (JSON.parse(raw) as StorageSlot) : null
}

/**
 * Delete a slot from localStorage.
 * @param name - Slot identifier
 */
export const storageDeleteLocal = (name: string): void => {
  localStorage.removeItem(lsKey(name))
}

/**
 * List all slot names stored in localStorage.
 * @returns Array of slot names
 */
export const storageListLocal = (): string[] =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith(LOCAL_STORAGE_PREFIX))
    .map((k) => k.slice(LOCAL_STORAGE_PREFIX.length))
    .sort()

// ── IndexedDB ────────────────────────────────────────────────────────────────

const openDatabase_ = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(IDB_STORE_NAME, { keyPath: 'name' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

/**
 * Save a canvas data URL to IndexedDB under the given slot name.
 * @param name - Slot identifier
 * @param dataUrl - Canvas data URL to persist
 * @returns Promise that resolves when the save is complete
 */
export const storageSaveIdb = async (name: string, dataUrl: string): Promise<void> => {
  const db = await openDatabase_()
  const slot: StorageSlot = { name, dataUrl, updatedAt: Date.now() }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
    tx.objectStore(IDB_STORE_NAME).put(slot)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Load a slot from IndexedDB.
 * @param name - Slot identifier
 * @returns Promise resolving to the stored slot, or null if not found
 */
export const storageLoadIdb = async (name: string): Promise<StorageSlot | null> => {
  const db = await openDatabase_()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly')
    const req = tx.objectStore(IDB_STORE_NAME).get(name)
    req.onsuccess = () => resolve((req.result as StorageSlot) ?? null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete a slot from IndexedDB.
 * @param name - Slot identifier
 * @returns Promise that resolves when the delete is complete
 */
export const storageDeleteIdb = async (name: string): Promise<void> => {
  const db = await openDatabase_()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
    tx.objectStore(IDB_STORE_NAME).delete(name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * List all slot names stored in IndexedDB.
 * @returns Promise resolving to an array of slot names
 */
export const storageListIdb = async (): Promise<string[]> => {
  const db = await openDatabase_()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly')
    const req = tx.objectStore(IDB_STORE_NAME).getAllKeys()
    req.onsuccess = () => resolve((req.result as string[]).sort())
    req.onerror = () => reject(req.error)
  })
}

// ── Unified API ──────────────────────────────────────────────────────────────

/**
 * Save to the chosen backend.
 * @param backend - Storage backend to use
 * @param name - Slot identifier
 * @param dataUrl - Canvas data URL
 */
export const storageSave = (
  backend: StorageBackend,
  name: string,
  dataUrl: string
): Promise<void> | void =>
  backend === 'indexedDB' ? storageSaveIdb(name, dataUrl) : storageSaveLocal(name, dataUrl)

/**
 * Load from the chosen backend.
 * @param backend - Storage backend to use
 * @param name - Slot identifier
 * @returns The stored slot, or null
 */
export const storageLoad = (
  backend: StorageBackend,
  name: string
): Promise<StorageSlot | null> | StorageSlot | null =>
  backend === 'indexedDB' ? storageLoadIdb(name) : storageLoadLocal(name)

/**
 * Delete from the chosen backend.
 * @param backend - Storage backend to use
 * @param name - Slot identifier
 */
export const storageDelete = (backend: StorageBackend, name: string): Promise<void> | void =>
  backend === 'indexedDB' ? storageDeleteIdb(name) : storageDeleteLocal(name)

/**
 * List slot names from the chosen backend.
 * @param backend - Storage backend to use
 * @returns Array of slot names (async for indexedDB, sync for localStorage)
 */
export const storageList = (backend: StorageBackend): Promise<string[]> | string[] =>
  backend === 'indexedDB' ? storageListIdb() : storageListLocal()
