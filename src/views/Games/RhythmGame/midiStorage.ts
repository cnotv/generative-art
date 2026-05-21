import type { MidiTrackInfo } from './parseMidi'

const DB_NAME = 'rg-midi-library'
const STORE = 'tracks'
const VERSION = 1

type StoredMidi = { id: string; name: string; data: ArrayBuffer; tracks: MidiTrackInfo[] }

export type MidiLibraryEntry = { id: string; name: string; tracks: MidiTrackInfo[] }

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
 * List all stored MIDI entries with their track metadata (no binary data loaded).
 * @returns Entries sorted alphabetically by name.
 */
export const midiStorageList = async (): Promise<MidiLibraryEntry[]> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () =>
      resolve(
        (req.result as StoredMidi[])
          .map(({ id, name, tracks }) => ({ id, name, tracks: tracks ?? [] }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    req.onerror = () => reject(req.error)
  })
}

/**
 * Persist a MIDI file alongside its parsed track metadata.
 * @param name - Display name (filename without extension).
 * @param data - Raw MIDI binary.
 * @param tracks - Track list from getMidiTracks().
 * @returns The UUID assigned to the entry.
 */
export const midiStorageSave = async (
  name: string,
  data: ArrayBuffer,
  tracks: MidiTrackInfo[]
): Promise<string> => {
  const db = await open()
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE, 'readwrite')
      .objectStore(STORE)
      .put({ id, name, data, tracks })
    req.onsuccess = () => resolve(id)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Load the raw binary for a stored MIDI by ID.
 * @param id - UUID returned by midiStorageSave.
 * @returns The ArrayBuffer, or null if not found.
 */
export const midiStorageLoad = async (id: string): Promise<ArrayBuffer | null> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve((req.result as StoredMidi | undefined)?.data ?? null)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Permanently remove a stored MIDI.
 * @param id - UUID of the entry to delete.
 */
export const midiStorageDelete = async (id: string): Promise<void> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
