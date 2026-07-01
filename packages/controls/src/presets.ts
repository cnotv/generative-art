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

/**
 * Persist a list of presets to localStorage.
 *
 * @param {ControlPreset[]} presets Presets to store
 * @returns {void}
 */
export function savePresets(presets: ControlPreset[]): void {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets))
}

/**
 * Load stored presets from localStorage. Returns an empty list when nothing is
 * stored or the stored value is corrupt.
 *
 * @returns {ControlPreset[]} The stored presets, or an empty list
 */
export function loadPresets(): ControlPreset[] {
  const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(toPreset)
  } catch {
    return []
  }
}
