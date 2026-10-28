import {
  STRUDEL_DRUM_PART_NAMES,
  STRUDEL_GENERAL_MIDI_FAMILIES,
  STRUDEL_GENERAL_MIDI_FAMILY_SIZE,
  STRUDEL_SAMPLE_BANKS,
  STRUDEL_SYNTHS_GROUP_LABEL
} from './config'
import type { StrudelSoundLibrary } from './types'

const GENERAL_MIDI_PREFIX = 'gm_'
const UNKNOWN_BANK_GROUP_LABEL = 'Other samples'
const DRUM_KIT_SAMPLE = /^(\d+)([a-z]+)$/

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const toWords = (identifier: string): string => identifier.split('_').filter(Boolean).join(' ')

const withoutPrefix = (name: string, prefix: string | undefined): string =>
  prefix !== undefined && name.startsWith(prefix) ? name.slice(prefix.length) : name

/**
 * A machine's own spelling with spaces where its words meet: "RolandTR909" reads
 * "Roland TR909", "AJKPercusyn" reads "AJK Percusyn".
 * @param machineName - the machine as its alias list spells it
 * @returns the name split into words
 */
export const spaceStrudelMachineName = (machineName: string): string =>
  machineName.replace(/([\da-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')

/**
 * A drum abbreviation spelled out, alone (`bd`) or after a model number (`808bd`).
 * @param part - the sound's name, or the part after its machine
 * @returns the drum it names, or null when it names none
 */
export const nameStrudelDrumPart = (part: string): string | null => {
  const partName = STRUDEL_DRUM_PART_NAMES[part]
  if (partName !== undefined) {
    return partName
  }
  const [, modelNumber, abbreviation] = DRUM_KIT_SAMPLE.exec(part) ?? []
  const modelPartName =
    abbreviation === undefined ? undefined : STRUDEL_DRUM_PART_NAMES[abbreviation]
  return modelPartName === undefined ? null : `${modelNumber} ${modelPartName}`
}

const readableName = (identifier: string): string =>
  capitalize(nameStrudelDrumPart(identifier) ?? toWords(identifier))

/**
 * The General MIDI family a soundfont belongs to, read from its first font's id: `0320_…` is
 * program 32, ten ids to a program, and eight programs to a family.
 * @param fonts - the soundfont's font ids
 * @returns the family's index, or the last family when the id carries no program
 */
const readGeneralMidiFamily = (fonts: unknown): number => {
  const firstFont = Array.isArray(fonts) && typeof fonts[0] === 'string' ? fonts[0] : ''
  const fontNumber = Number.parseInt(firstFont, 10)
  const familyIndex = Math.floor(fontNumber / 10 / STRUDEL_GENERAL_MIDI_FAMILY_SIZE)
  return Number.isNaN(familyIndex)
    ? STRUDEL_GENERAL_MIDI_FAMILIES.length - 1
    : Math.min(familyIndex, STRUDEL_GENERAL_MIDI_FAMILIES.length - 1)
}

/** Where a sound is listed and what it is called, plus the position of its group. */
type StrudelSoundDescription = {
  label: string
  group: string
  /** Orders groups within a filter: the synths before the soundfont families, in GM order. */
  groupPosition: number
}

const describeSample = (
  name: string,
  baseUrl: unknown,
  soundLibrary: StrudelSoundLibrary
): StrudelSoundDescription => {
  const bank = STRUDEL_SAMPLE_BANKS.find((sampleBank) => sampleBank.baseUrl === baseUrl)
  if (bank === undefined) {
    return { label: name, group: UNKNOWN_BANK_GROUP_LABEL, groupPosition: 0 }
  }
  if (bank.groupsByMachine !== true) {
    return {
      label: readableName(withoutPrefix(name, bank.namePrefix)),
      group: bank.label,
      groupPosition: 0
    }
  }
  const separatorIndex = name.indexOf('_')
  const machineId = separatorIndex === -1 ? name : name.slice(0, separatorIndex)
  const part = separatorIndex === -1 ? '' : name.slice(separatorIndex + 1)
  const machine = soundLibrary.drumMachines[machineId]
  return {
    label: part.length > 0 ? readableName(part) : name,
    group: machine === undefined ? machineId : spaceStrudelMachineName(machine.name),
    groupPosition: 0
  }
}

/**
 * Where the sounds tab lists a sound and the readable name it shows: drum machine sounds under
 * their machine and named for the drum, soundfonts under their General MIDI family, synths
 * together, and every other sample under the bank it came from.
 * @param name - the name code plays the sound by
 * @param data - the sound's registration data from the sound map
 * @param soundLibrary - the drum machines' own spellings
 * @returns the readable name, the group, and the group's position among its neighbours
 */
export const describeStrudelSound = (
  name: string,
  data: Record<string, unknown>,
  soundLibrary: StrudelSoundLibrary
): StrudelSoundDescription => {
  if (data.type === 'synth') {
    return { label: readableName(name), group: STRUDEL_SYNTHS_GROUP_LABEL, groupPosition: 0 }
  }
  if (data.type === 'soundfont') {
    const familyIndex = readGeneralMidiFamily(data.fonts)
    return {
      label: readableName(withoutPrefix(name, GENERAL_MIDI_PREFIX)),
      group: STRUDEL_GENERAL_MIDI_FAMILIES[familyIndex] ?? UNKNOWN_BANK_GROUP_LABEL,
      groupPosition: familyIndex + 1
    }
  }
  return describeSample(name, data.baseUrl, soundLibrary)
}
