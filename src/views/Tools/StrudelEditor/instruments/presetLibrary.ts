import { computed, ref, watch } from 'vue'
import {
  INSTRUMENT_BUILT_IN_PRESETS,
  INSTRUMENT_NAME_MAX_LENGTH,
  INSTRUMENT_NEW_PRESET_KNOBS,
  INSTRUMENT_STORAGE_KEY
} from './config'
import { checkInstrumentPresetName } from './presetNames'
import { readStoredInstruments } from './storedInstruments'
import { readStored, writeStored } from './storage'
import type {
  InstrumentKind,
  InstrumentKnobs,
  InstrumentNameCheck,
  InstrumentPreset
} from './types'

const isBuiltInName = (name: string): boolean =>
  INSTRUMENT_BUILT_IN_PRESETS.some((preset) => preset.name === name)

/**
 * The presets and what can be done to them: the built-in ones with the user's tweaks, the
 * user's own, the selection, and the rules for names. Everything is kept in local storage.
 * @param onSelect - called with a name whenever the selection moves, so it can be rendered
 * @returns the preset state and its operations
 */
export const createPresetLibrary = (onSelect: (name: string) => void) => {
  const stored = readStoredInstruments(readStored(INSTRUMENT_STORAGE_KEY))
  const userPresets = ref<InstrumentPreset[]>(stored.userPresets)
  const tweaks = ref<Record<string, InstrumentKnobs>>(stored.tweaks)
  const selectedName = ref(stored.selectedName)
  const foreignSoundNames = ref<string[]>([])

  const presets = computed<InstrumentPreset[]>(() => [
    ...INSTRUMENT_BUILT_IN_PRESETS.map((preset) => ({
      ...preset,
      knobs: tweaks.value[preset.name] ?? preset.knobs
    })),
    ...userPresets.value
  ])
  const selectedPreset = computed(
    () => presets.value.find(({ name }) => name === selectedName.value) ?? presets.value[0]
  )
  const isSelectedBuiltIn = computed(() => isBuiltInName(selectedPreset.value?.name ?? ''))

  watch(
    [userPresets, tweaks, selectedName],
    () => {
      writeStored(
        INSTRUMENT_STORAGE_KEY,
        JSON.stringify({
          userPresets: userPresets.value,
          tweaks: tweaks.value,
          selectedName: selectedName.value
        })
      )
    },
    { deep: true }
  )

  /**
   * Whether a name would be accepted for a new or renamed preset.
   * @param name - the wanted name
   * @param ownName - the preset's current name when renaming, which does not count as taken
   * @returns valid, or a message saying what to change
   */
  const checkName = (name: string, ownName = ''): InstrumentNameCheck =>
    checkInstrumentPresetName(
      name,
      presets.value.map((preset) => preset.name).filter((presetName) => presetName !== ownName),
      foreignSoundNames.value
    )

  const selectPreset = (name: string): void => {
    selectedName.value = name
    onSelect(name)
  }

  const setPresetKnobs = (name: string, knobs: InstrumentKnobs): void => {
    if (isBuiltInName(name)) {
      tweaks.value = { ...tweaks.value, [name]: knobs }
    } else {
      userPresets.value = userPresets.value.map((candidate) =>
        candidate.name === name ? { ...candidate, knobs } : candidate
      )
    }
  }

  const setKnobs = (knobs: InstrumentKnobs): void => {
    const name = selectedPreset.value?.name
    if (name !== undefined) {
      setPresetKnobs(name, knobs)
    }
  }

  const setKnob = (knobId: string, value: number): void => {
    setKnobs({ ...selectedPreset.value?.knobs, [knobId]: value })
  }

  const resetPreset = (): void => {
    const preset = selectedPreset.value
    if (preset === undefined) {
      return
    }
    if (isBuiltInName(preset.name)) {
      tweaks.value = Object.fromEntries(
        Object.entries(tweaks.value).filter(([name]) => name !== preset.name)
      )
    } else {
      setKnobs({ ...INSTRUMENT_NEW_PRESET_KNOBS[preset.kind] })
    }
  }

  const addPreset = (preset: InstrumentPreset): void => {
    userPresets.value = [...userPresets.value, preset]
    selectPreset(preset.name)
  }

  const createPreset = (name: string, kind: InstrumentKind): InstrumentNameCheck => {
    const check = checkName(name)
    if (check.valid) {
      addPreset({ name, kind, knobs: { ...INSTRUMENT_NEW_PRESET_KNOBS[kind] } })
    }
    return check
  }

  const duplicatePreset = (): void => {
    const preset = selectedPreset.value
    if (preset === undefined) {
      return
    }
    const base = preset.name.slice(0, INSTRUMENT_NAME_MAX_LENGTH - 2)
    const freeName = Array.from({ length: 98 }, (_, index) => `${base}${index + 2}`).find(
      (candidate) => checkName(candidate).valid
    )
    if (freeName !== undefined) {
      addPreset({ name: freeName, kind: preset.kind, knobs: { ...preset.knobs } })
    }
  }

  const renamePreset = (newName: string): InstrumentNameCheck => {
    const preset = selectedPreset.value
    if (preset === undefined || isBuiltInName(preset.name)) {
      return { valid: false, message: 'Built-in presets keep their names.' }
    }
    const check = checkName(newName, preset.name)
    if (check.valid) {
      userPresets.value = userPresets.value.map((candidate) =>
        candidate.name === preset.name ? { ...candidate, name: newName } : candidate
      )
      selectPreset(newName)
    }
    return check
  }

  const deletePreset = (): void => {
    const preset = selectedPreset.value
    if (preset === undefined || isBuiltInName(preset.name)) {
      return
    }
    userPresets.value = userPresets.value.filter(({ name }) => name !== preset.name)
    selectPreset(INSTRUMENT_BUILT_IN_PRESETS[0]?.name ?? '')
  }

  return {
    presets,
    selectedPreset,
    isSelectedBuiltIn,
    foreignSoundNames,
    checkName,
    selectPreset,
    setKnob,
    setKnobs,
    setPresetKnobs,
    resetPreset,
    createPreset,
    duplicatePreset,
    renamePreset,
    deletePreset
  }
}
