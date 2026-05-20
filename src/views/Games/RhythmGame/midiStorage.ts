const DB_NAME = 'rg-midi-library'
const STORE = 'tracks'
const VERSION = 1

export type MidiTrackMeta = { id: string; name: string }

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

/**
 * List all stored MIDI track metadata (id + name, no binary data).
 * @returns Array of track descriptors sorted by name.
 */
export const midiStorageList = async (): Promise<MidiTrackMeta[]> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () =>
      resolve(
        (req.result as Array<{ id: string; name: string }>)
          .map(({ id, name }) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    req.onerror = () => reject(req.error)
  })
}

/**
 * Persist a MIDI ArrayBuffer under the given name and return its generated ID.
 * @param name - Display name (typically the filename without extension).
 * @param data - Raw MIDI binary data.
 * @returns The UUID assigned to the stored track.
 */
export const midiStorageSave = async (name: string, data: ArrayBuffer): Promise<string> => {
  const db = await open()
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put({ id, name, data })
    req.onsuccess = () => resolve(id)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Load a previously saved MIDI's binary data by ID.
 * @param id - UUID returned by midiStorageSave.
 * @returns The raw ArrayBuffer, or null if not found.
 */
export const midiStorageLoad = async (id: string): Promise<ArrayBuffer | null> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as { data: ArrayBuffer } | undefined)?.data ?? null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Permanently remove a stored MIDI track.
 * @param id - UUID of the track to delete.
 */
export const midiStorageDelete = async (id: string): Promise<void> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
