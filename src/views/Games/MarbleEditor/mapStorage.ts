import type { MarbleMap, PlacedPiece } from './types'
import { PIECE_CATALOG } from './pieceCatalog'

export const STORAGE_KEY_CURRENT = 'marble-editor-current'
export const STORAGE_KEY_SAVED = 'marble-editor-maps'

const isPlacedPiece = (value: unknown): value is PlacedPiece => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    candidate.type in PIECE_CATALOG &&
    typeof candidate.color === 'number'
  )
}

const isMarbleMap = (value: unknown): value is MarbleMap => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.version === 1 &&
    typeof candidate.name === 'string' &&
    typeof candidate.updatedAt === 'number' &&
    Array.isArray(candidate.pieces) &&
    candidate.pieces.every(isPlacedPiece)
  )
}

const parseJson = (raw: string | null): unknown => {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Stores the map being edited.
 * @param map The map.
 */
export const saveCurrentMap = (map: MarbleMap): void => {
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(map))
}

/**
 * Reads the map last edited.
 * @returns The map, or null when none is stored or it is not valid.
 */
export const loadCurrentMap = (): MarbleMap | null => {
  const parsed = parseJson(localStorage.getItem(STORAGE_KEY_CURRENT))
  return isMarbleMap(parsed) ? parsed : null
}

/**
 * Reads the maps saved by name.
 * @returns The valid saved maps.
 */
export const listSavedMaps = (): MarbleMap[] => {
  const parsed = parseJson(localStorage.getItem(STORAGE_KEY_SAVED))
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isMarbleMap)
}

const persistSavedMaps = (maps: MarbleMap[]): MarbleMap[] => {
  localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(maps))
  return maps
}

/**
 * Saves a map under a name, replacing one with that name.
 * @param map The map.
 * @param name The name.
 * @returns Every saved map.
 */
export const saveMapAs = (map: MarbleMap, name: string): MarbleMap[] => {
  const named: MarbleMap = { ...map, name }
  const others = listSavedMaps().filter((saved) => saved.name !== name)
  return persistSavedMaps([...others, named])
}

/**
 * Deletes a saved map.
 * @param name Its name.
 * @returns The saved maps left.
 */
export const deleteSavedMap = (name: string): MarbleMap[] =>
  persistSavedMaps(listSavedMaps().filter((saved) => saved.name !== name))
