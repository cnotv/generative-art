import type { ControlMapping, ControlPreset } from './types'

export const PRESETS_STORAGE_KEY = 'webgamekit:controls-presets'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isMapping = (value: unknown): value is ControlMapping =>
  isRecord(value) &&
  Object.values(value).every(
    (device) =>
      isRecord(device) && Object.values(device).every((action) => typeof action === 'string')
  )

const toPreset = (value: unknown): ControlPreset => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.skin !== 'string' ||
    !isMapping(value.mapping)
  ) {
    throw new Error('Invalid control preset')
  }
  return { name: value.name, mapping: value.mapping, skin: value.skin }
}

/**
 * Serialize a preset to a JSON string for export.
 *
 * @param {ControlPreset} preset Preset to serialize
 * @returns {string} JSON representation of the preset
 */
export function serializePreset(preset: ControlPreset): string {
  return JSON.stringify(preset)
}

/**
 * Parse and validate a preset from a JSON string. Throws when the JSON is
 * malformed or does not match the preset shape.
 *
 * @param {string} json JSON string to parse
 * @returns {ControlPreset} The validated preset
 */
export function parsePreset(json: string): ControlPreset {
  return toPreset(JSON.parse(json))
}

const storageKeyFor = (key?: string): string =>
  key ? `${PRESETS_STORAGE_KEY}:${key}` : PRESETS_STORAGE_KEY

const mappingKeyFor = (key: string): string => `${PRESETS_STORAGE_KEY}:mapping:${key}`

/**
 * Persist the active mapping for a key (e.g. a game id) to localStorage.
 *
 * @param {string} key Namespace key
 * @param {ControlMapping} mapping The active mapping to store
 * @returns {void}
 */
export function saveMapping(key: string, mapping: ControlMapping): void {
  localStorage.setItem(mappingKeyFor(key), JSON.stringify(mapping))
}

/**
 * Load the active mapping stored for a key. Returns null when nothing is stored
 * or the stored value is not a valid mapping.
 *
 * @param {string} key Namespace key used when saving
 * @returns {ControlMapping | null} The stored mapping, or null
 */
export function loadMapping(key: string): ControlMapping | null {
  const raw = localStorage.getItem(mappingKeyFor(key))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isMapping(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Persist a list of presets to localStorage. Pass a key (e.g. a game id) to
 * store them in an isolated namespace.
 *
 * @param {ControlPreset[]} presets Presets to store
 * @param {string} [key] Namespace key
 * @returns {void}
 */
export function savePresets(presets: ControlPreset[], key?: string): void {
  localStorage.setItem(storageKeyFor(key), JSON.stringify(presets))
}

/**
 * Load stored presets from localStorage. Returns an empty list when nothing is
 * stored or the stored value is corrupt.
 *
 * @param {string} [key] Namespace key used when saving
 * @returns {ControlPreset[]} The stored presets, or an empty list
 */
export function loadPresets(key?: string): ControlPreset[] {
  const raw = localStorage.getItem(storageKeyFor(key))
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(toPreset)
  } catch {
    return []
  }
}
