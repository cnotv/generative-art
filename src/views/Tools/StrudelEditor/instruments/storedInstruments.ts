import { isRecordModule } from '../strudelModules'
import {
  INSTRUMENT_BUILT_IN_PRESETS,
  INSTRUMENT_KINDS,
  INSTRUMENT_KIND_IDS,
  INSTRUMENT_NAME_MAX_LENGTH,
  INSTRUMENT_NAME_PATTERN
} from './config'
import type { InstrumentKind, InstrumentKnobs, InstrumentPreset, StoredInstruments } from './types'

const clampToUnit = (value: number): number => Math.min(1, Math.max(0, value))

const readKind = (value: unknown): InstrumentKind | null =>
  INSTRUMENT_KIND_IDS.find((kind) => kind === value) ?? null

/**
 * Keeps the knobs a kind has, each clamped to 0 to 1; a missing or non numeric one is dropped.
 * @param kind - the kind whose knobs are wanted
 * @param raw - an unchecked value
 * @returns the knobs, or null when no knob of the kind survives
 */
export const readInstrumentKnobs = (kind: InstrumentKind, raw: unknown): InstrumentKnobs | null => {
  if (!isRecordModule(raw)) {
    return null
  }
  const entries = INSTRUMENT_KINDS[kind].knobs.flatMap(({ id }) => {
    const value = raw[id]
    return typeof value === 'number' && Number.isFinite(value) ? [[id, clampToUnit(value)]] : []
  })
  return entries.length === INSTRUMENT_KINDS[kind].knobs.length ? Object.fromEntries(entries) : null
}

const readUserPreset = (raw: unknown): InstrumentPreset | null => {
  if (!isRecordModule(raw)) {
    return null
  }
  const kind = readKind(raw.kind)
  const knobs = kind === null ? null : readInstrumentKnobs(kind, raw.knobs)
  const { name } = raw
  const isUsableName =
    typeof name === 'string' &&
    INSTRUMENT_NAME_PATTERN.test(name) &&
    name.length <= INSTRUMENT_NAME_MAX_LENGTH &&
    !INSTRUMENT_BUILT_IN_PRESETS.some((preset) => preset.name === name)
  return kind !== null && knobs !== null && isUsableName ? { name, kind, knobs } : null
}

const readTweaks = (raw: unknown): Record<string, InstrumentKnobs> =>
  isRecordModule(raw)
    ? Object.fromEntries(
        INSTRUMENT_BUILT_IN_PRESETS.flatMap(({ name, kind }) => {
          const knobs = readInstrumentKnobs(kind, raw[name])
          return knobs === null ? [] : [[name, knobs]]
        })
      )
    : {}

/**
 * Reads what was saved in local storage, dropping anything that no longer fits: an unknown
 * kind, a bad name, a duplicate or knobs the kind does not have.
 * @param serialised - the stored text, if any
 * @returns the user's presets, tweaks to the built-in ones and the selected name
 */
export const readStoredInstruments = (serialised: string | null): StoredInstruments => {
  const empty: StoredInstruments = { userPresets: [], tweaks: {}, selectedName: '' }
  try {
    const raw: unknown = JSON.parse(serialised ?? 'null')
    if (!isRecordModule(raw)) {
      return empty
    }
    const userPresets = (Array.isArray(raw.userPresets) ? raw.userPresets : [])
      .map(readUserPreset)
      .filter(
        (preset, index, all): preset is InstrumentPreset =>
          preset !== null && all.findIndex((other) => other?.name === preset.name) === index
      )
    return {
      userPresets,
      tweaks: readTweaks(raw.tweaks),
      selectedName: typeof raw.selectedName === 'string' ? raw.selectedName : ''
    }
  } catch {
    return empty
  }
}
